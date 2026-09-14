import {buildAnnouncementPayload, loadPublishedRounds, parseAnnouncementCustomId, attachPublicationUrls} from "./discord-announcement.mjs";

const json = (body, status = 200) => Response.json(body, {status, headers: {"Cache-Control": "no-store"}});
const encoder = new TextEncoder();

function hexBytes(value) {
  if (typeof value !== "string" || !/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

async function validSignature(request, body, env) {
  const publicKey = hexBytes(env.DISCORD_PUBLIC_KEY);
  const signature = hexBytes(request.headers.get("X-Signature-Ed25519"));
  const timestamp = request.headers.get("X-Signature-Timestamp");
  if (!publicKey || publicKey.length !== 32 || !signature || signature.length !== 64 || !timestamp) return false;
  try {
    const key = await crypto.subtle.importKey("raw", publicKey, {name: "Ed25519"}, false, ["verify"]);
    return await crypto.subtle.verify({name: "Ed25519"}, key, signature, encoder.encode(timestamp + body));
  } catch {
    return false;
  }
}

function interactionError(message) {
  return json({type: 4, data: {content: message, flags: 64}});
}

export async function discordInteractionApi(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/discord/interactions") return null;
  if (request.method !== "POST") return json({error: "method_not_allowed"}, 405);
  const body = await request.text();
  if (body.length > 100000 || !(await validSignature(request, body, env))) return new Response("invalid request", {status: 401});
  let interaction;
  try { interaction = JSON.parse(body); } catch { return new Response("invalid request", {status: 400}); }
  if (interaction.type === 1) return json({type: 1});
  if (interaction.type !== 3) return interactionError("รองรับเฉพาะปุ่มประกาศรอบวอร์");
  const parsed = parseAnnouncementCustomId(interaction.data?.custom_id);
  if (!parsed) return interactionError("ปุ่มประกาศนี้หมดอายุหรือไม่ถูกต้อง");
  try {
    const loaded = await loadPublishedRounds(env.GUILD_WAR_DB, "where-winds-meet", parsed.eventIds);
    if (loaded.missing.length) return interactionError("ไม่พบข้อมูลประกาศของบางรอบแล้ว");
    const origin = (() => {
      try { return new URL(env.PUBLIC_ORIGIN || url.origin).origin; } catch { return url.origin; }
    })();
    const rounds = attachPublicationUrls(loaded.rounds, origin);
    const payload = buildAnnouncementPayload(rounds, parsed.selectedIndex);
    return json({type: 7, data: {embeds: payload.embeds, components: payload.components}});
  } catch {
    return interactionError("โหลดรายชื่อรอบวอร์ไม่สำเร็จ");
  }
}
