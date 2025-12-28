# Debt Test Suite

This directory contains comprehensive tests for the debt management functionality.

## Prerequisites

```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx aiosqlite
```

## Running Tests

```bash
# Run all debt tests
cd backend
pytest tests/debt/ -v

# Run specific test class
pytest tests/debt/test_debt_management.py::TestSettlementUpdates -v

# Run with output
pytest tests/debt/ -v -s
```

## Test Structure

### `conftest.py`

Async fixtures:

- `async_engine` - In-memory SQLite async engine
- `async_session` - Database session for each test
- `async_client` - HTTP client with mocked auth
- `test_trip` - Pre-created trip
- `test_members` - Two members (Alice, Bob)

### `test_debt_management.py`

| Class                   | Tests                                                          |
| ----------------------- | -------------------------------------------------------------- |
| `TestSettlementUpdates` | Settlement creation, currency changes, phantom debt prevention |
| `TestSingleMergeDebt`   | Merge full/partial debt to another currency                    |
| `TestOneClickMerge`     | Convert all debts to single currency                           |
| `TestEdgeCases`         | Self-payment, zero amounts, expense deletion                   |

## Key Scenarios

### Settlement Currency Change

```
1. A pays $1000 hotel (B owes A $500)
2. B settles $100 USD
3. B changes settlement to 100 CNY
4. B changes back to 100 USD
→ Verify: No phantom CNY debt remains
```

### Single Merge Debt

```
1. B owes A $100 USD
2. Merge $50 USD → EUR at 0.92 rate
→ Result: B owes A $50 USD + €46 EUR
```

### One-Click Convert

```
1. Multi-currency debts exist (USD, EUR, CNY)
2. Convert all to USD
→ Result: All debts consolidated in USD
```

## Environment Variables

Tests auto-set these, but you can override:

```bash
export DATABASE_URL=sqlite+aiosqlite:///:memory:
export SUPABASE_URL=http://localhost:54321
export SUPABASE_ANON_KEY=test-key
```
