const discordTeams = [["ATTACK_1","🔴 ทีมบุก 1"],["ATTACK_2","🔴 ทีมบุก 2"],["ATTACK_3","🔴 ทีมบุก 3"],["DEFENSE_1","🔵 ทีมกัน 1"],["DEFENSE_2","🔵 ทีมกัน 2"],["FOREST","🟢 ป่า"],["STANDBY","⚪ สำรอง"]];
const thaiWeekdays = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];
const eventIdPattern = /^[A-Za-z0-9-]{1,24}$/;
const literal = value => String(value || "").replace(/@/g, "@\u200b").replace(/[\r\n]/g, " ").slice(0, 180);

function roundInfo(startsAt, roundNumber) {
  const instant = new Date(startsAt);
  if (!Number.isFinite(instant.getTime())) return {round: roundNumber, time: "", date: "", weekday: ""};
  const local = new Date(instant.getTime() + 7 * 60 * 60 * 1000);
  const hour = String(local.getUTCHours()).padStart(2, "0");
  const minute = String(local.getUTCMinutes()).padStart(2, "0");
  return {
    round: roundNumber,
    time: hour + "." + minute,
    date: local.getUTCDate() + "/" + (local.getUTCMonth() + 1) + "/" + String(local.getUTCFullYear() + 543).slice(-2),
    weekday: thaiWeekdays[local.getUTCDay()] || "",
  };
}

export function buildRoundEmbed(snapshot, publicationUrl, roundNumber) {
  const info = roundInfo(snapshot.event?.startsAt, roundNumber);
  const fields = discordTeams.map(([team, name]) => {
    const members = (snapshot.members || []).filter(member => member.team === team);
    const value = members.length
      ? members.map(member => "• " + literal(member.name) + (member.role ? " · " + literal(member.role) : "")).join("\n")
      : "—";
    return {name: name + " · " + members.length + (team !== "STANDBY" ? "/5" : ""), value: value.slice(0, 1024), inline: true};
  });
  const detail = info.time
    ? "รอบ " + info.round + " " + literal(snapshot.event?.warType) + " " + info.time + " " + info.date + " (" + info.weekday + ")"
    : "รอบ " + info.round + " " + literal(snapshot.event?.warType);
  return {
    title: "ประกาศรอบวอร์",
    url: publicationUrl,
    description: detail + "\n[เปิดดูรายชื่อทีม](" + publicationUrl + ")",
    color: 0xC8A86B,
    fields,
    footer: {text: "Path of Memories · กดปุ่มด้านล่างเพื่อดูรอบอื่น"},
  };
}

export function announcementCustomId(eventIds, selectedIndex) {
  return "pom-war|" + eventIds.join(",") + "|" + selectedIndex;
}

export function parseAnnouncementCustomId(customId) {
  const parts = String(customId || "").split("|");
  if (parts.length !== 3 || parts[0] !== "pom-war") return null;
  const eventIds = parts[1].split(",");
  const selectedIndex = Number(parts[2]);
  if (eventIds.length !== 4 || new Set(eventIds).size !== 4 || !eventIds.every(id => eventIdPattern.test(id))) return null;
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3) return null;
  if (announcementCustomId(eventIds, selectedIndex).length > 100) return null;
  return {eventIds, selectedIndex};
}

export function announcementComponents(rounds, selectedIndex) {
  const eventIds = rounds.map(round => round.eventId);
  const buttons = eventIds.map((eventId, index) => ({
    type: 2,
    style: index === selectedIndex ? 3 : 1,
    label: "รอบ " + (index + 1),
    custom_id: announcementCustomId(eventIds, index),
  }));
  const selected = rounds[selectedIndex];
  buttons.push({
    type: 2,
    style: 5,
    label: "ดูรายละเอียด",
    url: selected.publicationUrl,
  });
  return [{type: 1, components: buttons}];
}

export function buildAnnouncementPayload(rounds, selectedIndex = 0) {
  const selected = rounds[selectedIndex];
  return {
    username: "Path of Memories",
    embeds: [buildRoundEmbed(selected.snapshot, selected.publicationUrl, selectedIndex + 1)],
    components: announcementComponents(rounds, selectedIndex),
  };
}

export async function loadPublishedRounds(db, game, eventIds) {
  const rows = await Promise.all(eventIds.map(eventId =>
    db.prepare("SELECT id,event_id,snapshot_json,published_at FROM team_publications WHERE game_id=? AND event_id=? ORDER BY published_at DESC LIMIT 1")
      .bind(game, eventId).first()
  ));
  const missing = [];
  const rounds = [];
  rows.forEach((row, index) => {
    if (!row) {
      missing.push(eventIds[index]);
      return;
    }
    try {
      rounds.push({
        eventId: eventIds[index],
        publicationId: row.id,
        publishedAt: row.published_at,
        snapshot: JSON.parse(row.snapshot_json),
        publicationUrl: "",
      });
    } catch {
      missing.push(eventIds[index]);
    }
  });
  return {rounds, missing};
}

export function isValidAnnouncementEventIds(eventIds) {
  return Array.isArray(eventIds)
    && eventIds.length === 4
    && new Set(eventIds).size === 4
    && eventIds.every(eventId => typeof eventId === "string" && eventIdPattern.test(eventId))
    && announcementCustomId(eventIds, 0).length <= 100;
}

export async function sendDiscordRoundBundle(env, rounds, origin) {
  if (!env.DISCORD_WEBHOOK_URL) return "unconfigured";
  let webhook;
  try { webhook = new URL(env.DISCORD_WEBHOOK_URL); } catch { return "failed"; }
  if (webhook.protocol !== "https:" || !/(^|\.)discord(?:app)?\.com$/i.test(webhook.hostname) || !webhook.pathname.startsWith("/api/webhooks/")) return "failed";
  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(buildAnnouncementPayload(rounds, 0)),
    });
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

export function attachPublicationUrls(rounds, origin) {
  return rounds.map(round => ({
    ...round,
    publicationUrl: origin + "/games/where-winds-meet/guild-war/published/" + round.eventId + "/" + round.publicationId,
  }));
}
