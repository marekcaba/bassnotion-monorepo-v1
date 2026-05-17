# Restore Runbook

> **Use this when:** rehearsing the disaster-recovery path, or actually
> recovering a corrupted Supabase project. The steps are the same; only the
> source/target swaps.
>
> **Last drilled:** 2026-05-17 — restored production into staging successfully
> in ~5 minutes (92 rows across 29 tables, schema + data + RLS policies).
> Initial run used `--no-acl` and broke staging GRANTs; runbook updated
> immediately after to drop that flag (see Step 4) and to document the
> manual GRANT-reapply recovery in Step 7b.

---

## What this runbook is and isn't

**Is:** a `pg_dump` → `psql` restore of the `public` schema between two
Supabase projects. Validates that we can recover application data into a
clean target.

**Is not:**

- A restore of `auth.users`, `storage.objects`, or Supabase-managed schemas —
  those need either Supabase's dashboard "Restore from backup" or a full
  cluster-level dump (paid PITR feature).
- A restore of object-storage files (Bunny Stream, Supabase Storage buckets).
  Storage buckets are managed separately.
- An incremental restore. This wipes the target's `public` schema and
  reapplies from scratch.

---

## Prerequisites (one-time)

1. **PostgreSQL 17 client tools** (Supabase runs PG17, PG14 client will fail
   with a version mismatch):

   ```bash
   brew install postgresql@17
   # Keg-only; full path is /opt/homebrew/opt/postgresql@17/bin/{pg_dump,psql}
   ```

2. **DB passwords for both projects.** Available in:
   - Password manager (saved during initial project setup)
   - Supabase dashboard → Settings → Database → "Reset database password"
   - **Resetting prod password breaks Railway prod backend until you update
     `DATABASE_URL` in Railway → Production env vars and redeploy.**

3. **`jq` installed** (used to URL-encode the password into the connection
   string — Supabase passwords often contain `@`, `!`, `/`, etc.).

---

## The drill

### Step 1 — Drop passwords into a temp env file

**Do this in your terminal, never paste passwords into chat:**

```bash
cat > /tmp/restore-drill.env <<'EOF'
PROD_DB_PWD='your-production-password-here'
STAGING_DB_PWD='your-staging-password-here'
EOF
chmod 600 /tmp/restore-drill.env
```

Verify (does not print the values):

```bash
. /tmp/restore-drill.env && echo "PROD set: ${PROD_DB_PWD:+yes}; STAGING set: ${STAGING_DB_PWD:+yes}"
# Expected: PROD set: yes; STAGING set: yes
```

### Step 2 — Test both connections

Pick connection format based on whether your environment has IPv6:

**Direct connection** (`db.<project-ref>.supabase.co:5432`) — works from
most local shells, but the host is **IPv6-only** in DNS. Use this if your
machine has IPv6 connectivity:

```bash
. /tmp/restore-drill.env
PROD_DB_PWD_ENC=$(printf '%s' "$PROD_DB_PWD" | jq -rR @uri)
STAGING_DB_PWD_ENC=$(printf '%s' "$STAGING_DB_PWD" | jq -rR @uri)
PROD_URL="postgresql://postgres:${PROD_DB_PWD_ENC}@db.iuuplfrktnzsbzibpfjm.supabase.co:5432/postgres"
STAGING_URL="postgresql://postgres:${STAGING_DB_PWD_ENC}@db.vraxryaaznpkvtkindpn.supabase.co:5432/postgres"
```

**Pooler connection** (IPv4) — fallback when the direct hosts can't be
reached (sandboxed shells, CI runners without IPv6, etc.). Note the
tenant-qualified username `postgres.<project-ref>`:

```bash
PROD_URL="postgresql://postgres.iuuplfrktnzsbzibpfjm:${PROD_DB_PWD_ENC}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
STAGING_URL="postgresql://postgres.vraxryaaznpkvtkindpn:${STAGING_DB_PWD_ENC}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
```

Both projects are in `eu-west-1` despite the legacy `us-east-1`
placeholder in `apps/backend/.env`. Port 5432 is session-mode (use for
admin work like dump/restore); port 6543 is transaction-mode (don't use
for restores — it breaks on multi-statement scripts).

```bash
# Quick smoke test (works for either URL form):
/opt/homebrew/opt/postgresql@17/bin/psql "$PROD_URL" -c "SELECT current_database();"
/opt/homebrew/opt/postgresql@17/bin/psql "$STAGING_URL" -c "SELECT current_database();"
```

Both should return `postgres`.

### Step 3 — Snapshot source row counts (for verification later)

```bash
COUNT_SQL=$'DO $$
DECLARE
  r record;
  cnt bigint;
  total bigint := 0;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname=\'public\' ORDER BY 1 LOOP
    EXECUTE format(\'SELECT count(*) FROM public.%I\', r.tablename) INTO cnt;
    RAISE NOTICE \'%-40s %s\', r.tablename, cnt;
    total := total + cnt;
  END LOOP;
  RAISE NOTICE \'TOTAL: %\', total;
END $$;'

/opt/homebrew/opt/postgresql@17/bin/psql "$PROD_URL" -c "$COUNT_SQL" 2>&1 | grep -E "NOTICE|TOTAL" > /tmp/source-rowcounts.txt
cat /tmp/source-rowcounts.txt
```

**Don't use `pg_stat_user_tables.n_live_tup`** — it's a stale estimate updated
by autovacuum. Use `COUNT(*)` for verification.

### Step 4 — Dump source

```bash
/opt/homebrew/opt/postgresql@17/bin/pg_dump "$PROD_URL" \
  --schema=public \
  --no-owner \
  --no-publications \
  --no-subscriptions \
  --file=/tmp/source-public-dump.sql

ls -lh /tmp/source-public-dump.sql
```

Expected size for our current data: ~280-300 KB.

**Flag explanations:**

- `--schema=public` — only application data, not Supabase-managed `auth`,
  `storage`, etc.
- `--no-owner` — don't reapply prod owner roles to target.
- `--no-publications` / `--no-subscriptions` — don't carry over logical
  replication setup.
- **NOT `--no-acl`** — earlier versions of this runbook included it; that
  broke staging's backend by stripping the GRANTs Supabase's `service_role`
  needs to read `public` tables (see Step 7b). Including the ACL block
  carries over prod's GRANTs verbatim, and since both projects use the
  same canonical role names (`anon`, `authenticated`, `service_role`),
  they apply cleanly to the target.

### Step 5 — Wipe target schema

```bash
/opt/homebrew/opt/postgresql@17/bin/psql "$STAGING_URL" -c "
  DROP SCHEMA public CASCADE;
  CREATE SCHEMA public;
  GRANT ALL ON SCHEMA public TO postgres;
  GRANT ALL ON SCHEMA public TO public;
"

# Verify empty:
/opt/homebrew/opt/postgresql@17/bin/psql "$STAGING_URL" \
  -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
# Expected: 0
```

### Step 6 — Restore

```bash
/opt/homebrew/opt/postgresql@17/bin/psql "$STAGING_URL" -f /tmp/source-public-dump.sql 2>&1 | tail -5
```

**Errors to expect** (none should appear on the FIRST run after a clean wipe):

- `schema "public" already exists` — only if you re-run without wiping first.
- `function "X" already exists` — same.

A clean run produces only `CREATE`/`ALTER`/`COPY`/`INSERT`/`GRANT` lines.

### Step 7 — Verify target matches source

```bash
/opt/homebrew/opt/postgresql@17/bin/psql "$STAGING_URL" -c "$COUNT_SQL" 2>&1 | grep -E "NOTICE|TOTAL" > /tmp/target-rowcounts.txt

diff /tmp/source-rowcounts.txt /tmp/target-rowcounts.txt && echo "✅ MATCH"
# No output from diff + "✅ MATCH" line = perfect.
```

### Step 7b — Only if you used `--no-acl` (see Step 4)

If you used the older `--no-acl` form of `pg_dump`, the Supabase backend
will lose SELECT on every `public` table and `/api/health` will fail with
`permission denied for table exercises`. The newer Step 4 (without
`--no-acl`) makes this step unnecessary, but it's documented here in case
you need to recover an existing target.

**Don't try `supabase db push` for this** — Supabase's migration history
table still has all the entries, so the CLI reports "Remote database is up
to date" and applies nothing. Migrations are also not fully idempotent
(some `CREATE POLICY` statements have no `IF NOT EXISTS`), so forcing a
replay by truncating `schema_migrations` errors out mid-way.

**Working recovery — apply the GRANTs directly:**

```bash
/opt/homebrew/opt/postgresql@17/bin/psql "$STAGING_URL" <<'SQL'
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
SQL
```

Verify staging backend health recovers (Railway re-tries the DB on each
request; no restart needed):

```bash
curl -s https://backend-staging-4d19.up.railway.app/api/health | jq -r '.status'
# Expected: "healthy"
```

### Step 8 — Cleanup

```bash
rm /tmp/restore-drill.env /tmp/source-public-dump.sql \
   /tmp/source-rowcounts.txt /tmp/target-rowcounts.txt
```

---

## Real disaster recovery — what's different

If you're recovering production from a corrupted state (vs drilling
prod → staging), the changes are:

1. **Pull the dump from a real Supabase backup, not live prod.** Supabase
   dashboard → Project → Database → Backups → download the latest backup
   file. Use that file in step 6 instead of running `pg_dump` in step 4.

2. **`auth.users` and `storage.objects` aren't in the `public`-schema dump.**
   Supabase's dashboard "Restore from backup" handles those automatically.
   If you're doing a manual pg-level restore, you need a full cluster dump,
   which requires the paid PITR feature or a custom backup pipeline.

3. **Application caches need to be invalidated.** After restoring prod:
   - Restart Railway backend (clears in-memory caches, including the
     `RateLimitGuard` counter store)
   - Invalidate Vercel ISR cache (purge from dashboard or trigger a redeploy)
   - Re-issue Supabase service-role key if you suspect the leak that caused
     the incident exposed it

4. **DNS / Stripe / Sentry don't need restoring.** They live elsewhere.

---

## Things to know about Supabase free-tier backups

- **Daily logical backups, 7-day retention** (visible in dashboard →
  Project → Database → Backups).
- **No PITR** on free tier — restore granularity is "yesterday's snapshot,"
  not "right before the incident." Acceptable for our risk profile pre-LIVE.
- **Backups are taken at ~02:00 UTC** for our region (West EU). The
  freshest data on tap is whatever existed at the last 02:00 UTC tick.

If/when we upgrade to a paid tier, enable PITR (`supabase backups list
--project-ref <ref>` will then show non-zero EARLIEST/LATEST timestamps and
`supabase backups restore` becomes usable).
