import test from "node:test";
import assert from "node:assert/strict";
import {readCookie, safeReturnPath, sessionCookie} from "./organizer-auth.mjs";

test("only accepts an in-site return path", () => {
  assert.equal(safeReturnPath("/games/where-winds-meet/guild-war/teams"), "/games/where-winds-meet/guild-war/teams");
  assert.equal(safeReturnPath("https://example.com"), "/games/where-winds-meet/guild-war/teams");
  assert.equal(safeReturnPath("//example.com"), "/games/where-winds-meet/guild-war/teams");
});

test("reads the opaque organizer session cookie only", () => {
  assert.equal(readCookie("theme=night; pom_organizer_session=abc123; other=value", "pom_organizer_session"), "abc123");
  assert.equal(readCookie(null, "pom_organizer_session"), null);
});

test("session cookie is scoped securely to this site", () => {
  const cookie = sessionCookie("abc123");
  assert.match(cookie, /^pom_organizer_session=abc123;/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\//);
});

import {organizerAuthApi} from "./organizer-auth.mjs";

test("rejects backslash and control-character return paths", () => {
  for (const path of ["/\\\\evil.example", "/\n/evil.example", "/\t/evil.example"]) {
    assert.equal(safeReturnPath(path), "/games/where-winds-meet/guild-war/teams");
  }
});

test("login binds callback to browser and consumes state once", async () => {
  const states = new Map();
  const db = {
    prepare(sql) {
      return {bind(...args) {
        return {
          async all() {
            if (sql.startsWith("SELECT return_path")) return {results: states.has(args[0]) ? [{return_path: states.get(args[0])}] : []};
            return {results: [{discord_user_id: "organizer"}]};
          },
          async run() {
            return {meta: {changes: states.delete(args[0]) ? 1 : 0}};
          },
          sql, args,
        };
      }};
    },
    async batch(statements) {
      for (const s of statements) if (s.sql.startsWith("INSERT INTO oauth_states")) states.set(s.args[0], s.args[1]);
      return [];
    },
  };
  const env = {GUILD_WAR_DB: db, DISCORD_CLIENT_ID: "id", DISCORD_CLIENT_SECRET: "secret"};
  const origin = "https://preview.example";
  const login = await organizerAuthApi(new Request(origin + "/api/auth/discord/login?return=/teams"), env);
  assert.equal(login.status, 302);
  const cookie = login.headers.get("Set-Cookie");
  assert.match(cookie, /__Host-pom_oauth_state=/);
  assert.match(cookie, /HttpOnly; Secure; SameSite=Lax/);
  assert.equal(login.headers.get("Cache-Control"), "no-store");
  const state = new URL(login.headers.get("Location")).searchParams.get("state");
  const callback = origin + "/api/auth/discord/callback?code=code&state=" + state;
  assert.equal((await organizerAuthApi(new Request(callback), env)).status, 400);
  assert.equal((await organizerAuthApi(new Request(callback, {headers: {Cookie: "__Host-pom_oauth_state=wrong"}}), env)).status, 400);
  assert.equal(states.size, 1);
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {calls++; return Response.json(calls === 1 ? {access_token: "token"} : {id: "organizer"});};
  try {
    const request = () => new Request(callback, {headers: {Cookie: cookie.split(";")[0]}});
    const response = await organizerAuthApi(request(), env);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("Location"), "/teams");
    assert.equal(response.headers.getSetCookie().length, 2);
    assert.equal((await organizerAuthApi(request(), env)).status, 400);
    assert.equal(calls, 2);
    assert.equal((await organizerAuthApi(new Request(origin + "/api/auth/discord/logout", {method: "POST", headers: {Origin: "https://other.example"}}), env)).status, 403);
    assert.equal((await organizerAuthApi(new Request(origin + "/api/auth/discord/logout", {method: "POST", headers: {Origin: origin}}), env)).status, 204);
  } finally {globalThis.fetch = originalFetch;}
});
