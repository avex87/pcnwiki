# PCN Wiki — submission queue Worker

A tiny Cloudflare Worker that stores the "Add" page submissions so the queue is
**shared across all visitors** (not just the submitter's browser). Uses one KV
namespace as a small JSON store; the queue is drained weekly when entries are
vetted and added to the database.

## One-time setup

From this `worker/` folder:

```bash
# 1. Install wrangler (Cloudflare's CLI) if you don't have it
npm install -g wrangler
wrangler login

# 2. Create the KV namespace
npx wrangler kv namespace create QUEUE_KV
#    → copy the printed id into wrangler.toml (replace REPLACE_WITH_KV_ID)

# 3. (Optional) protect the admin endpoints (/clear, /remove)
npx wrangler secret put ADMIN_TOKEN
#    → type a token; the site doesn't need it for submitting or reading

# 4. Deploy
npx wrangler deploy
#    → prints your Worker URL, e.g. https://pcn-wiki-queue.<you>.workers.dev
```

## Wire the front-end to it

In the deployed site, the Add page reads the Worker URL from a global set in
`index.html`. Edit `index.html` and set:

```html
<script>window.PCN_QUEUE_API = "https://pcn-wiki-queue.<you>.workers.dev";</script>
```

(Leave it unset/empty and the page silently falls back to per-browser
localStorage, so the site still works without the Worker.)

## Endpoints

| Method | Path      | Purpose                                  | Auth |
|--------|-----------|------------------------------------------|------|
| GET    | `/queue`  | Read the full pending queue              | none |
| POST   | `/submit` | Append one entry `{ type, vals }`        | none |
| POST   | `/remove` | Delete one entry `{ id }`                | token if set |
| POST   | `/clear`  | Empty the queue                          | token if set |

`type` is one of `lot`, `farm`, `variety`; `vals` carries the form fields.
Submissions are sanitized (allowed fields only, trimmed, length-capped) and the
queue is capped at 500 entries.
