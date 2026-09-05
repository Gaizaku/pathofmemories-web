import {discordAuthorizeUrl, randomUrlToken, sha256} from "./discord-oauth.mjs";

const json = (body, status = 200) => Response.json(body, {
  status,
  headers: {"Cache-Control": "no-store"},
});

const SESSION_COOKIE = "pom_organizer_session";
const STATE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function utcAfter(milliseconds) {
  return new Date(Date.now() + milliseconds).toISOString();
}

async function all(db, sql, ...params) {
  const result = await db.prepare(sql).bind(...params).all();
  if (result.success === false) throw new Error("query_failed");
  return result.results;
}

async function run(db, sql, ...params) {
  const result = await db.prepare(sql).bind(...params).run();
  if (result.success === false) throw new Error("query_failed");
  return result;
}

export function safeReturnPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/games/where-winds-meet/guild-war/teams";
  return value;
}

export function readCookie(header, name) {
  if (!header) return null;
  for (const entry of header.split(";")) {
    const [key, ...value] = entry.trim().split("=");
    if (key === name) return value.join("=") || null;
  }
  return null;
}

export function sessionCookie(value, maxAge = SESSION_TTL_SECONDS) {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function callbackUrl(request) {
  const url = new URL(request.url);
  return `${url.origin}/api/auth/discord/callback`;
}

async function activeOrganizer(env, request) {
  const session = readCookie(request.headers.get("Cookie"), SESSION_COOKIE);
  if (!session) return null;
  const [organizer] = await all(env.GUILD_WAR_DB,
    "SELECT o.discord_user_id AS id, o.display_name AS displayName FROM organizer_sessions s JOIN organizers o ON o.discord_user_id = s.discord_user_id WHERE s.session_hash = ? AND s.expires_at > ? AND o.enabled = 1",
    await sha256(session), new Date().toISOString());
  return organizer || null;
}

async function exchangeDiscordCode(env, request, code) {
  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl(request),
    }),
  });
  if (!response.ok) throw new Error("token_exchange_failed");
  const token = await response.json();
  if (!token?.access_token || typeof token.access_token !== "string") throw new Error("token_missing");

  const profileResponse = await fetch("https://discord.com/api/v10/users/@me", {
    headers: {Authorization: `Bearer ${token.access_token}`},
  });
  if (!profileResponse.ok) throw new Error("profile_fetch_failed");
  const profile = await profileResponse.json();
  if (!profile?.id || typeof profile.id !== "string") throw new Error("profile_missing");
  return profile;
}

export async function organizerAuthApi(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/auth/discord/")) return null;
  if (!env.GUILD_WAR_DB || !env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return json({error: "auth_not_configured"}, 503);
  }

  try {
    if (url.pathname === "/api/auth/discord/login") {
      if (request.method !== "GET") return new Response(null, {status: 405, headers: {Allow: "GET"}});
      const state = randomUrlToken();
      const returnPath = safeReturnPath(url.searchParams.get("return"));
      const now = new Date().toISOString();
      await env.GUILD_WAR_DB.batch([
        env.GUILD_WAR_DB.prepare("DELETE FROM oauth_states WHERE expires_at <= ?").bind(now),
        env.GUILD_WAR_DB.prepare("INSERT INTO oauth_states (state_hash, return_path, expires_at) VALUES (?, ?, ?)")
          .bind(await sha256(state), returnPath, utcAfter(STATE_TTL_MS)),
      ]);
      return Response.redirect(discordAuthorizeUrl({
        clientId: env.DISCORD_CLIENT_ID,
        redirectUri: callbackUrl(request),
        state,
      }), 302);
    }

    if (url.pathname === "/api/auth/discord/callback") {
      if (request.method !== "GET") return new Response(null, {status: 405, headers: {Allow: "GET"}});
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      if (!code || !state || code.length > 512 || state.length > 128) return json({error: "invalid_callback"}, 400);

      const stateHash = await sha256(state);
      const now = new Date().toISOString();
      const [savedState] = await all(env.GUILD_WAR_DB,
        "SELECT return_path FROM oauth_states WHERE state_hash = ? AND expires_at > ?", stateHash, now);
      if (!savedState) return json({error: "invalid_or_expired_state"}, 400);
      await run(env.GUILD_WAR_DB, "DELETE FROM oauth_states WHERE state_hash = ?", stateHash);

      const profile = await exchangeDiscordCode(env, request, code);
      const [organizer] = await all(env.GUILD_WAR_DB,
        "SELECT discord_user_id FROM organizers WHERE discord_user_id = ? AND enabled = 1", profile.id);
      if (!organizer) return json({error: "organizer_access_required"}, 403);

      const session = randomUrlToken();
      const expiresAt = utcAfter(SESSION_TTL_SECONDS * 1000);
      await env.GUILD_WAR_DB.batch([
        env.GUILD_WAR_DB.prepare("DELETE FROM organizer_sessions WHERE expires_at <= ?").bind(now),
        env.GUILD_WAR_DB.prepare("INSERT INTO organizer_sessions (session_hash, discord_user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
          .bind(await sha256(session), profile.id, expiresAt, now),
      ]);
      return new Response(null, {
        status: 302,
        headers: {
          Location: safeReturnPath(savedState.return_path),
          "Set-Cookie": sessionCookie(session),
          "Cache-Control": "no-store",
        },
      });
    }

    if (url.pathname === "/api/auth/discord/session") {
      if (request.method !== "GET") return new Response(null, {status: 405, headers: {Allow: "GET"}});
      const organizer = await activeOrganizer(env, request);
      return json({organizer});
    }

    if (url.pathname === "/api/auth/discord/logout") {
      if (request.method !== "POST") return new Response(null, {status: 405, headers: {Allow: "POST"}});
      const session = readCookie(request.headers.get("Cookie"), SESSION_COOKIE);
      if (session) await run(env.GUILD_WAR_DB, "DELETE FROM organizer_sessions WHERE session_hash = ?", await sha256(session));
      return new Response(null, {
        status: 204,
        headers: {"Set-Cookie": sessionCookie("", 0), "Cache-Control": "no-store"},
      });
    }

    return null;
  } catch {
    return json({error: "temporarily_unavailable"}, 503);
  }
}
