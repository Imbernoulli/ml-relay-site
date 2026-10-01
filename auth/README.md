# One-click GitHub sign-in for the ML-Relay site

"My work" (`/me/`) can read a visitor's issues and pull requests on the private
`Imbernoulli/ML-Relay` repository in their browser. With this service, signing in is
one click: **Sign in with GitHub → Authorize → back on the page**. Visitors never pick
repositories or permissions; those are fixed by the GitHub App.

GitHub's token endpoint needs the app's client secret and blocks browser requests, so
`modal_app.py` (a small scale-to-zero Modal web endpoint) does the code-for-token
exchange. It stores only the app's own client id and secret, nothing about visitors.

## Setup (done once)

1. Deploy (already deployed at `https://mletask--ml-relay-auth-web.modal.run`):
   ```bash
   SETUP_STATE=<random> modal deploy auth/modal_app.py
   ```
2. The owner opens `https://mletask--ml-relay-auth-web.modal.run/setup?state=<SETUP_STATE>`
   and clicks **Continue to GitHub → Create GitHub App → Install (only
   Imbernoulli/ML-Relay)**. The app is created from a manifest: read-only Issues and
   Pull requests, no webhook. Its client id and secret go straight into the service.
3. The site's build variable points at the service (already set):
   `gh variable set GH_AUTH_PROXY -R Imbernoulli/ml-relay-site --body https://mletask--ml-relay-auth-web.modal.run`

The "Sign in with GitHub" button reads the client id from the service at click time,
so no rebuild is needed after step 2. A visitor sees only what the App's permissions,
its installation (ML-Relay only) and their own access all allow.

Without the service the page still works: a fine-grained personal access token
(read-only Issues + Pull requests on ML-Relay) can be pasted instead.
