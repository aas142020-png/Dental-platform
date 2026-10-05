#!/usr/bin/env bash
# LOCAL HARNESS: apply migrations + seed to a scratch database and run pgTAP tests.
# On a real project use `supabase db reset && supabase test db` instead.
set -euo pipefail
DB=${DB:-dental_platform_test}
HERE="$(cd "$(dirname "$0")/.." && pwd)"
psql -v ON_ERROR_STOP=1 -q -c "drop database if exists $DB" -c "create database $DB" postgres
P="psql -v ON_ERROR_STOP=1 -q -d $DB"
$P -c "create extension if not exists pgcrypto" -c "create extension if not exists pgtap"
$P -f "$HERE/harness/00_supabase_stub.sql"
for f in "$HERE"/migrations/*.sql; do echo "migrate $(basename "$f")"; $P -f "$f"; done
$P -f "$HERE/seed.sql"
echo "--- tests"
pg_prove -d "$DB" "$HERE"/tests/*.sql
