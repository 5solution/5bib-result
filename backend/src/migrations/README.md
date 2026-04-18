# Backend Migrations

Manual SQL migrations — run with `mysql` client against the target DB.

## Team Management (volunteer DB)

```bash
# 1. Backup first (production only)
mysqldump -h <host> -u <user> -p <volunteer_db> > backup_$(date +%Y%m%d).sql

# 2. Apply init
mysql -h <host> -u <user> -p <volunteer_db> < src/migrations/sql/001-team-management-init.sql

# 3. Verify
mysql -h <host> -u <user> -p <volunteer_db> -e "SHOW TABLES LIKE 'vol\_%';"
```

Rollback (destructive — only if needed):

```bash
mysql -h <host> -u <user> -p <volunteer_db> < src/migrations/sql/001-team-management-rollback.sql
```

Entity schemas in `src/modules/team-management/entities/` must stay in sync
with the SQL above. `synchronize: false` is enforced at the module level.
