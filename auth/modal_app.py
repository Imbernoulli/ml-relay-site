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
  POST /refresh              renews an expired user token
  GET  /reviews              every task's "Review OK" marks (public)
  POST /reviews              add or withdraw the caller's mark on one task; the caller
                             is identified by their own GitHub token and must have
                             access to Imbernoulli/ML-Relay

Nothing about visitors is stored or logged, apart from the review marks people make
on purpose (GitHub login, avatar URL, time, task version). Deploy:
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
reviews = modal.Dict.from_name("ml-relay-reviews", create_if_missing=True)
live_status = modal.Dict.from_name("ml-relay-live-status", create_if_missing=True)
access_requests = modal.Dict.from_name("ml-relay-access-requests", create_if_missing=True)
RELAY_REPO = "Imbernoulli/ML-Relay"
setup_secret = modal.Secret.from_dict({"SETUP_STATE": os.environ.get("SETUP_STATE", "")})
# Shared with the ML-Relay repo secret RELAY_STATUS_SECRET: only the backend may push status.
status_secret = modal.Secret.from_name("ml-relay-status-secret")


@app.function(secrets=[setup_secret, status_secret], min_containers=0, max_containers=2)
@modal.concurrent(max_inputs=20)
@modal.asgi_app()
def web():
    import html
    from datetime import datetime, timezone

    import httpx
    from fastapi import Body, FastAPI, Request
    from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response

    api = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    setup_state = os.environ["SETUP_STATE"]

    def cors(resp: Response) -> Response:
        resp.headers["Access-Control-Allow-Origin"] = SITE_ORIGIN
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
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

    # ---- live request status -------------------------------------------------
    # The backend pushes each request's PUBLIC progress (no private text) the
    # moment it changes, so the site shows it within seconds instead of waiting
    # for a rebuild. The static status.json stays as the fallback.
    PUBLIC_STEP_KEYS = ("t", "kind", "label", "state", "detail_public", "visibility", "key")

    def _public_current(cur):
        """The backend sends the current step as an object (or, from older code, a string)."""
        if isinstance(cur, dict):
            return {k: cur[k] for k in PUBLIC_STEP_KEYS if k in cur and cur.get("visibility", "public") != "internal"} or None
        return str(cur)[:200] if cur else None

    @api.get("/status")
    def get_status():
        out = {k[6:]: v for k, v in live_status.items() if k.startswith("issue:")}
        resp = cors(JSONResponse({"issues": out}))
        resp.headers["Cache-Control"] = "no-store"
        return resp

    @api.post("/status")
    def put_status(request: Request, payload: dict | None = Body(default=None)):
        import hmac

        want = os.environ.get("RELAY_STATUS_SECRET", "")
        got = request.headers.get("x-relay-status-secret", "")
        if not want or not hmac.compare_digest(want, got):
            return Response("forbidden", status_code=403)
        if not isinstance(payload, dict) or not isinstance(payload.get("issue"), int):
            return JSONResponse({"error": "bad request"}, status_code=400)
        n = payload["issue"]
        if payload.get("delete"):
            live_status.pop(f"issue:{n}", None)
            return JSONResponse({"ok": True})
        steps = []
        for st in payload.get("steps") or []:
            if isinstance(st, dict) and st.get("visibility", "public") != "internal":
                steps.append({k: st[k] for k in PUBLIC_STEP_KEYS if k in st})
        record = {
            "issue": n,
            "title": str(payload.get("title", ""))[:200],
            "type": str(payload.get("type", ""))[:40],
            "task": str(payload.get("task") or "")[:80] or None,
            "requester": str(payload.get("requester", ""))[:60],
            "state": str(payload.get("state", ""))[:20],
            "labels": [str(x)[:50] for x in (payload.get("labels") or [])][:30],
            "pr": payload.get("pr") if isinstance(payload.get("pr"), (int, type(None))) else None,
            "pr_state": str(payload.get("pr_state") or "")[:20] or None,
            "current": _public_current(payload.get("current")),
            "steps": steps[-200:],
            "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
        live_status[f"issue:{n}"] = record
        return JSONResponse({"ok": True, "updated": record["updated"]})

    # ---- access requests ------------------------------------------------------
    # Someone signed in without access to the private repository asks for it; a
    # maintainer approves (the site then invites them as a collaborator with the
    # maintainer's own token) or denies. Identities come from GitHub tokens only.

    def _gh(auth: str, path: str):
        with httpx.Client(timeout=20) as client:
            return client.get(
                f"https://api.github.com{path}",
                headers={"Authorization": auth, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"},
            )

    def _caller(request: Request):
        auth = request.headers.get("authorization", "")
        if not auth.lower().startswith("bearer ") or len(auth) > 300:
            return None, None
        me = _gh(auth, "/user")
        return (me.json(), auth) if me.status_code == 200 else (None, None)

    def _is_maintainer(auth: str) -> bool:
        r = _gh(auth, f"/repos/{RELAY_REPO}")
        return r.status_code == 200 and bool((r.json().get("permissions") or {}).get("admin"))

    def _public_request(rec: dict) -> dict:
        return {k: rec.get(k) for k in ("login", "avatar_url", "html_url", "note", "at", "state", "decided_at", "decided_by")}

    @api.post("/access-requests")
    def request_access(request: Request, payload: dict | None = Body(default=None)):
        if request.headers.get("origin") != SITE_ORIGIN:
            return Response("forbidden", status_code=403)
        user, auth = _caller(request)
        if not user:
            return cors(JSONResponse({"error": "sign in first"}, status_code=401))
        if _gh(auth, f"/repos/{RELAY_REPO}").status_code == 200:
            return cors(JSONResponse({"state": "has-access"}))
        note = str((payload or {}).get("note") or "")[:500] if isinstance(payload, dict) else ""
        key = f"user:{user['login'].lower()}"
        prev = access_requests.get(key) or {}
        if prev.get("state") == "pending":
            return cors(JSONResponse(_public_request(prev)))
        rec = {
            "login": user["login"],
            "avatar_url": user.get("avatar_url", ""),
            "html_url": user.get("html_url", ""),
            "note": note,
            "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "state": "pending",
        }
        access_requests[key] = rec
        return cors(JSONResponse(_public_request(rec)))

    @api.get("/access-requests/me")
    def my_access_request(request: Request):
        user, _auth = _caller(request)
        if not user:
            return cors(JSONResponse({"error": "sign in first"}, status_code=401))
        rec = access_requests.get(f"user:{user['login'].lower()}")
        return cors(JSONResponse(_public_request(rec) if rec else {"state": "none"}))

    @api.get("/access-requests")
    def list_access_requests(request: Request):
        # Maintainers (admin on the repo) see the queue; so does the backend poller
        # with the shared status secret (it mentions the maintainer on a tracking issue).
        import hmac

        want = os.environ.get("RELAY_STATUS_SECRET", "")
        by_secret = bool(want) and hmac.compare_digest(want, request.headers.get("x-relay-status-secret", ""))
        if not by_secret:
            user, auth = _caller(request)
            if not user or not _is_maintainer(auth):
                return cors(JSONResponse({"error": "maintainers only"}, status_code=403))
        out = [_public_request(v) for k, v in access_requests.items() if k.startswith("user:")]
        out.sort(key=lambda r: r.get("at") or "", reverse=True)
        resp = cors(JSONResponse({"requests": out}))
        resp.headers["Cache-Control"] = "no-store"
        return resp

    @api.post("/access-requests/decide")
    def decide_access(request: Request, payload: dict | None = Body(default=None)):
        """Record a maintainer's decision. The invitation itself is sent by the site
        with the maintainer's own token (PUT /repos/.../collaborators/<login>)."""
        if request.headers.get("origin") != SITE_ORIGIN:
            return Response("forbidden", status_code=403)
        user, auth = _caller(request)
        if not user or not _is_maintainer(auth):
            return cors(JSONResponse({"error": "maintainers only"}, status_code=403))
        if not isinstance(payload, dict):
            return cors(JSONResponse({"error": "bad request"}, status_code=400))
        login = str(payload.get("login") or "")
        decision = payload.get("decision")
        if decision not in ("approved", "denied") or not login:
            return cors(JSONResponse({"error": "bad request"}, status_code=400))
        key = f"user:{login.lower()}"
        rec = dict(access_requests.get(key) or {"login": login, "at": None})
        rec.update(
            state=decision,
            decided_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
            decided_by=user["login"],
        )
        access_requests[key] = rec
        return cors(JSONResponse(_public_request(rec)))

    @api.get("/reviews")
    def list_reviews():
        out = {}
        for key, marks in reviews.items():
            if key.startswith("task:") and marks:
                out[key[5:]] = sorted(marks.values(), key=lambda m: m["at"])
        resp = cors(JSONResponse({"reviews": out}))
        resp.headers["Cache-Control"] = "no-store"
        return resp

    @api.post("/reviews")
    def mark_review(request: Request, payload: dict | None = Body(default=None)):
        if request.headers.get("origin") != SITE_ORIGIN:
            return Response("forbidden", status_code=403)
        auth = request.headers.get("authorization", "")
        if not auth.lower().startswith("bearer ") or len(auth) > 300:
            return cors(JSONResponse({"error": "sign in first"}, status_code=401))
        if not isinstance(payload, dict):
            return cors(JSONResponse({"error": "bad request"}, status_code=400))
        task = payload.get("task")
        version = payload.get("version") or ""
        ok = payload.get("ok", True)
        if not isinstance(task, str) or not (3 <= len(task) <= 80) or not task.replace("-", "").isalnum() or not task.islower():
            return cors(JSONResponse({"error": "bad task"}, status_code=400))
        if not isinstance(version, str) or len(version) > 64 or (version and not version.replace("-", "").isalnum()):
            return cors(JSONResponse({"error": "bad version"}, status_code=400))
        gh_headers = {"Authorization": auth, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
        with httpx.Client(timeout=20) as client:
            me = client.get("https://api.github.com/user", headers=gh_headers)
            if me.status_code != 200:
                return cors(JSONResponse({"error": "GitHub did not accept the sign-in; sign in again"}, status_code=401))
            # Only people who can see the private repository may review.
            repo = client.get(f"https://api.github.com/repos/{RELAY_REPO}", headers=gh_headers)
        if repo.status_code != 200:
            return cors(JSONResponse({"error": f"you need access to {RELAY_REPO} to review"}, status_code=403))
        user = me.json()
        key = f"task:{task}"
        marks = dict(reviews.get(key) or {})
        if ok:
            marks[user["login"]] = {
                "login": user["login"],
                "avatar_url": user.get("avatar_url", ""),
                "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "version": version,
            }
        else:
            marks.pop(user["login"], None)
        reviews[key] = marks
        return cors(JSONResponse({"task": task, "marks": sorted(marks.values(), key=lambda m: m["at"])}))

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
