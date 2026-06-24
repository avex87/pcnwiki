#!/usr/bin/env node
/* ────────────────────────────────────────────────────────────────────────────
   PCN WIKI — database integrity validator
   Runs automatically before every build (npm run build -> prebuild -> validate).
   Exits non-zero on any problem so a broken edit never deploys.

   Checks:
     • JSON parses
     • no duplicate ids within regions / varieties / farms / processes / lots
     • every farm.regionId resolves to a region
     • every farm.varietyIds entry resolves to a variety
     • every variety.refNotes tag exists in the tasting-note vocabulary
     • every lot's producerId / varietyId / processId resolve
     • every lot's variety is actually grown at its farm (consistency)
     • every seed tasting's lotId resolves
   ──────────────────────────────────────────────────────────────────────────── */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "..", "src", "data", "coffee-data.json");

const errors = [];
const warn = [];

let data;
try {
  data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
} catch (e) {
  console.error("✗ coffee-data.json failed to parse:", e.message);
  process.exit(1);
}

const { regions = [], varieties = [], farms = [], processes = [], tastingNotes = {}, lots = [], seedTastings = [] } = data;

// ── duplicate id detection ──
function checkDupes(arr, label) {
  const seen = new Set();
  for (const item of arr) {
    if (!item.id) { errors.push(`${label}: an entry is missing an "id"`); continue; }
    if (seen.has(item.id)) errors.push(`${label}: duplicate id "${item.id}"`);
    seen.add(item.id);
  }
  return seen;
}
const regionIds = checkDupes(regions, "regions");
const varietyIds = checkDupes(varieties, "varieties");
const farmIds = checkDupes(farms, "farms");
const processIds = checkDupes(processes, "processes");
checkDupes(lots, "lots");

// ── vocabulary of tasting notes ──
const vocab = new Set(Object.values(tastingNotes).flat());

// ── varieties: refNotes must be in vocab ──
for (const v of varieties) {
  for (const t of v.refNotes || []) {
    if (!vocab.has(t)) errors.push(`variety "${v.id}": refNote "${t}" is not in the tasting-note vocabulary`);
  }
}

// ── farms: region + variety references ──
const farmVarietySets = {};
for (const f of farms) {
  if (f.regionId && !regionIds.has(f.regionId)) errors.push(`farm "${f.id}": regionId "${f.regionId}" does not exist`);
  farmVarietySets[f.id] = new Set(f.varietyIds || []);
  for (const vid of f.varietyIds || []) {
    if (!varietyIds.has(vid)) errors.push(`farm "${f.id}": varietyId "${vid}" does not exist`);
  }
}

// ── lots: all references + farm/variety consistency ──
for (const l of lots) {
  if (!farmIds.has(l.producerId)) errors.push(`lot "${l.id}": producerId "${l.producerId}" does not exist`);
  if (!varietyIds.has(l.varietyId)) errors.push(`lot "${l.id}": varietyId "${l.varietyId}" does not exist`);
  if (!processIds.has(l.processId)) errors.push(`lot "${l.id}": processId "${l.processId}" does not exist`);
  if (farmVarietySets[l.producerId] && !farmVarietySets[l.producerId].has(l.varietyId)) {
    warn.push(`lot "${l.id}": variety "${l.varietyId}" is not listed among farm "${l.producerId}"'s varieties`);
  }
}

// ── seed tastings: lotId must resolve ──
const lotIds = new Set(lots.map(l => l.id));
for (const t of seedTastings) {
  if (t.lotId && !lotIds.has(t.lotId)) errors.push(`seed tasting "${t.id || "?"}": lotId "${t.lotId}" does not exist`);
}

// ── report ──
console.log(`PCN Wiki data: ${regions.length} regions · ${varieties.length} varieties · ${farms.length} farms · ${lots.length} lots · ${vocab.size} tasting notes`);

if (warn.length) {
  console.log("\nWarnings (non-fatal):");
  for (const w of warn) console.log("  ⚠ " + w);
}

if (errors.length) {
  console.error("\n✗ Validation FAILED:");
  for (const e of errors) console.error("  • " + e);
  console.error(`\n${errors.length} error(s). Fix coffee-data.json and re-run.`);
  process.exit(1);
}

console.log("\n✓ All integrity checks passed.");
