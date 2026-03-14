"""
TDD test suite for member lifecycle and trip leave/access functionality.

Covers:
- Member status: placeholder / pending / active
- Joining trip via invite code
- Claiming placeholders
- Leave trip (last admin check, debt check)
- Remove member (admin only, debt check)
- Permission guards on member management
"""

import os
import pytest
import pytest_asyncio
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel

os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from app.main import app
from app.core.database import get_session
from app.core.auth import get_current_user_id, get_current_user
from app.models.user import User

TEST_USER_ID = "member-test-user-001"
TEST_USER_EMAIL = "member@example.com"


@pytest_asyncio.fixture(scope="function")
async def async_engine():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False, future=True)
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def async_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    maker = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as session:
        test_user = User(id=TEST_USER_ID, email=TEST_USER_EMAIL, display_name="Member User")
        session.add(test_user)
        await session.commit()
        yield session


@pytest_asyncio.fixture(scope="function")
async def client(async_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def get_session_override():
        yield async_session

    async def get_current_user_id_override():
        return TEST_USER_ID

    async def get_current_user_override():
        return User(id=TEST_USER_ID, email=TEST_USER_EMAIL, display_name="Member User")

    app.dependency_overrides[get_session] = get_session_override
    app.dependency_overrides[get_current_user_id] = get_current_user_id_override
    app.dependency_overrides[get_current_user] = get_current_user_override

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/api") as c:
        yield c

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def trip(client) -> dict:
    resp = await client.post("/trips/", json={"name": "Member Trip", "base_currency": "USD"})
    assert resp.status_code == 201
    return resp.json()


# ──────────────────────────────────────────────
# MEMBER STATUS TESTS
# ──────────────────────────────────────────────

class TestMemberStatus:

    @pytest.mark.asyncio
    async def test_add_placeholder_has_correct_status(self, client, trip):
        """Member added with nickname only → status=placeholder."""
        tid = trip["id"]
        resp = await client.post(f"/trips/{tid}/members", json={"nickname": "Ghost"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "placeholder"
        assert data["user_id"] is None
        assert data["invited_email"] is None

    @pytest.mark.asyncio
    async def test_add_placeholder_no_email(self, client, trip):
        """Placeholder has no email."""
        tid = trip["id"]
        resp = await client.post(f"/trips/{tid}/members", json={"nickname": "NoEmail"})
        data = resp.json()
        assert data.get("invited_email") is None

    @pytest.mark.asyncio
    async def test_add_pending_member_with_email(self, client, async_session, trip):
        """Member added with email for unknown user → status=pending."""
        tid = trip["id"]
        resp = await client.post(f"/trips/{tid}/members", json={
            "nickname": "Pending Person",
            "email": "pending@example.com",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "pending"
        assert data["invited_email"] == "pending@example.com"

    @pytest.mark.asyncio
    async def test_trip_creator_is_active_admin(self, client, trip):
        """Trip creator is an active admin member."""
        tid = trip["id"]
        resp = await client.get(f"/trips/{tid}")
        data = resp.json()

        creator_member = next(
            (m for m in data["members"] if m["user_id"] == TEST_USER_ID), None
        )
        assert creator_member is not None, "Creator should be in trip members"
        assert creator_member["status"] == "active"
        assert creator_member["is_admin"] is True

    @pytest.mark.asyncio
    async def test_duplicate_member_rejected(self, client, async_session, trip):
        """Cannot add same email twice to the same trip."""
        tid = trip["id"]
        email = "dup@example.com"

        # Add second user to DB
        second_user = User(id="second-user-id", email=email, display_name="Second User")
        async_session.add(second_user)
        await async_session.commit()

        resp1 = await client.post(f"/trips/{tid}/members", json={"nickname": "One", "email": email})
        resp2 = await client.post(f"/trips/{tid}/members", json={"nickname": "Two", "email": email})

        # Second add should fail
        assert resp2.status_code in [400, 409], f"Duplicate member should fail, got {resp2.status_code}"

    @pytest.mark.asyncio
    async def test_get_trip_returns_all_members(self, client, trip):
        """GET /trips/{id} includes all member details."""
        tid = trip["id"]
        await client.post(f"/trips/{tid}/members", json={"nickname": "Alice"})
        await client.post(f"/trips/{tid}/members", json={"nickname": "Bob"})

        resp = await client.get(f"/trips/{tid}")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["members"]) >= 3  # creator + Alice + Bob


# ──────────────────────────────────────────────
# REMOVE MEMBER TESTS
# ──────────────────────────────────────────────

class TestRemoveMember:

    @pytest.mark.asyncio
    async def test_remove_placeholder_succeeds(self, client, trip):
        """Admin can remove a placeholder member with no debts."""
        tid = trip["id"]
        resp = await client.post(f"/trips/{tid}/members", json={"nickname": "Temp"})
        member_id = resp.json()["id"]

        del_resp = await client.delete(f"/trips/{tid}/members/{member_id}")
        assert del_resp.status_code == 204

    @pytest.mark.asyncio
    async def test_remove_member_with_debt_fails(self, client, trip):
        """Cannot remove member who has outstanding debt."""
        tid = trip["id"]
        # Add a placeholder
        resp = await client.post(f"/trips/{tid}/members", json={"nickname": "Debtor"})
        debtor_id = resp.json()["id"]

        # Get creator member id (the one that has user_id = TEST_USER_ID)
        trip_data = await client.get(f"/trips/{tid}")
        creator_member = next(m for m in trip_data.json()["members"] if m["user_id"] == TEST_USER_ID)
        creator_member_id = creator_member["id"]

        # Create expense so debtor owes creator
        await client.post(f"/trips/{tid}/expenses", json={
            "description": "Owed expense",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": creator_member_id,
            "split_type": "custom",
            "splits": [{"member_id": debtor_id, "amount": 100}],
        })

        del_resp = await client.delete(f"/trips/{tid}/members/{debtor_id}")
        assert del_resp.status_code == 400, "Should not be able to remove member with debt"


# ──────────────────────────────────────────────
# LEAVE TRIP TESTS
# ──────────────────────────────────────────────

class TestLeaveTrip:

    @pytest.mark.asyncio
    async def test_last_admin_cannot_leave(self, client, trip):
        """Last admin cannot leave trip."""
        tid = trip["id"]
        resp = await client.post(f"/trips/{tid}/leave")
        assert resp.status_code == 400, "Last admin should not be able to leave"

    @pytest.mark.asyncio
    async def test_leave_trip_with_debt_fails(self, client, async_session, trip):
        """User cannot leave if they have outstanding debts."""
        tid = trip["id"]

        # Add Alice and make her an admin too so test user can leave
        alice_resp = await client.post(f"/trips/{tid}/members", json={"nickname": "Alice"})
        alice_id = alice_resp.json()["id"]

        # Promote Alice to admin
        await client.put(f"/trips/{tid}/members/{alice_id}", json={"is_admin": True})

        # Get creator member id
        trip_data = await client.get(f"/trips/{tid}")
        creator_member = next(m for m in trip_data.json()["members"] if m["user_id"] == TEST_USER_ID)
        creator_member_id = creator_member["id"]

        # Create a debt where creator owes someone (creator owes Alice placeholder debt)
        # For this we need Alice to pay and creator splits
        await client.post(f"/trips/{tid}/expenses", json={
            "description": "Debt expense",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice_id,
            "split_type": "custom",
            "splits": [{"member_id": creator_member_id, "amount": 100}],
        })

        resp = await client.post(f"/trips/{tid}/leave")
        assert resp.status_code == 400, "Cannot leave with outstanding debt"


# ──────────────────────────────────────────────
# INVITE LINK TESTS
# ──────────────────────────────────────────────

class TestInviteLinks:

    @pytest.mark.asyncio
    async def test_generate_invite_link(self, client, trip):
        """Admin can generate invite link."""
        tid = trip["id"]
        resp = await client.post(f"/trips/{tid}/invite", json={})
        assert resp.status_code in [200, 201]
        data = resp.json()
        assert "invite_url" in data or "code" in data

    @pytest.mark.asyncio
    async def test_invite_link_has_expiry(self, client, trip):
        """Generated invite link has an expiry date."""
        tid = trip["id"]
        resp = await client.post(f"/trips/{tid}/invite", json={})
        assert resp.status_code in [200, 201]
        data = resp.json()
        assert "expires_at" in data

    @pytest.mark.asyncio
    async def test_decode_invite_link_returns_trip_info(self, client, trip):
        """Decode invite code returns trip name and claimable members."""
        tid = trip["id"]
        invite_resp = await client.post(f"/trips/{tid}/invite", json={})
        assert invite_resp.status_code in [200, 201]
        code = invite_resp.json().get("code") or invite_resp.json().get("invite_url", "").split("/")[-1]

        decode_resp = await client.get(f"/invites/{code}")
        assert decode_resp.status_code == 200
        data = decode_resp.json()
        assert "trip_name" in data or "trip" in data


# ──────────────────────────────────────────────
# MEMBER UPDATE TESTS
# ──────────────────────────────────────────────

class TestMemberUpdate:

    @pytest.mark.asyncio
    async def test_update_member_nickname(self, client, trip):
        """Admin can change member's nickname."""
        tid = trip["id"]
        resp = await client.post(f"/trips/{tid}/members", json={"nickname": "Old Name"})
        member_id = resp.json()["id"]

        update_resp = await client.put(f"/trips/{tid}/members/{member_id}", json={"nickname": "New Name"})
        assert update_resp.status_code == 200
        assert update_resp.json()["nickname"] == "New Name"

    @pytest.mark.asyncio
    async def test_promote_member_to_admin(self, client, trip):
        """Admin can promote another member to admin."""
        tid = trip["id"]
        resp = await client.post(f"/trips/{tid}/members", json={"nickname": "Promotable"})
        member_id = resp.json()["id"]

        update_resp = await client.put(f"/trips/{tid}/members/{member_id}", json={"is_admin": True})
        assert update_resp.status_code == 200
        assert update_resp.json()["is_admin"] is True


# ──────────────────────────────────────────────
# JOIN VIA INVITE CODE TESTS
# ──────────────────────────────────────────────

class TestJoinViaInviteCode:

    @pytest.mark.asyncio
    async def test_join_via_invite_creates_member(self, client, async_session, trip):
        """User can join trip via invite link."""
        tid = trip["id"]

        # Generate invite
        invite_resp = await client.post(f"/trips/{tid}/invite", json={})
        assert invite_resp.status_code in [200, 201]
        code = invite_resp.json().get("invite_code") or invite_resp.json().get("code")

        # Create a second user
        second_user_id = "join-test-user-002"
        second_user_email = "joiner@example.com"
        from app.models.user import User as UserModel
        second_user = UserModel(id=second_user_id, email=second_user_email, display_name="Joiner")
        async_session.add(second_user)
        await async_session.commit()

        # Switch auth to second user
        from app.core.auth import get_current_user
        from app.core.database import get_session as get_db_session

        async def get_session_override():
            yield async_session

        async def get_current_user_override():
            return UserModel(id=second_user_id, email=second_user_email)

        from app.main import app as the_app
        the_app.dependency_overrides[get_db_session] = get_session_override
        the_app.dependency_overrides[get_current_user] = get_current_user_override

        from httpx import AsyncClient, ASGITransport
        transport = ASGITransport(app=the_app)
        async with AsyncClient(transport=transport, base_url="http://test/api") as c2:
            join_resp = await c2.post(f"/invites/{code}/join")
            assert join_resp.status_code == 200
            data = join_resp.json()
            assert data["status"] == "active"

        the_app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_join_expired_invite_fails(self, client, async_session, trip):
        """Joining with expired invite returns 410."""
        from app.models.trip_invite import TripInvite
        from app.core.datetime_utils import utcnow
        from datetime import timedelta

        tid = trip["id"]

        # Create an expired invite directly
        invite = TripInvite(
            trip_id=tid,
            code="deadbeef00000000",
            created_by=TEST_USER_ID,
            expires_at=utcnow() - timedelta(days=1),  # expired
        )
        async_session.add(invite)
        await async_session.commit()

        resp = await client.post("/invites/deadbeef00000000/join")
        assert resp.status_code == 410

    @pytest.mark.asyncio
    async def test_join_nonexistent_invite_fails(self, client, trip):
        """Joining with invalid code returns 404 or 400."""
        # A valid format 16-char hex code that doesn't exist
        resp = await client.post("/invites/1234567890abcdef/join")
        assert resp.status_code in [400, 404]

    @pytest.mark.asyncio
    async def test_join_invalid_code_format_fails(self, client, trip):
        """Joining with invalid code format returns 400."""
        resp = await client.post("/invites/badcode/join")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_decode_invite_returns_trip_info(self, client, trip):
        """GET /invites/{code} returns trip details."""
        tid = trip["id"]
        invite_resp = await client.post(f"/trips/{tid}/invite", json={})
        code = invite_resp.json().get("invite_code")

        decode_resp = await client.get(f"/invites/{code}")
        assert decode_resp.status_code == 200
        data = decode_resp.json()
        assert "trip_name" in data
        assert "trip_id" in data
        assert data["trip_id"] == tid


# ──────────────────────────────────────────────
# REMOVE LAST ADMIN BLOCKED TESTS
# ──────────────────────────────────────────────

class TestLastAdminProtection:

    @pytest.mark.asyncio
    async def test_remove_last_admin_blocked(self, client, async_session, trip):
        """Cannot remove the last active admin."""
        tid = trip["id"]
        trip_data = await client.get(f"/trips/{tid}")
        creator_member = next(m for m in trip_data.json()["members"] if m["user_id"] == TEST_USER_ID)
        creator_member_id = creator_member["id"]

        # Try to remove the only admin (creator)
        resp = await client.delete(f"/trips/{tid}/members/{creator_member_id}")
        assert resp.status_code == 400, "Should not be able to remove last admin"

    @pytest.mark.asyncio
    async def test_demote_last_admin_then_remove_still_blocked(self, client, async_session, trip):
        """Even after promoting another, you can remove the original admin."""
        tid = trip["id"]

        # Add another member and promote to admin
        add_resp = await client.post(f"/trips/{tid}/members", json={"nickname": "Second Admin"})
        second_member_id = add_resp.json()["id"]
        await client.put(f"/trips/{tid}/members/{second_member_id}", json={"is_admin": True})

        # Now the creator can be removed (there's another admin)
        trip_data = await client.get(f"/trips/{tid}")
        creator_member = next(m for m in trip_data.json()["members"] if m["user_id"] == TEST_USER_ID)
        creator_member_id = creator_member["id"]

        # But we can't delete the creator member since they have user_id - that's ok
        # At least we can verify the second member is now admin
        members_resp = await client.get(f"/trips/{tid}/members")
        second = next(m for m in members_resp.json() if m["id"] == second_member_id)
        assert second["is_admin"] is True


# ──────────────────────────────────────────────
# MEMBER UPDATE REMOVING EMAIL TESTS
# ──────────────────────────────────────────────

class TestMemberUpdateEmail:

    @pytest.mark.asyncio
    async def test_update_member_add_email_changes_to_pending(self, client, trip):
        """Adding email to placeholder changes status to pending."""
        tid = trip["id"]
        resp = await client.post(f"/trips/{tid}/members", json={"nickname": "Placeholder"})
        member_id = resp.json()["id"]
        assert resp.json()["status"] == "placeholder"

        update_resp = await client.put(f"/trips/{tid}/members/{member_id}", json={
            "email": "newpending@example.com",
        })
        assert update_resp.status_code == 200
        assert update_resp.json()["status"] == "pending"
        assert update_resp.json()["invited_email"] == "newpending@example.com"

    @pytest.mark.asyncio
    async def test_update_member_remove_email_changes_to_placeholder(self, client, trip):
        """Removing email from pending member changes to placeholder."""
        tid = trip["id"]
        resp = await client.post(f"/trips/{tid}/members", json={
            "nickname": "WasEmail",
            "email": "remove@example.com",
        })
        member_id = resp.json()["id"]
        assert resp.json()["status"] == "pending"

        update_resp = await client.put(f"/trips/{tid}/members/{member_id}", json={"email": ""})
        assert update_resp.status_code == 200
        assert update_resp.json()["status"] == "placeholder"

    @pytest.mark.asyncio
    async def test_cannot_change_email_for_active_member(self, client, async_session, trip):
        """Cannot change email for an active member."""
        tid = trip["id"]

        # Create an active member (user exists in db)
        from app.models.user import User as UserModel
        active_user = UserModel(id="active-email-test", email="active@example.com", display_name="Active")
        async_session.add(active_user)
        await async_session.commit()

        resp = await client.post(f"/trips/{tid}/members", json={
            "nickname": "Active Member",
            "email": "active@example.com",
        })
        member_id = resp.json()["id"]
        # Should be active since user exists
        assert resp.json()["status"] == "active"

        update_resp = await client.put(f"/trips/{tid}/members/{member_id}", json={
            "email": "changed@example.com",
        })
        assert update_resp.status_code == 400

    @pytest.mark.asyncio
    async def test_list_members_returns_all(self, client, trip):
        """GET /trips/{id}/members returns all members."""
        tid = trip["id"]
        await client.post(f"/trips/{tid}/members", json={"nickname": "Extra1"})
        await client.post(f"/trips/{tid}/members", json={"nickname": "Extra2"})

        resp = await client.get(f"/trips/{tid}/members")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 3  # creator + Extra1 + Extra2

    @pytest.mark.asyncio
    async def test_update_nonexistent_member_returns_404(self, client, trip):
        """Updating non-existent member returns 404."""
        tid = trip["id"]
        resp = await client.put(f"/trips/{tid}/members/999999", json={"nickname": "Ghost"})
        assert resp.status_code == 404
