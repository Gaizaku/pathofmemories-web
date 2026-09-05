// Isolated read-only handler. Not wired into the production Worker.
export function bangkokWeek(now = new Date()) {
  const local = new Date(now.getTime() + 7 * 3600000);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  local.setUTCDate(local.getUTCDate() - daysSinceMonday);
  return local.toISOString().slice(0, 10);
}
const json = (body, status = 200) => Response.json(body, {status, headers:{'Cache-Control':'no-store'}});
export async function readApi(request, env, now = new Date()) {
  const url = new URL(request.url);
  const match = /^\/api\/v2\/games\/([a-z0-9-]{1,64})\/war\/events$/.exec(url.pathname);
  if (!match) return json({error:'not_found'},404);
  if (request.method !== 'GET') return new Response(null,{status:405,headers:{Allow:'GET'}});
  if (url.search) return json({error:'unsupported_query'},400);
  if (!env.GUILD_WAR_DB) return json({error:'database_not_configured'},503);
  const week = bangkokWeek(now);
  try {
    const result = await env.GUILD_WAR_DB.prepare(
      'SELECT id, starts_at, local_date, war_type, status, capacity FROM events WHERE game_id = ? AND week_start = ? ORDER BY starts_at, id LIMIT 64'
    ).bind(match[1],week).all();
    if (result.success === false) throw new Error('query_failed');
    return json({gameId:match[1],weekStart:week,timeZone:'Asia/Bangkok',events:result.results});
  } catch {
    return json({error:'temporarily_unavailable'},503);
  }
}
