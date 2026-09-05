import { readApi } from "../guild-war-v2/read-api.mjs";
import { registrationApi } from "../guild-war-v2/registration-api.mjs";
import { organizerAuthApi } from "../guild-war-v2/organizer-auth.mjs";

export interface Env {
  GUILD_WAR_DB: D1Database;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({ service: "pathofmemories-web", status: "ok" });
    }

    const authResponse = await organizerAuthApi(request, env);
    if (authResponse) return authResponse;

    const registrationResponse = await registrationApi(request, env);
    if (registrationResponse) return registrationResponse;

    if (url.pathname.startsWith("/api/v2/")) {
      return readApi(request, env);
    }

    return new Response(null, { status: 404 });
  },
};
