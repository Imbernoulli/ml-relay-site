// Token exchange for the ML-Relay site's GitHub sign-in.
//
// GitHub's OAuth token endpoint does not allow browser (CORS) requests and needs
// the client secret, so the static site posts the one-time code here and this
// worker trades it for a token. It stores nothing and logs nothing.
//
// Env (wrangler.toml [vars] + `wrangler secret put`):
//   GH_CLIENT_ID      public client id of the GitHub App
//   GH_CLIENT_SECRET  secret (wrangler secret)
//   ALLOWED_ORIGIN    the site's origin, e.g. https://bohanlyu.com
//   REDIRECT_URI      the exact callback, e.g. https://bohanlyu.com/ml-relay-site/auth/callback/

function cors(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(env, status, body) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(env), "Content-Type": "application/json" } });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (origin !== env.ALLOWED_ORIGIN) return new Response("forbidden", { status: 403 });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env) });
    if (request.method !== "POST") return json(env, 405, { error: "method not allowed" });

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json(env, 400, { error: "bad request" });
    }
    const code = typeof payload.code === "string" ? payload.code : "";
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(code)) return json(env, 400, { error: "bad code" });
    if (payload.redirect_uri !== env.REDIRECT_URI) return json(env, 400, { error: "bad redirect_uri" });

    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: env.GH_CLIENT_ID,
        client_secret: env.GH_CLIENT_SECRET,
        code,
        redirect_uri: env.REDIRECT_URI,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!body.access_token) return json(env, 400, { error: body.error_description || body.error || "exchange failed" });
    return json(env, 200, { access_token: body.access_token });
  },
};
