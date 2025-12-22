# Database Migrations - Quick Start

Quick reference for managing database schema changes with Alembic + Supabase.

## 🚀 Quick Commands

```bash
cd backend
source venv/bin/activate

# Or use the helper script:
./migrate.sh [command]
```

## 📝 Common Operations

### Create Initial Migration

```bash
# First time setup - creates all tables
./migrate.sh create "Initial schema"

# Or directly:
alembic revision --autogenerate -m "Initial schema"
```

### Add a New Column

```python
# 1. Update your model
class User(SQLModel, table=True):
    # ... existing fields ...
    phone: Optional[str] = None  # New field
```

```bash
# 2. Generate migration
./migrate.sh create "Add phone to users"

# 3. Review the generated file
cat alembic/versions/*_add_phone*.py

# 4. Apply
./migrate.sh upgrade
```

### Apply Migrations

```bash
# Apply all pending
./migrate.sh upgrade

# Apply one at a time
./migrate.sh upgrade-one

# Check what will run (dry-run)
./migrate.sh sql
```

### Check Status

```bash
# Current version
./migrate.sh current

# History
./migrate.sh history

# Pending migrations
./migrate.sh pending
```

### Rollback

```bash
# Rollback last migration
./migrate.sh downgrade

# Or directly:
alembic downgrade -1
```

## 🔧 Helper Script Commands

```bash
./migrate.sh create "message"     # Auto-generate migration
./migrate.sh manual "message"     # Empty migration template
./migrate.sh upgrade              # Apply all pending
./migrate.sh upgrade-one          # Apply next only
./migrate.sh downgrade            # Rollback last
./migrate.sh current              # Show current version
./migrate.sh history              # Show all migrations
./migrate.sh pending              # Check for pending
./migrate.sh sql                  # Show SQL (dry-run)
./migrate.sh reset                # Reset DB (DANGEROUS!)
```

## ⚠️ Important Rules

1. **Always review** auto-generated migrations
2. **Never edit** applied migrations (create new ones)
3. **Test locally** before production
4. **Backup database** before major migrations
5. **Version control** all migration files

## 🗄️ Database URLs

### Local SQLite (auto-creates tables)

```bash
DATABASE_URL=sqlite:///./velo.db
```

### Supabase PostgreSQL (use migrations!)

```bash
DATABASE_URL=postgresql://postgres:password@db.project.supabase.co:5432/postgres
```

## 📋 Checklist for Model Changes

- [ ] Update the SQLModel class
- [ ] Import in `alembic/env.py` (if new model)
- [ ] Generate migration: `./migrate.sh create "description"`
- [ ] Review generated file
- [ ] Test locally: `./migrate.sh upgrade`
- [ ] Commit migration file to git
- [ ] Apply to production

## 🎯 Example Workflow

```bash
# 1. Make model changes
vim app/models/user.py

# 2. Generate migration
./migrate.sh create "Add user preferences"

# 3. Review (IMPORTANT!)
cat alembic/versions/20241222_1430-abc123_add_user_preferences.py

# 4. Apply locally
./migrate.sh upgrade

# 5. Test your app
python app/main.py

# 6. If good, commit
git add alembic/versions/*
git commit -m "Add user preferences migration"

# 7. Deploy and apply to production
# (In production)
./migrate.sh upgrade
```

## 🆘 Troubleshooting

### "Can't locate revision"

```bash
# Database and migration files out of sync
./migrate.sh current  # Check current version
alembic history       # Check migration files
```

### "Target database is not up to date"

```bash
# Apply pending migrations
./migrate.sh upgrade
```

### Migration doesn't detect changes

```bash
# Some changes need manual migration
./migrate.sh manual "Describe the change"
# Edit the file manually
./migrate.sh upgrade
```

### Start fresh (local only!)

```bash
# WARNING: Destroys all data
rm velo.db  # SQLite only
./migrate.sh reset
```

## 📚 Full Documentation

See [MIGRATIONS.md](./MIGRATIONS.md) for:

- Detailed explanations
- Complex scenarios
- Data migrations
- Supabase-specific notes
- Best practices
- Troubleshooting

---

**Remember:** Migrations are your safety net. Use them! 🚀
