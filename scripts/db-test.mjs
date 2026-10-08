// Applies every supabase/migrations/*.sql to PGlite (real Postgres in Wasm)
// with a minimal stub of Supabase's auth schema and roles, then runs
// supabase/tests/*.sql. No Docker, no Supabase project, no cost.
//
// Adapted from the supabase-multitenant-saas kit's scripts/run.mjs.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase", "migrations");
const testsDir = path.join(root, "supabase", "tests");

export const supabaseStub = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema extensions;
grant usage on schema public, extensions, auth to anon, authenticated;
create table auth.users (
  id uuid primary key, instance_id uuid, aud text, role text, email text,
  email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;
-- Minimal stub of Supabase Storage: just what policies and tests touch.
-- Like the real one, storage.objects has RLS on and full table grants to
-- anon/authenticated, so the policies are the only thing deciding access.
create schema storage;
create table storage.buckets (
  id text primary key, name text not null, public boolean not null default false,
  file_size_limit bigint, allowed_mime_types text[], owner uuid,
  created_at timestamptz default now(), updated_at timestamptz default now());
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id), name text, owner uuid, metadata jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  last_accessed_at timestamptz);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant all on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant execute on function storage.foldername(text) to anon, authenticated;
-- Same guard as real Supabase: SQL deletes are refused unless the session sets
-- storage.allow_delete_query, which only the Storage API does. RLS still applies.
create function storage.protect_delete() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('storage.allow_delete_query', true), 'false') <> 'true' then
    raise exception 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
      using errcode = '42501';
  end if;
  return null;
end $$;
create trigger protect_objects_delete before delete on storage.objects
  for each statement execute function storage.protect_delete();
-- Supabase's default privileges for objects created by postgres in public
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

export function migrationFiles() {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

export async function freshDb({ mutate } = {}) {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(supabaseStub);
  for (const file of migrationFiles()) {
    let sql = readFileSync(path.join(migrationsDir, file), "utf8");
    if (mutate) sql = mutate(sql, file);
    try {
      await db.exec(sql);
    } catch (e) {
      throw new Error(`${file}: ${e.message}`);
    }
  }
  return db;
}

export function testFiles() {
  return readdirSync(testsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => ({ name: f, sql: readFileSync(path.join(testsDir, f), "utf8") }));
}

/**
 * Each test file ends by raising, so everything it wrote rolls back.
 * Success is an error message starting with ISOLATION_OK.
 */
export async function runTest(db, sql) {
  try {
    await db.exec(sql);
    return { ok: false, message: "test did not raise — it must end with a raise" };
  } catch (e) {
    return { ok: e.message.startsWith("ISOLATION_OK"), message: e.message };
  }
}

// Running this file directly = apply migrations, run every test.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const db = await freshDb();
  console.log(`migrations applied: ${migrationFiles().join(", ")}`);

  let failed = 0;
  for (const { name, sql } of testFiles()) {
    const { ok, message } = await runTest(db, sql);
    console.log(ok ? `PASS  ${name}  ${message}` : `FAIL  ${name}  ${message}`);
    if (!ok) failed++;
  }

  const { rows } = await db.query("select count(*)::int as n from auth.users");
  if (rows[0].n !== 0) {
    console.log(`FAIL  rollback: ${rows[0].n} users left behind`);
    failed++;
  }

  process.exitCode = failed ? 1 : 0;
  console.log(failed ? `\n${failed} failing` : "\nall green");
}
