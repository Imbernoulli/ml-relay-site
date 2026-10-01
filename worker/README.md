# GitHub sign-in for the ML-Relay site

The site is static (GitHub Pages). "My work" (`/me/`) reads the visitor's issues and
pull requests on the private `Imbernoulli/ML-Relay` repository from their browser, with
their own GitHub access. Two ways to sign in:

- **Personal access token** — works with no setup: a fine-grained token with access to
  `Imbernoulli/ML-Relay` only and read-only Issues + Pull requests. Kept in
  `sessionStorage` for the tab, sent only to `api.github.com`.
- **Sign in with GitHub** — appears once the steps below are done. GitHub's token
  endpoint needs the client secret and blocks browser requests, so this ~60-line
  Cloudflare Worker (`index.js`) trades the one-time code for a token. It stores and
  logs nothing.

## One-time setup (owner)

1. **Create a GitHub App** at https://github.com/settings/apps/new
   - Name: `ML-Relay site` · Homepage URL: `https://bohanlyu.com/ml-relay-site/`
   - Callback URL: `https://bohanlyu.com/ml-relay-site/auth/callback/` (exact, with the trailing slash)
   - Webhook: untick **Active**
   - Repository permissions: **Issues: Read-only**, **Pull requests: Read-only** (Metadata: Read-only is automatic). Nothing else.
   - Where can it be installed: **Only on this account**
   - Create it, note the **Client ID**, and **Generate a new client secret**.
   - **Install App** → only select repository `Imbernoulli/ML-Relay`.

   A signed-in visitor sees the intersection of the App's permissions, the repositories
   it is installed on, and their own access — so only ML-Relay collaborators see anything.

2. **Deploy the worker** (needs a free Cloudflare account):
   ```bash
   cd worker
   # put the Client ID into wrangler.toml: GH_CLIENT_ID = "Iv23..."
   npx wrangler login
   npx wrangler secret put GH_CLIENT_SECRET     # paste the client secret
   npx wrangler deploy                          # prints https://ml-relay-auth.<you>.workers.dev
   ```

3. **Point the site at it** and rebuild:
   ```bash
   gh variable set GH_CLIENT_ID  -R Imbernoulli/ml-relay-site --body "Iv23..."
   gh variable set GH_AUTH_PROXY -R Imbernoulli/ml-relay-site --body "https://ml-relay-auth.<you>.workers.dev"
   gh workflow run deploy.yml    -R Imbernoulli/ml-relay-site
   ```

To turn the button off again, delete the two variables and redeploy; the token option keeps working.
