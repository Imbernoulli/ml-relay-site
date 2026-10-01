"""One-click GitHub sign-in for the ML-Relay site, served from Modal.

GitHub's OAuth token endpoint needs the app's client secret and refuses browser
(CORS) requests, so the static site cannot finish a sign-in alone. This small web
app does the two server-side steps and nothing else:

  GET  /setup?state=S        one-time: a page whose button creates the GitHub App
                             from a manifest (no form to fill in)
  GET  /manifest-callback    one-time: GitHub returns here; the app's client id and
                             secret are stored in a Modal Dict, then the owner is sent
                             to the install page (pick Imbernoulli/ML-Relay)
  GET  /client-id            the public client id (empty until setup is done)
  POST /token                trades a sign-in code for a user token (site origin only)

Nothing about visitors is stored or logged. Deploy:
    SETUP_STATE=$(python3 -c 'import secrets;print(secrets.token_urlsafe(24))') \\
        modal deploy auth/modal_app.py
"""

import json
import os

import modal

SITE_ORIGIN = "https://bohanlyu.com"
CALLBACK = "https://bohanlyu.com/ml-relay-site/auth/callback/"
APP_NAME = "ml-relay-site-signin"

image = modal.Image.debian_slim(python_version="3.12").pip_install("fastapi[standard]==0.115.6", "httpx==0.28.1")
app = modal.App("ml-relay-auth", image=image)
store = modal.Dict.from_name("ml-relay-auth", create_if_missing=True)
setup_secret = modal.Secret.from_dict({"SETUP_STATE": os.environ.get("SETUP_STATE", "")})


@app.function(secrets=[setup_secret], min_containers=0, max_containers=2)
@modal.concurrent(max_inputs=20)
@modal.asgi_app()
def web():
    import html

    import httpx
    from fastapi import Body, FastAPI, Request
    from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response

    api = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    setup_state = os.environ["SETUP_STATE"]

    def cors(resp: Response) -> Response:
        resp.headers["Access-Control-Allow-Origin"] = SITE_ORIGIN
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
        resp.headers["Vary"] = "Origin"
        return resp

    @api.get("/setup")
    def setup(request: Request, state: str = ""):
        if not setup_state or state != setup_state:
            return Response("forbidden", status_code=403)
        if store.get("client_id"):
            return HTMLResponse("<p>Already set up. Sign-in is live on the site.</p>")
        base = str(request.base_url).rstrip("/").replace("http://", "https://")
        manifest = {
            "name": APP_NAME,
            "url": "https://bohanlyu.com/ml-relay-site/",
            "redirect_url": f"{base}/manifest-callback",
            "callback_urls": [CALLBACK],
            "public": False,
            "default_permissions": {"issues": "read", "pull_requests": "read", "metadata": "read"},
            "default_events": [],
            "hook_attributes": {"url": "https://bohanlyu.com/ml-relay-site/", "active": False},
        }
        page = f"""<!doctype html><meta charset="utf-8"><title>ML-Relay sign-in setup</title>
<body style="font-family:system-ui;max-width:36rem;margin:4rem auto;line-height:1.5">
<h2>Create the ML-Relay sign-in app</h2>
<p>This creates a private GitHub App on your account with read-only access to issues and
pull requests. On the next screens: click <b>Create GitHub App</b>, then install it on
<b>Imbernoulli/ML-Relay</b> only.</p>
<form method="post" action="https://github.com/settings/apps/new?state={html.escape(state)}">
<input type="hidden" name="manifest" value="{html.escape(json.dumps(manifest))}">
<button style="font-size:1rem;padding:.6rem 1.2rem">Continue to GitHub</button></form></body>"""
        return HTMLResponse(page)

    @api.get("/manifest-callback")
    def manifest_callback(code: str = "", state: str = ""):
        if not setup_state or state != setup_state or not code:
            return Response("forbidden", status_code=403)
        if store.get("client_id"):
            return HTMLResponse("<p>Already set up.</p>")
        with httpx.Client(timeout=20) as client:
            r = client.post(
                f"https://api.github.com/app-manifests/{code}/conversions",
                headers={"Accept": "application/vnd.github+json"},
            )
        if r.status_code != 201:
            return HTMLResponse(f"<p>GitHub refused the conversion ({r.status_code}). Open the setup link again.</p>", status_code=502)
        conf = r.json()
        # The private key and webhook secret are not needed for user sign-in: not kept.
        store["client_id"] = conf["client_id"]
        store["client_secret"] = conf["client_secret"]
        store["slug"] = conf["slug"]
        return RedirectResponse(f"https://github.com/apps/{conf['slug']}/installations/new", status_code=302)

    @api.options("/{path:path}")
    def preflight(path: str):
        return cors(Response(status_code=204))

    @api.get("/client-id")
    def client_id():
        return cors(JSONResponse({"client_id": store.get("client_id") or ""}))

    @api.post("/token")
    def token(request: Request, payload: dict | None = Body(default=None)):
        if request.headers.get("origin") != SITE_ORIGIN:
            return Response("forbidden", status_code=403)
        if payload is None:
            return cors(JSONResponse({"error": "bad request"}, status_code=400))
        code = payload.get("code") if isinstance(payload, dict) else None
        if not isinstance(code, str) or not (8 <= len(code) <= 80) or not code.replace("-", "").replace("_", "").isalnum():
            return cors(JSONResponse({"error": "bad code"}, status_code=400))
        if payload.get("redirect_uri") != CALLBACK:
            return cors(JSONResponse({"error": "bad redirect_uri"}, status_code=400))
        return exchange({"code": code, "redirect_uri": CALLBACK})

    @api.post("/refresh")
    def refresh(request: Request, payload: dict | None = Body(default=None)):
        """Renew an expired user token (GitHub App tokens last 8 h; refresh tokens ~6 months)."""
        if request.headers.get("origin") != SITE_ORIGIN:
            return Response("forbidden", status_code=403)
        rt = payload.get("refresh_token") if isinstance(payload, dict) else None
        if not isinstance(rt, str) or not (20 <= len(rt) <= 200) or not rt.replace("_", "").isalnum():
            return cors(JSONResponse({"error": "bad refresh token"}, status_code=400))
        return exchange({"grant_type": "refresh_token", "refresh_token": rt})

    def exchange(fields: dict) -> Response:
        cid, secret = store.get("client_id"), store.get("client_secret")
        if not cid or not secret:
            return cors(JSONResponse({"error": "sign-in is not set up yet"}, status_code=503))
        with httpx.Client(timeout=20) as client:
            r = client.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json"},
                json={"client_id": cid, "client_secret": secret, **fields},
            )
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if not body.get("access_token"):
            return cors(JSONResponse({"error": body.get("error_description") or body.get("error") or "exchange failed"}, status_code=400))
        keep = ("access_token", "expires_in", "refresh_token", "refresh_token_expires_in")
        return cors(JSONResponse({k: body[k] for k in keep if k in body}))

    return api
