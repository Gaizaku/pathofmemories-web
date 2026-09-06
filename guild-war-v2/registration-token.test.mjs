import test from "node:test";
import assert from "node:assert/strict";
import {createClaimToken, hashClaimToken, hasMatchingClaim} from "./registration-token.mjs";

test("claim tokens are unique URL-safe random values", () => {
  const first = createClaimToken();
  const second = createClaimToken();
  assert.match(first, /^[A-Za-z0-9_-]{40,}$/);
  assert.notEqual(first, second);
});

test("only a token matching its stored hash is accepted", async () => {
  const token = createClaimToken();
  const hash = await hashClaimToken(token);
  assert.equal(await hasMatchingClaim(token, hash), true);
  assert.equal(await hasMatchingClaim(createClaimToken(), hash), false);
});
