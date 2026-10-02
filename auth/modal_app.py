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

image = modal.Image.debian_slim(python_version="3.12").pip_install(
    "fastapi[standard]==0.115.6", "httpx==0.28.1", "pyjwt[crypto]==2.9.0")
app = modal.App("ml-relay-auth", image=image)
store = modal.Dict.from_name("ml-relay-auth", create_if_missing=True)
reviews = modal.Dict.from_name("ml-relay-reviews", create_if_missing=True)
live_status = modal.Dict.from_name("ml-relay-live-status", create_if_missing=True)
access_requests = modal.Dict.from_name("ml-relay-access-requests", create_if_missing=True)
RELAY_REPO = "Imbernoulli/ML-Relay"
setup_secret = modal.Secret.from_dict({"SETUP_STATE": os.environ.get("SETUP_STATE", "")})
# Shared with the ML-Relay repo secret RELAY_STATUS_SECRET: only the backend may push status.
status_secret = modal.Secret.from_name("ml-relay-status-secret")
RELAY_REPO_FULL = "Imbernoulli/ML-Relay"


def _optional_secret(name: str):
    """A Modal secret only when it exists, so the app deploys before the owner creates it."""
    try:
        sec = modal.Secret.from_name(name)
        sec.hydrate()
        return [sec]
    except Exception:  # noqa: BLE001
        return []


# Credential for workflow_dispatch of relay-poller.yml (Actions: write on Imbernoulli/ML-Relay):
# either GH_APP_ID + GH_APP_PRIVATE_KEY (the GitHub App; installation token minted per call)
# or GH_DISPATCH_TOKEN (a fine-grained token). See the ML-Relay BACKEND.md.
dispatch_secrets = _optional_secret("ml-relay-dispatch")


def _dispatch_token():
    import time as _time

    import httpx as _httpx

    tok = os.environ.get("GH_DISPATCH_TOKEN", "")
    if tok:
        return tok
    app_id, key = os.environ.get("GH_APP_ID", ""), os.environ.get("GH_APP_PRIVATE_KEY", "")
    if not app_id or not key:
        return ""
    import jwt
    now = int(_time.time())
    j = jwt.encode({"iat": now - 60, "exp": now + 540, "iss": app_id}, key.replace("\\n", "\n"), algorithm="RS256")
    h = {"Authorization": f"Bearer {j}", "Accept": "application/vnd.github+json"}
    with _httpx.Client(timeout=20) as c:
        r = c.get(f"https://api.github.com/repos/{RELAY_REPO_FULL}/installation", headers=h)
        if r.status_code != 200:
            return ""
        r = c.post(f"https://api.github.com/app/installations/{r.json()['id']}/access_tokens", headers=h,
                   json={"repositories": [RELAY_REPO_FULL.split("/")[1]], "permissions": {"actions": "write"}})
        return r.json().get("token", "") if r.status_code == 201 else ""


def dispatch_poller(reason: str) -> int:
    """workflow_dispatch of relay-poller.yml; 0 when no credential is configured."""
    import httpx as _httpx

    tok = _dispatch_token()
    if not tok:
        return 0
    with _httpx.Client(timeout=20) as c:
        r = c.post(f"https://api.github.com/repos/{RELAY_REPO_FULL}/actions/workflows/relay-poller.yml/dispatches",
                   headers={"Authorization": f"Bearer {tok}", "Accept": "application/vnd.github+json"},
                   json={"ref": "main", "inputs": {"reason": reason[:100]}})
        return r.status_code


# ---- driver run events: an overlay on the backend's timeline ---------------------
# A driver ping (/run-event) moves the run's OWN timeline steps (the keys the backend
# writes: run:<id>:env, :sandbox, :setting:*, :results), instead of adding a parallel
# "event" step: the old separate step repeated "environment building / sandbox started"
# and was wiped by the backend's next full POST /status (which only knows progress/<n>.json).
# The events are kept per issue (live_status["runevents:<n>"] = {run_id: {event: t}}) and
# re-applied on every POST /status until the backend has collected the run (its
# run:<id>:results step exists), then dropped.
RUN_EVENTS = ("started", "env_built", "verifying", "finished", "failed")


def _recompute_current(steps):
    pub = [s for s in steps if s.get("visibility", "public") != "internal"] or steps
    if not pub:
        return None
    live = [s for s in pub if s.get("state") in ("running", "waiting")]
    cur = live[-1] if live else max(pub, key=lambda s: int(s.get("t") or 0))
    return {k: cur[k] for k in ("t", "kind", "label", "state", "detail_public", "visibility", "key") if k in cur}


def apply_run_events(rec: dict, events: dict) -> tuple[dict, dict]:
    """Pure: the record with its runs' driver events applied, and the events still pending
    (a run whose results the backend has collected is dropped)."""
    steps = [dict(s) for s in rec.get("steps") or []]
    pending = {}
    changed = False
    for rid, evs in sorted((events or {}).items()):
        if not isinstance(evs, dict):
            continue
        by_key = {s.get("key"): s for s in steps if s.get("key")}
        if f"run:{rid}:results" in by_key:
            changed = changed or bool(evs)
            continue                                     # collected: the backend's steps are final
        pending[rid] = evs
        ts = {e: int(evs[e]) for e in RUN_EVENTS if isinstance(evs.get(e), (int, float))}
        if not ts:
            continue
        last = max(ts, key=lambda e: (ts[e], RUN_EVENTS.index(e)))
        built = any(e in ts for e in ("env_built", "verifying", "finished", "failed"))

        def upsert(key, label, state, t, detail=None, keep_label=True):
            nonlocal changed
            cur = by_key.get(key)
            if cur is None:
                cur = {"t": int(t), "kind": "daytona", "label": label, "state": state,
                       "detail_public": detail or f"run {rid}", "visibility": "public", "key": key}
                steps.append(cur)
                by_key[key] = cur
                changed = True
                return
            new_label = cur.get("label") if keep_label else label
            if cur.get("state") != state or cur.get("label") != new_label:
                cur["state"], cur["label"] = state, new_label
                changed = True

        env = by_key.get(f"run:{rid}:env")
        if built:
            upsert(f"run:{rid}:env", "Environment building", "done", ts.get("started") or min(ts.values()))
            upsert(f"run:{rid}:sandbox", "Sandbox started", "done",
                   ts.get("env_built") or min(t for e, t in ts.items() if e != "started"))
        elif "started" in ts and (env is None or env.get("state") == "failed"):
            upsert(f"run:{rid}:env", "Environment building", "running", ts["started"])
        if last in ("finished", "failed"):
            ok = last == "finished"
            for s in steps:
                if s.get("state") == "running" and str(s.get("key") or "").startswith(f"run:{rid}:setting:"):
                    s["state"] = "done" if ok else "failed"
                    changed = True
            upsert(f"run:{rid}:results",
                   "Run finished, collecting results" if ok else "Run failed, collecting logs",
                   "running" if ok else "failed", ts[last], keep_label=False)
    out = dict(rec)
    if changed:
        out["steps"] = steps[-200:]
        out["current"] = _recompute_current(out["steps"])
    return out, pending


def _runs_in_flight() -> bool:
    for k, rec in live_status.items():
        if not k.startswith("issue:") or not isinstance(rec, dict) or rec.get("state") == "closed":
            continue
        for st in rec.get("steps") or []:
            if st.get("kind") in ("daytona", "setting", "precheck") and st.get("state") == "running":
                return True
    return False


@app.function(secrets=[status_secret, *dispatch_secrets], schedule=modal.Period(minutes=10), max_containers=1)
def poller_heartbeat():
    """Fallback for GitHub's unreliable cron: trigger the relay poller every 10 min,
    but only while a relay run is in flight (otherwise it does nothing)."""
    if _runs_in_flight():
        print("runs in flight -> poller dispatch:", dispatch_poller("modal heartbeat (runs in flight)"))
    else:
        print("no relay runs in flight")


@app.function(secrets=[setup_secret, status_secret, *dispatch_secrets], min_containers=1, max_containers=2)
@modal.concurrent(max_inputs=100)
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
        events = live_status.get(f"runevents:{n}") or {}
        if events:
            record, pending = apply_run_events(record, events)
            if pending != events:
                if pending:
                    live_status[f"runevents:{n}"] = pending
                else:
                    live_status.pop(f"runevents:{n}", None)
        live_status[f"issue:{n}"] = record
        live_status["meta:version"] = (live_status.get("meta:version") or 0) + 1
        return JSONResponse({"ok": True, "updated": record["updated"]})

    # ---- run events from the Daytona driver ------------------------------------
    # The relay driver pings each stage change of its run (started, environment
    # built, verifier running, finished / failed). Each ping carries a per-run token
    # (HMAC-SHA256 of the run id under RELAY_STATUS_SECRET, minted at submit), so a
    # sandbox never holds a GitHub token or the secret. The ping moves the live
    # timeline at once and triggers the relay poller, which collects the results.
    RUN_EVENT_LABELS = {
        "started": "Daytona run started",
        "env_built": "Environment built, trial running",
        "verifying": "Evaluation running",
        "finished": "Daytona run finished, collecting results",
        "failed": "Daytona run failed, collecting logs",
    }

    @api.post("/run-event")
    def run_event(payload: dict | None = Body(default=None)):
        import hashlib
        import hmac
        import re as _re

        secret = os.environ.get("RELAY_STATUS_SECRET", "")
        if not secret or not isinstance(payload, dict):
            return Response("forbidden", status_code=403)
        rid = str(payload.get("run_id") or "")
        m = _re.fullmatch(r"gh-(\d+)-\d+(?:-\d+)?", rid)
        want = hmac.new(secret.encode(), rid.encode(), hashlib.sha256).hexdigest()
        if not m or not hmac.compare_digest(want, str(payload.get("token") or "")):
            return Response("forbidden", status_code=403)
        event = str(payload.get("event") or "")
        if event not in RUN_EVENT_LABELS:
            return JSONResponse({"error": "unknown event"}, status_code=400)
        n = int(m.group(1))
        now = int(datetime.now(timezone.utc).timestamp())
        events = dict(live_status.get(f"runevents:{n}") or {})
        events.setdefault(rid, {}).setdefault(event, now)    # first time each stage was seen
        rec = dict(live_status.get(f"issue:{n}") or {"issue": n, "steps": []})
        # an old-style separate event step (before the overlay) is dropped
        rec["steps"] = [s_ for s_ in rec.get("steps") or [] if not str(s_.get("key") or "").endswith(":event")]
        rec, pending = apply_run_events(rec, events)
        live_status[f"runevents:{n}"] = pending
        rec["updated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        live_status[f"issue:{n}"] = rec
        live_status["meta:version"] = (live_status.get("meta:version") or 0) + 1
        dispatched = 0
        if event in ("env_built", "verifying", "finished", "failed"):
            dispatched = dispatch_poller(f"run-event {event} {rid}")
        return JSONResponse({"ok": True, "dispatched": dispatched})

    @api.get("/status/stream")
    async def stream_status(request: Request):
        """Server-sent events: one `status` event with the full snapshot on connect
        and after every change; the stream closes after ~5 min and the client
        reconnects (EventSource does that by itself)."""
        import asyncio

        from fastapi.responses import StreamingResponse

        async def events():
            last = object()  # sentinel: always send the snapshot on connect
            for _ in range(300):
                if await request.is_disconnected():
                    return
                version = await live_status.get.aio("meta:version")
                if version != last:
                    last = version
                    snap = {}
                    async for k, v in live_status.items.aio():
                        if k.startswith("issue:"):
                            snap[k[6:]] = v
                    yield f"event: status\ndata: {json.dumps({'issues': snap})}\n\n"
                else:
                    yield ": keep-alive\n\n"
                await asyncio.sleep(1)

        resp = StreamingResponse(events(), media_type="text/event-stream")
        resp.headers["Cache-Control"] = "no-store"
        resp.headers["X-Accel-Buffering"] = "no"
        return cors(resp)

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

    MAINTAINERS = {m.strip().lower() for m in os.environ.get("RELAY_MAINTAINERS", "Imbernoulli").split(",") if m.strip()}

    def _is_maintainer(auth: str, login: str | None = None) -> bool:
        # The identity is GitHub-verified (/user); the maintainer list is ours. A
        # GitHub App user token does not always report repo admin rights, so the
        # list is the primary check and repo admin the fallback.
        if login and login.lower() in MAINTAINERS:
            return True
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
            if not user or not _is_maintainer(auth, user.get("login")):
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
        if not user or not _is_maintainer(auth, user.get("login")):
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
