#!/usr/bin/env bash
# Applies the stub + migrations to a THROWAWAY database and runs the RLS tests. Needs a local PostgreSQL 14+ and a superuser.
#   PGUSER=postgres bash supabase/tests/run_rls_tests.sh
set -euo pipefail
cd "$(dirname "$0")"
DB=${TEST_DB:-illuminate_rls_test}
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
for f in 00_supabase_stub.sql ../migrations/20261101000001_core_schema.sql ../migrations/20261101000002_rls_and_grants.sql ../migrations/20261101000003_seed_demo_data.sql; do
  psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f" >/dev/null
done
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f rls.test.sql
