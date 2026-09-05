import { readApi } from "../guild-war-v2/read-api.mjs";

export interface Env {
  GUILD_WAR_DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({ service: "pathofmemories-web", status: "ok" });
    }

    if (url.pathname.startsWith("/api/v2/")) {
      return readApi(request, env);
    }

    return new Response(null, { status: 404 });
  },
};
