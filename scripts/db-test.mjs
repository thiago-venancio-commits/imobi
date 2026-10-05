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
