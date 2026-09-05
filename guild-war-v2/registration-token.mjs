const encoder = new TextEncoder();

export function createClaimToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export async function hashClaimToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hasMatchingClaim(token, storedHash) {
  if (typeof token !== "string" || token.length < 32 || typeof storedHash !== "string") return false;
  return (await hashClaimToken(token)) === storedHash;
}
