import {teamPublicationApi} from "../guild-war-v2/team-publication-api.mjs";
import {teamDraftApi} from "../guild-war-v2/team-draft-api.mjs";
import { readApi } from "../guild-war-v2/read-api.mjs";
import { registrationApi } from "../guild-war-v2/registration-api.mjs";
import { organizerAuthApi } from "../guild-war-v2/organizer-auth.mjs";
import { regularsApi } from "../guild-war-v2/regulars-api.mjs";

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

    const publicationResponse = await teamPublicationApi(request, env);
    if (publicationResponse) return publicationResponse;

    const draftResponse = await teamDraftApi(request, env);
    if (draftResponse) return draftResponse;

    const regularsResponse = await regularsApi(request, env);
    if (regularsResponse) return regularsResponse;

    const registrationResponse = await registrationApi(request, env);
    if (registrationResponse) return registrationResponse;

    if (url.pathname.startsWith("/api/v2/")) {
      return readApi(request, env);
    }

    return new Response(null, { status: 404 });
  },
};
