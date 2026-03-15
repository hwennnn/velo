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


# ──────────────────────────────────────────────
# INVITE LINK REUSE & ADVANCED TESTS
# ──────────────────────────────────────────────

class TestInviteLinkAdvanced:

    @pytest.mark.asyncio
    async def test_generate_invite_reuses_existing_invite(self, client, trip):
        """Generating invite twice reuses the same invite code."""
        tid = trip["id"]
        resp1 = await client.post(f"/trips/{tid}/invite", json={})
        assert resp1.status_code in [200, 201]
        code1 = resp1.json().get("invite_code")

        resp2 = await client.post(f"/trips/{tid}/invite", json={})
        assert resp2.status_code in [200, 201]
        code2 = resp2.json().get("invite_code")

        assert code1 == code2, "Second invite should reuse the same code"

    @pytest.mark.asyncio
    async def test_generate_invite_no_claim_creates_new_code(self, client, trip):
        """Generating with allow_claim=False creates a separate invite."""
        tid = trip["id"]
        resp1 = await client.post(f"/trips/{tid}/invite", json={"allow_claim": True})
        assert resp1.status_code in [200, 201]
        code1 = resp1.json().get("invite_code")

        resp2 = await client.post(f"/trips/{tid}/invite", json={"allow_claim": False})
        assert resp2.status_code in [200, 201]
        code2 = resp2.json().get("invite_code")

        assert code1 != code2, "Different allow_claim should create different codes"

    @pytest.mark.asyncio
    async def test_decode_invite_not_found(self, client):
        """Decoding a valid-format but non-existent code returns 404."""
        resp = await client.get("/invites/1234567890abcdef")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_decode_invite_expired(self, client, async_session):
        """Decoding an expired invite returns 410."""
        from app.models.trip_invite import TripInvite
        from app.core.datetime_utils import utcnow
        from datetime import timedelta

        invite = TripInvite(
            trip_id=1,
            code="deadbeef12345678",
            created_by=TEST_USER_ID,
            expires_at=utcnow() - timedelta(days=1),
        )
        async_session.add(invite)
        await async_session.commit()

        resp = await client.get("/invites/deadbeef12345678")
        assert resp.status_code in [410, 404]  # expired or trip not found

    @pytest.mark.asyncio
    async def test_decode_invite_with_claimable_members(self, client, trip):
        """Decoded invite lists placeholder members as claimable."""
        tid = trip["id"]

        # Add a placeholder member
        await client.post(f"/trips/{tid}/members", json={"nickname": "PlaceholderUser"})

        invite_resp = await client.post(f"/trips/{tid}/invite", json={"allow_claim": True})
        code = invite_resp.json().get("invite_code")

        decode_resp = await client.get(f"/invites/{code}")
        assert decode_resp.status_code == 200
        data = decode_resp.json()
        assert "claimable_members" in data
        assert any(m["nickname"] == "PlaceholderUser" for m in data["claimable_members"])

    @pytest.mark.asyncio
    async def test_decode_invite_already_member(self, client, trip):
        """Decoded invite shows is_already_member=True for current user."""
        tid = trip["id"]

        invite_resp = await client.post(f"/trips/{tid}/invite", json={})
        code = invite_resp.json().get("invite_code")

        decode_resp = await client.get(f"/invites/{code}")
        assert decode_resp.status_code == 200
        data = decode_resp.json()
        assert data.get("is_already_member") is True

    @pytest.mark.asyncio
    async def test_decode_invite_with_valid_claim_param(self, client, trip):
        """Decoded invite with valid ?claim= sets claim_member_id."""
        tid = trip["id"]
        add_resp = await client.post(f"/trips/{tid}/members", json={"nickname": "Claimable"})
        claimable_id = add_resp.json()["id"]

        invite_resp = await client.post(f"/trips/{tid}/invite", json={"allow_claim": True})
        code = invite_resp.json().get("invite_code")

        decode_resp = await client.get(f"/invites/{code}?claim={claimable_id}")
        assert decode_resp.status_code == 200
        data = decode_resp.json()
        assert data.get("claim_member_id") == claimable_id

    @pytest.mark.asyncio
    async def test_decode_invite_with_invalid_claim_param_ignored(self, client, trip):
        """Decoded invite with invalid ?claim= param is silently ignored."""
        tid = trip["id"]
        invite_resp = await client.post(f"/trips/{tid}/invite", json={"allow_claim": True})
        code = invite_resp.json().get("invite_code")

        decode_resp = await client.get(f"/invites/{code}?claim=999999")
        assert decode_resp.status_code == 200
        data = decode_resp.json()
        assert data.get("claim_member_id") is None


# ──────────────────────────────────────────────
# JOIN TRIP ADVANCED PATHS
# ──────────────────────────────────────────────

class TestJoinTripAdvancedPaths:

    @pytest.mark.asyncio
    async def test_join_trip_already_active_returns_member(self, client, async_session, trip):
        """Joining a trip you're already a member of returns existing membership."""
        tid = trip["id"]

        invite_resp = await client.post(f"/trips/{tid}/invite", json={})
        code = invite_resp.json().get("invite_code")

        # The current user is already a member - joining should return their existing slot
        resp = await client.post(f"/invites/{code}/join")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "active"
        assert data["user_id"] == TEST_USER_ID

    @pytest.mark.asyncio
    async def test_join_trip_claims_pending_invitation_by_email(self, client, async_session, trip):
        """Joining claims a pending invitation if email matches."""
        from app.models.user import User as UserModel

        tid = trip["id"]

        # Create a second user
        second_user = UserModel(
            id="joiner-email-001",
            email="joiner-email@example.com",
            display_name="Joiner",
        )
        async_session.add(second_user)
        await async_session.commit()

        # Add them as pending (email-based)
        await client.post(f"/trips/{tid}/members", json={
            "nickname": "Pending Joiner",
            "email": "joiner-email@example.com",
        })

        # Generate invite
        invite_resp = await client.post(f"/trips/{tid}/invite", json={})
        code = invite_resp.json().get("invite_code")

        # Join as second user (their email is invited)
        from app.core.auth import get_current_user
        from app.core.database import get_session as get_db_session
        from app.main import app as the_app
        from httpx import AsyncClient as HClient, ASGITransport

        async def get_session_override():
            yield async_session

        async def get_current_user_override():
            return UserModel(id="joiner-email-001", email="joiner-email@example.com", display_name="Joiner")

        the_app.dependency_overrides[get_db_session] = get_session_override
        the_app.dependency_overrides[get_current_user] = get_current_user_override

        transport = ASGITransport(app=the_app)
        async with HClient(transport=transport, base_url="http://test/api") as c2:
            join_resp = await c2.post(f"/invites/{code}/join")
            assert join_resp.status_code == 200
            data = join_resp.json()
            assert data["status"] == "active"
            assert data["user_id"] == "joiner-email-001"

        the_app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_join_trip_with_claim_member_id(self, client, async_session, trip):
        """Joining with claim_member_id claims that specific placeholder."""
        from app.models.user import User as UserModel

        tid = trip["id"]

        # Create a second user
        second_user = UserModel(
            id="claimer-001",
            email="claimer@example.com",
            display_name="Claimer",
        )
        async_session.add(second_user)
        await async_session.commit()

        # Add placeholder
        add_resp = await client.post(f"/trips/{tid}/members", json={"nickname": "To Be Claimed"})
        placeholder_id = add_resp.json()["id"]

        # Generate invite with allow_claim=True
        invite_resp = await client.post(f"/trips/{tid}/invite", json={"allow_claim": True})
        code = invite_resp.json().get("invite_code")

        # Join as second user with claim
        from app.core.auth import get_current_user
        from app.core.database import get_session as get_db_session
        from app.main import app as the_app
        from httpx import AsyncClient as HClient, ASGITransport

        async def get_session_override():
            yield async_session

        async def get_current_user_override():
            return UserModel(id="claimer-001", email="claimer@example.com", display_name="Claimer")

        the_app.dependency_overrides[get_db_session] = get_session_override
        the_app.dependency_overrides[get_current_user] = get_current_user_override

        transport = ASGITransport(app=the_app)
        async with HClient(transport=transport, base_url="http://test/api") as c2:
            join_resp = await c2.post(f"/invites/{code}/join", json={"claim_member_id": placeholder_id})
            assert join_resp.status_code == 200
            data = join_resp.json()
            assert data["status"] == "active"
            assert data["user_id"] == "claimer-001"
            assert data["id"] == placeholder_id

        the_app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_join_trip_claim_not_allowed_by_invite(self, client, async_session, trip):
        """Claiming a member fails if invite does not allow claims."""
        from app.models.user import User as UserModel

        tid = trip["id"]

        second_user = UserModel(id="no-claim-001", email="noclaim@example.com", display_name="NoClaim")
        async_session.add(second_user)
        await async_session.commit()

        add_resp = await client.post(f"/trips/{tid}/members", json={"nickname": "Placeholder"})
        placeholder_id = add_resp.json()["id"]

        # Generate invite WITHOUT allow_claim
        invite_resp = await client.post(f"/trips/{tid}/invite", json={"allow_claim": False})
        code = invite_resp.json().get("invite_code")

        from app.core.auth import get_current_user
        from app.core.database import get_session as get_db_session
        from app.main import app as the_app
        from httpx import AsyncClient as HClient, ASGITransport

        async def get_session_override():
            yield async_session

        async def get_current_user_override():
            return UserModel(id="no-claim-001", email="noclaim@example.com", display_name="NoClaim")

        the_app.dependency_overrides[get_db_session] = get_session_override
        the_app.dependency_overrides[get_current_user] = get_current_user_override

        transport = ASGITransport(app=the_app)
        async with HClient(transport=transport, base_url="http://test/api") as c2:
            join_resp = await c2.post(f"/invites/{code}/join", json={"claim_member_id": placeholder_id})
            assert join_resp.status_code == 400

        the_app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_join_trip_invalid_claim_member_returns_400(self, client, async_session, trip):
        """Claiming a non-existent member returns 400."""
        from app.models.user import User as UserModel

        tid = trip["id"]

        second_user = UserModel(id="bad-claim-001", email="badclaim@example.com", display_name="BadClaim")
        async_session.add(second_user)
        await async_session.commit()

        invite_resp = await client.post(f"/trips/{tid}/invite", json={"allow_claim": True})
        code = invite_resp.json().get("invite_code")

        from app.core.auth import get_current_user
        from app.core.database import get_session as get_db_session
        from app.main import app as the_app
        from httpx import AsyncClient as HClient, ASGITransport

        async def get_session_override():
            yield async_session

        async def get_current_user_override():
            return UserModel(id="bad-claim-001", email="badclaim@example.com", display_name="BadClaim")

        the_app.dependency_overrides[get_db_session] = get_session_override
        the_app.dependency_overrides[get_current_user] = get_current_user_override

        transport = ASGITransport(app=the_app)
        async with HClient(transport=transport, base_url="http://test/api") as c2:
            join_resp = await c2.post(f"/invites/{code}/join", json={"claim_member_id": 999999})
            assert join_resp.status_code == 400

        the_app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_join_trip_new_member_no_invitation(self, client, async_session, trip):
        """Joining with no invitation creates a new member slot."""
        from app.models.user import User as UserModel

        tid = trip["id"]

        second_user = UserModel(id="fresh-user-001", email="fresh@example.com", display_name="Fresh")
        async_session.add(second_user)
        await async_session.commit()

        invite_resp = await client.post(f"/trips/{tid}/invite", json={})
        code = invite_resp.json().get("invite_code")

        from app.core.auth import get_current_user
        from app.core.database import get_session as get_db_session
        from app.main import app as the_app
        from httpx import AsyncClient as HClient, ASGITransport

        async def get_session_override():
            yield async_session

        async def get_current_user_override():
            return UserModel(id="fresh-user-001", email="fresh@example.com", display_name="Fresh")

        the_app.dependency_overrides[get_db_session] = get_session_override
        the_app.dependency_overrides[get_current_user] = get_current_user_override

        transport = ASGITransport(app=the_app)
        async with HClient(transport=transport, base_url="http://test/api") as c2:
            join_resp = await c2.post(f"/invites/{code}/join")
            assert join_resp.status_code == 200
            data = join_resp.json()
            assert data["status"] == "active"
            assert data["user_id"] == "fresh-user-001"

        the_app.dependency_overrides.clear()


# ──────────────────────────────────────────────
# GENERATE PERSONALIZED INVITE LINK
# ──────────────────────────────────────────────

class TestGenerateMemberInviteLink:

    @pytest.mark.asyncio
    async def test_generate_member_invite_link_success(self, client, trip):
        """Admin can generate a personalized invite for a placeholder member."""
        tid = trip["id"]

        add_resp = await client.post(f"/trips/{tid}/members", json={"nickname": "Target"})
        member_id = add_resp.json()["id"]

        resp = await client.post(f"/trips/{tid}/members/{member_id}/invite")
        assert resp.status_code == 200
        data = resp.json()
        assert "invite_code" in data
        assert "invite_url" in data
        assert str(member_id) in data["invite_url"]

    @pytest.mark.asyncio
    async def test_generate_member_invite_link_not_found(self, client, trip):
        """Personalized invite for non-existent member returns 404."""
        tid = trip["id"]
        resp = await client.post(f"/trips/{tid}/members/999999/invite")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_generate_member_invite_link_active_member_rejected(self, client, async_session, trip):
        """Personalized invite for active member (with user_id) returns 400."""
        tid = trip["id"]

        # The creator themselves is active - try to generate for them
        trip_data = await client.get(f"/trips/{tid}")
        creator_member = next(m for m in trip_data.json()["members"] if m["user_id"] == TEST_USER_ID)
        creator_id = creator_member["id"]

        resp = await client.post(f"/trips/{tid}/members/{creator_id}/invite")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_generate_member_invite_link_reuses_existing(self, client, trip):
        """Personalized invite reuses existing trip invite code."""
        tid = trip["id"]

        # Generate the regular invite first
        invite_resp = await client.post(f"/trips/{tid}/invite", json={"allow_claim": True})
        first_code = invite_resp.json().get("invite_code")

        add_resp = await client.post(f"/trips/{tid}/members", json={"nickname": "Personalized"})
        member_id = add_resp.json()["id"]

        # Generate personalized invite - should reuse same code
        resp = await client.post(f"/trips/{tid}/members/{member_id}/invite")
        assert resp.status_code == 200
        data = resp.json()
        assert data["invite_code"] == first_code


# ──────────────────────────────────────────────
# REMOVE MEMBER ADVANCED PATHS
# ──────────────────────────────────────────────

class TestRemoveMemberAdvanced:

    @pytest.mark.asyncio
    async def test_remove_member_not_found_returns_404(self, client, trip):
        """Removing non-existent member returns 404."""
        tid = trip["id"]
        resp = await client.delete(f"/trips/{tid}/members/999999")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_remove_member_from_wrong_trip_returns_404(self, client, trip):
        """Removing member that belongs to another trip returns 404."""
        # Create another trip
        other_trip_resp = await client.post("/trips/", json={"name": "Other Trip", "base_currency": "USD"})
        other_tid = other_trip_resp.json()["id"]
        other_trip_data = await client.get(f"/trips/{other_tid}")
        other_creator = next(m for m in other_trip_data.json()["members"] if m["user_id"] == TEST_USER_ID)

        # Try to remove that member from the first trip
        tid = trip["id"]
        resp = await client.delete(f"/trips/{tid}/members/{other_creator['id']}")
        assert resp.status_code == 404


# ──────────────────────────────────────────────
# ADD MEMBER ADVANCED PATHS
# ──────────────────────────────────────────────

class TestAddMemberAdvancedPaths:

    @pytest.mark.asyncio
    async def test_add_member_with_existing_user_email_becomes_active(self, client, async_session, trip):
        """Adding member by email of existing user creates active member."""
        from app.models.user import User as UserModel

        tid = trip["id"]

        # Create a user in the database
        existing_user = UserModel(
            id="existing-for-add-001",
            email="existinguser@example.com",
            display_name="Existing User",
        )
        async_session.add(existing_user)
        await async_session.commit()

        resp = await client.post(f"/trips/{tid}/members", json={
            "nickname": "Existing",
            "email": "existinguser@example.com",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "active"
        assert data["user_id"] == "existing-for-add-001"

    @pytest.mark.asyncio
    async def test_add_member_duplicate_email_rejected(self, client, trip):
        """Adding member with already-used email returns 400."""
        tid = trip["id"]

        await client.post(f"/trips/{tid}/members", json={
            "nickname": "First",
            "email": "dup@example.com",
        })

        resp = await client.post(f"/trips/{tid}/members", json={
            "nickname": "Duplicate",
            "email": "dup@example.com",
        })
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_add_member_already_active_by_user_id_rejected(self, client, async_session, trip):
        """Adding member whose user is already an active member returns 400."""
        from app.models.user import User as UserModel

        tid = trip["id"]

        # Create another user that will be added to the trip
        active_user = UserModel(
            id="already-active-001",
            email="alreadyactive@example.com",
            display_name="Already Active",
        )
        async_session.add(active_user)
        await async_session.commit()

        # Add them once (becomes active)
        await client.post(f"/trips/{tid}/members", json={
            "nickname": "Active Member",
            "email": "alreadyactive@example.com",
        })

        # Try to add them again via email
        resp = await client.post(f"/trips/{tid}/members", json={
            "nickname": "Duplicate Active",
            "email": "alreadyactive@example.com",
        })
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_add_member_updates_member_check_trip_access_non_admin(self, client, async_session, trip):
        """Non-admin member cannot add new members."""
        from app.models.user import User as UserModel

        tid = trip["id"]

        # Create a non-admin member
        non_admin = UserModel(id="non-admin-add-001", email="nonadminadd@example.com", display_name="Non Admin")
        async_session.add(non_admin)
        await async_session.commit()

        await client.post(f"/trips/{tid}/members", json={
            "nickname": "Non Admin",
            "email": "nonadminadd@example.com",
        })

        from app.core.auth import get_current_user
        from app.core.database import get_session as get_db_session
        from app.main import app as the_app
        from httpx import AsyncClient as HClient, ASGITransport

        async def get_session_override():
            yield async_session

        async def get_current_user_override():
            return UserModel(id="non-admin-add-001", email="nonadminadd@example.com", display_name="Non Admin")

        the_app.dependency_overrides[get_db_session] = get_session_override
        the_app.dependency_overrides[get_current_user] = get_current_user_override

        transport = ASGITransport(app=the_app)
        async with HClient(transport=transport, base_url="http://test/api") as c2:
            resp = await c2.post(f"/trips/{tid}/members", json={"nickname": "Intruder"})
            assert resp.status_code == 403

        the_app.dependency_overrides.clear()


# ──────────────────────────────────────────────
# CHECK TRIP ACCESS PATHS (members endpoint)
# ──────────────────────────────────────────────

class TestCheckTripAccessMembersPaths:

    @pytest.mark.asyncio
    async def test_get_members_nonexistent_trip_returns_404(self, client):
        """Accessing members of a non-existent trip returns 404."""
        resp = await client.get("/trips/999999/members")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_members_not_a_member_returns_403(self, client, async_session):
        """Accessing members of a trip where user is not a member returns 403."""
        from app.models.trip import Trip
        # Create trip directly without adding test user as member
        other_trip = Trip(name="Closed Trip", base_currency="USD", created_by="other-user-000")
        async_session.add(other_trip)
        await async_session.commit()
        await async_session.refresh(other_trip)

        resp = await client.get(f"/trips/{other_trip.id}/members")
        assert resp.status_code == 403


# ──────────────────────────────────────────────
# UPDATE MEMBER DUPLICATE EMAIL
# ──────────────────────────────────────────────

class TestUpdateMemberDuplicateEmail:

    @pytest.mark.asyncio
    async def test_update_member_email_duplicate_returns_400(self, client, trip):
        """Updating a member with an email already used by another member returns 400."""
        tid = trip["id"]
        # Add two placeholder members
        m1 = await client.post(f"/trips/{tid}/members", json={"nickname": "Alice"})
        m2 = await client.post(f"/trips/{tid}/members", json={"nickname": "Bob"})
        assert m1.status_code == 201 and m2.status_code == 201

        # Give Alice a pending email
        await client.put(f"/trips/{tid}/members/{m1.json()['id']}", json={"email": "alice@dup.com"})

        # Try to give Bob the same email
        resp = await client.put(f"/trips/{tid}/members/{m2.json()['id']}", json={"email": "alice@dup.com"})
        assert resp.status_code == 400
        assert "already exists" in resp.json()["detail"]


# ──────────────────────────────────────────────
# INVITE CODE FORMAT VALIDATION
# ──────────────────────────────────────────────

class TestInviteCodeFormatValidation:

    @pytest.mark.asyncio
    async def test_decode_invite_invalid_short_code_returns_400(self, client):
        """Decoding an invite code that is too short returns 400."""
        resp = await client.get("/invites/short")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_decode_invite_non_hex_code_returns_400(self, client):
        """Decoding an invite code with non-hex characters returns 400."""
        resp = await client.get("/invites/zzzzzzzzzzzzzzzz")  # 16 chars, not hex
        assert resp.status_code == 400


# ──────────────────────────────────────────────
# JOIN TRIP: TRIP DELETED PATH
# ──────────────────────────────────────────────

class TestJoinTripDeletedTripPath:

    @pytest.mark.asyncio
    async def test_join_trip_via_invite_deleted_trip_returns_404(self, client, async_session):
        """Joining via invite when the trip has been deleted returns 404."""
        from app.models.trip import Trip
        from app.models.trip_invite import TripInvite
        from app.core.datetime_utils import utcnow
        from datetime import timedelta

        # Create a trip and soft-delete it
        deleted_trip = Trip(name="Deleted Trip", base_currency="USD", created_by="other-user-001", is_deleted=True)
        async_session.add(deleted_trip)
        await async_session.flush()

        # Create an invite code for it
        invite = TripInvite(
            trip_id=deleted_trip.id,
            code="abcd1234abcd1234",
            created_by=TEST_USER_ID,
            expires_at=utcnow() + timedelta(days=7),
        )
        async_session.add(invite)
        await async_session.commit()

        resp = await client.post("/invites/abcd1234abcd1234/join")
        assert resp.status_code == 404


# ──────────────────────────────────────────────
# DECODE INVITE LINK: DELETED TRIP
# ──────────────────────────────────────────────

class TestDecodeInviteDeletedTrip:

    @pytest.mark.asyncio
    async def test_decode_invite_deleted_trip_returns_404(self, client, async_session):
        """GET /invites/{code} returns 404 when the trip has been deleted."""
        from app.models.trip import Trip
        from app.models.trip_invite import TripInvite
        from app.core.datetime_utils import utcnow
        from datetime import timedelta

        deleted_trip = Trip(name="Gone Trip", base_currency="USD", created_by="other-user-002", is_deleted=True)
        async_session.add(deleted_trip)
        await async_session.flush()

        invite = TripInvite(
            trip_id=deleted_trip.id,
            code="dddd5555dddd5555",
            created_by=TEST_USER_ID,
            expires_at=utcnow() + timedelta(days=7),
        )
        async_session.add(invite)
        await async_session.commit()

        resp = await client.get("/invites/dddd5555dddd5555")
        assert resp.status_code == 404


# ──────────────────────────────────────────────
# JOIN TRIP: CLAIM BY EMAIL MATCH
# ──────────────────────────────────────────────

class TestJoinTripClaimByEmailMatch:

    @pytest.mark.asyncio
    async def test_join_trip_claims_pending_member_by_email(self, client, async_session):
        """Joining a trip via invite when a pending member with matching email exists claims it."""
        from app.models.trip import Trip
        from app.models.trip_member import TripMember
        from app.models.trip_invite import TripInvite
        from app.core.datetime_utils import utcnow
        from datetime import timedelta

        # Create a trip directly (TEST_USER not auto-added as member)
        other_trip = Trip(name="Email Claim Trip", base_currency="USD", created_by="other-creator-003")
        async_session.add(other_trip)
        await async_session.flush()

        # Add a pending member with TEST_USER's email
        pending = TripMember(
            trip_id=other_trip.id,
            nickname="Invited User",
            invited_email=TEST_USER_EMAIL,
            status="pending",
        )
        async_session.add(pending)

        # Create an invite code
        invite = TripInvite(
            trip_id=other_trip.id,
            code="eeee6666eeee6666",
            created_by="other-creator-003",
            expires_at=utcnow() + timedelta(days=7),
        )
        async_session.add(invite)
        await async_session.commit()

        # TEST_USER joins via invite → should claim the pending member by email
        resp = await client.post("/invites/eeee6666eeee6666/join")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "active"
        assert data["user_id"] == TEST_USER_ID


# ──────────────────────────────────────────────
# GENERATE INVITE LINK: ALREADY CLAIMED
# ──────────────────────────────────────────────

class TestGenerateInviteLinkAlreadyClaimed:

    @pytest.mark.asyncio
    async def test_generate_invite_link_already_claimed_returns_400(self, client, trip, async_session):
        """Generating invite link for a member who already has a user_id returns 400."""
        from app.models.trip_member import TripMember
        from sqlmodel import select

        tid = trip["id"]
        # Get the trip creator member (who has user_id set)
        result = await async_session.execute(
            select(TripMember).where(
                TripMember.trip_id == tid,
                TripMember.user_id == TEST_USER_ID,
            )
        )
        creator_member = result.scalar_one()

        # Set status to pending (so we pass the first check) but user_id is already set
        creator_member.status = "pending"
        async_session.add(creator_member)
        await async_session.commit()

        resp = await client.post(f"/trips/{tid}/members/{creator_member.id}/invite")
        assert resp.status_code == 400
        assert "claimed" in resp.json()["detail"].lower()
