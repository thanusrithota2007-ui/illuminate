#!/usr/bin/env bash
# Service-layer integration test against real PostgreSQL + PostgREST (https://postgrest.org). NOT a real Supabase project:
# GoTrue (auth) is replaced by a tiny proxy and locally signed JWTs. It proves the frontend's queries work with our schema + RLS.
#   PGUSER=postgres POSTGREST_BIN=/path/to/postgrest bash supabase/tests/run_integration.sh
set -euo pipefail
cd "$(dirname "$0")"; DB=illuminate_it; SECRET=${JWT_SECRET:-test-secret-test-secret-test-secret-123456}
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
for f in 00_supabase_stub.sql ../migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f" >/dev/null; done
psql -v ON_ERROR_STOP=1 -q -d postgres -c "do \$\$ begin if not exists (select from pg_roles where rolname='authenticator') then create role authenticator login noinherit password 'pw'; end if; end \$\$; grant anon, authenticated to authenticator;" >/dev/null
psql -v ON_ERROR_STOP=1 -q -d "$DB" -c "insert into auth.users (id, raw_user_meta_data) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','{\"display_name\":\"Alice\"}'),('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','{\"display_name\":\"Bob\"}')"
cat > /tmp/pgrst.conf <<CONF
db-uri = "postgres://authenticator:pw@127.0.0.1:5432/$DB"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SECRET"
server-port = 3000
CONF
"${POSTGREST_BIN:-postgrest}" /tmp/pgrst.conf >/tmp/pgrst.log 2>&1 & PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
for i in $(seq 1 30); do curl -sf http://127.0.0.1:3000/ >/dev/null && break; sleep 0.5; done
cd ../../frontend && JWT_SECRET="$SECRET" node tests/integration/services.it.mjs
