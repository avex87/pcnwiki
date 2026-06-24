# PCN Wiki

A specialty coffee knowledge base — varieties, farms & producers, and tasting lots
from across the coffee world. Built with React + Vite, deployed as a static site on
Cloudflare Pages.

The entire catalogue lives in a single JSON file, so the "database" can be updated
with a one-file edit and a git push — no backend, no SQL.

---

## The database

All catalogue data is in:

```
src/data/coffee-data.json
```

It has these top-level keys:

| key            | what it is                                                        |
| -------------- | ----------------------------------------------------------------- |
| `regions`      | country + region lookup (`r_*` ids)                               |
| `varieties`    | coffee varieties / species (`v_*` ids)                            |
| `farms`        | farms & producers (`p_*` ids), each linked to a region + varieties |
| `processes`    | processing methods (`pr_*` ids)                                   |
| `tastingNotes` | the tasting-note vocabulary, grouped                              |
| `lots`         | farm × variety × process × year records (`l_*` ids)               |
| `seedTastings` | starter entries for the "My Log" tab                              |

Relationships are by id (e.g. a farm's `varietyIds` array, a lot's `producerId`).
The app reads this file at build time; nothing else needs to change to update content.

---

## Updating the database (the Claude workflow)

1. **Ask Claude** to make the change — e.g. *"add variety X from origin Y and link it
   to farm Z"*, or *"add a natural-process lot for Finca Deborah's Gesha."*
2. Claude edits **`src/data/coffee-data.json`** and runs the validator.
3. Commit the updated file and push to GitHub.
4. Cloudflare Pages auto-builds on push. The build runs `npm run validate` first
   (via the `prebuild` hook), so a broken reference **fails the build instead of
   deploying**. Site updates in ~1 minute.

### Validate locally any time

```
npm run validate
```

Checks: JSON parses, no duplicate ids, every farm→region / farm→variety /
lot→farm / lot→variety / lot→process reference resolves, every variety tasting-note
tag is in the vocabulary, and every lot's variety is actually grown at its farm.

---

## Local development

```
npm install
npm run dev        # http://localhost:5173
npm run build      # validates, then builds to /dist
npm run preview    # serve the built site locally
```

Requires Node 18+.

---

## Deploying to Cloudflare Pages

**Option A — connect the GitHub repo (recommended, auto-deploys on push):**

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git** → pick the repo.
3. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Save & Deploy. Every push to the main branch now redeploys automatically.

**Option B — direct upload via Wrangler:**

```
npm install -g wrangler
npm run build
wrangler pages deploy dist --project-name=pcn-wiki
```

---

## Notes

- The "My Log" tasting entries are per-visitor and live in the browser only — they
  are not written back to the shared database. That keeps the published site a
  read-only reference. If you later want visitors to write shared data, that's the
  point to add Cloudflare Workers + a D1 database; the data model here maps cleanly
  onto SQL tables (each top-level key becomes a table, relations stay by id).
- Variety facts (names, lineage) are not copyrightable; descriptions are written in
  original wording. Where a variety's origin is genuinely disputed, the note says so.
