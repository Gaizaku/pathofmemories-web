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
