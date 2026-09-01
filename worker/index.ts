export interface Env {}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") return Response.json({ service: "pathofmemories-web", status: "ok" });
    return new Response(null, { status: 404 });
  },
};
