import React, { useState, useMemo, useEffect } from "react";
import { Search, MapPin, Beaker, Star, Plus, X, Filter, Leaf, BookOpen, Flame, AlertTriangle } from "lucide-react";
import data from "./data/coffee-data.json";
import pcnLogo from "./assets/pcn-wiki-logo.png";

/* ────────────────────────────────────────────────────────────────────────────
   PCN WIKI — specialty coffee knowledge base
   All catalogue data lives in src/data/coffee-data.json (the "database").
   To update the database, edit that JSON file and redeploy — the component
   below never needs to change. Run `npm run validate` to check integrity.
   ──────────────────────────────────────────────────────────────────────────── */

// ── data (sourced from coffee-data.json) ───────────────────────────────────────
const REGIONS = data.regions;
const VARIETIES = data.varieties;
const FARMS = data.farms;
const PROCESSES = data.processes;
const LOTS = data.lots;

// ── derived tag sets ────────────────────────────────────────────────────────────

// ── search normalization ─────────────────────────────────────────────────────────
// Folds accents and common spelling variants so a search for "geisha" finds
// "Gesha", "borbon" finds "Bourbon", etc. Applied to both query and target text.
const SYNONYMS = [
  [/geisha/g, "gesha"],
  [/wush ?wush/g, "wush"],
  [/borbon/g, "bourbon"],
  [/maragog[iy]pe?/g, "maragogipe"],
  [/catu?ai/g, "catuai"],
  [/yirgacheffe?/g, "yirgacheffe"],
];
function normalize(s) {
  let t = (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [re, to] of SYNONYMS) t = t.replace(re, to);
  return t;
}

const PINK = "#E85A8C";
const BEAN = "#3A5A40";
const ROAST = "#2B1D14";

// ── inaccuracy reports ────────────────────────────────────────────────────────
// Reports are filed from the reference cards but reviewed in the Add page, so
// they live in the same shared store as the queue (Worker if configured, else
// localStorage). A window event lets a mounted report list refresh on the spot.
const REPORTS_API = (typeof window !== "undefined" && window.PCN_QUEUE_API) || "";
const REPORTS_KEY = "pcn-reports";
function loadReportsLocal() {
  try { const raw = window.localStorage.getItem(REPORTS_KEY); return raw ? JSON.parse(raw) : []; }
  catch (e) { return []; }
}
function fileReport({ kind, refId, name }) {
  const entry = {
    id: "r" + Date.now() + Math.random().toString(36).slice(2, 6),
    kind, refId, name,
    date: new Date().toISOString().slice(0, 10),
  };
  if (REPORTS_API) {
    fetch(REPORTS_API + "/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    }).catch(() => {});
  } else {
    try {
      const list = loadReportsLocal();
      list.unshift(entry);
      window.localStorage.setItem(REPORTS_KEY, JSON.stringify(list));
    } catch (e) { /* storage unavailable */ }
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("pcn-report-filed", { detail: entry }));
}

// Custom coffee-sack icon (lucide has no sack). Stroke-based to match the
// lucide icon set: takes a `size` prop and inherits color via currentColor.
function Sack({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* cinched, tied neck */}
      <path d="M9 2h6l-1.2 2.2a2 2 0 0 0 .15 2.13C15.3 7.9 16 9.4 16 11" />
      <path d="M9 2l1.2 2.2a2 2 0 0 1-.15 2.13C8.7 7.9 8 9.4 8 11" />
      {/* rounded body of the sack */}
      <path d="M8 11c-1.5 1.4-2.5 3.6-2.5 6 0 2.5 1.8 5 6.5 5s6.5-2.5 6.5-5c0-2.4-1-4.6-2.5-6" />
    </svg>
  );
}

export default function CoffeeKB() {
  const [view, setView] = useState("varieties"); // varieties | lots | log
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState([]);
  const [selectedVariety, setSelectedVariety] = useState(null);
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [farmCountry, setFarmCountry] = useState("All");
  const [famousOnly, setFamousOnly] = useState(false);

  const regionById = useMemo(() => Object.fromEntries(REGIONS.map(r => [r.id, r])), []);
  const varietyById = useMemo(() => Object.fromEntries(VARIETIES.map(v => [v.id, v])), []);
  const farmById = useMemo(() => Object.fromEntries(FARMS.map(p => [p.id, p])), []);
  const processById = useMemo(() => Object.fromEntries(PROCESSES.map(p => [p.id, p])), []);
  const lotById = useMemo(() => Object.fromEntries(LOTS.map(l => [l.id, l])), []);

  const toggleTag = (t) =>
    setActiveTags(a => a.includes(t) ? a.filter(x => x !== t) : [...a, t]);

  // Varieties filter by character traits, Lots by free-form notes — different
  // vocabularies, so clear active tags when switching between filterable views.
  const changeView = (next) => {
    setView(prev => {
      if (prev !== next) setActiveTags([]);
      return next;
    });
  };

  const filtering = query.trim().length > 0 || activeTags.length > 0;

  // Varieties filter by inherent CHARACTER TRAITS (controlled list).
  // Lots filter by their own free-form roaster TASTING NOTES.
  const varietyTraitSet = useMemo(() => new Set(VARIETIES.flatMap(v => v.traits || [])), []);
  const lotNoteSet = useMemo(() => {
    const s = new Set();
    for (const l of LOTS) (l.notes || []).forEach(n => s.add(n));
    return s;
  }, []);

  const filteredVarieties = useMemo(() => {
    const q = normalize(query);
    return VARIETIES.filter(v => {
      const traits = v.traits || [];
      const matchQ = !q || [v.name, v.group, v.note, v.origin, v.species, v.parents]
        .some(f => normalize(f).includes(q)) || traits.some(t => normalize(t).includes(q));
      const matchTags = activeTags.length === 0 || activeTags.every(t => traits.includes(t));
      return matchQ && matchTags;
    });
  }, [query, activeTags]);

  const filteredLots = useMemo(() => {
    const q = normalize(query);
    return LOTS.filter(l => {
      const v = varietyById[l.varietyId], p = farmById[l.producerId];
      const pr = processById[l.processId], reg = p && regionById[p.regionId];
      const lotNotes = l.notes || [];   // free-form roaster notes only; no variety fallback
      const matchQ = !q || [l.name, String(l.year), l.source, v && v.name, p && p.name, p && p.people,
        pr && pr.name, reg && reg.region, reg && reg.country]
        .some(f => normalize(f).includes(q)) || lotNotes.some(t => normalize(t).includes(q));
      const matchTags = activeTags.length === 0 || activeTags.every(t => lotNotes.includes(t));
      return matchQ && matchTags;
    });
  }, [query, activeTags, varietyById, farmById, processById, regionById]);

  const filteredFarms = useMemo(() => {
    const q = normalize(query);
    return FARMS.filter(f => {
      const reg = regionById[f.regionId];
      const byCountry = farmCountry === "All" || (reg && reg.country === farmCountry);
      const byFamous = !famousOnly || f.famous;
      const grownVarieties = (f.varietyIds || []).map(id => varietyById[id] && varietyById[id].name).filter(Boolean);
      const matchQ = !q || [f.name, f.people, f.note, f.altitude, reg && reg.region, reg && reg.country]
        .some(field => normalize(field).includes(q)) || grownVarieties.some(n => normalize(n).includes(q));
      return byCountry && byFamous && matchQ;
    });
  }, [query, farmCountry, famousOnly, regionById, varietyById]);

  return (
    <div style={{ minHeight: "100vh", background: "#F7F4EF", color: ROAST, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .chip { cursor:pointer; border:1px solid rgba(43,29,20,.18); background:transparent; padding:4px 10px; border-radius:999px; font-size:12px; transition:all .15s; }
        .chip:hover { border-color:${PINK}; }
        .chip.on { background:${PINK}; color:#fff; border-color:${PINK}; }
        .navbtn { cursor:pointer; background:none; border:none; padding:8px 2px; font-size:14px; font-weight:600; color:rgba(43,29,20,.45); border-bottom:2px solid transparent; display:flex; gap:6px; align-items:center; white-space:nowrap; flex:0 0 auto; }
        .navbtn.on { color:${ROAST}; border-bottom-color:${PINK}; }
        nav::-webkit-scrollbar { display:none; }
        @media (max-width: 480px) {
          .navbtn { font-size:13px; gap:5px; padding:8px 0; }
          /* only when filtering (badges present) and space is tight: collapse inactive labels to icons */
          nav.filtering .navbtn:not(.on):not(.navadd) .navlabel { display:none; }
        }
        @media (prefers-reduced-motion: reduce){ * { animation:none !important } }
        .card { background:#fff; border:1px solid rgba(43,29,20,.08); border-radius:14px; transition:transform .15s, box-shadow .15s; }
        .card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(43,29,20,.08); }
        input, textarea, select { font-family:inherit; }
        button:focus-visible, .chip:focus-visible { outline:2px solid ${PINK}; outline-offset:2px; }
      `}</style>

      {/* header */}
      <header style={{ borderBottom: `1px solid rgba(43,29,20,.1)`, background: "#fff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span className="mono" style={{ fontSize: 11, letterSpacing: 2, color: PINK, fontWeight: 700 }}>CULTIVAR · PRODUCER · CUP</span>
          </div>
          <div style={{ margin: "6px 0 0" }}>
            <PcgnLogo />
          </div>
          <p style={{ margin: "8px 0 18px", color: "rgba(43,29,20,.6)", fontSize: 15, maxWidth: 560 }}>
            A living reference of specialty varieties, the farms and producers who grow them, and how they taste in the cup.
          </p>
          <nav className={filtering ? "filtering" : ""} style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "nowrap", overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
            <button className={`navbtn ${view === "varieties" ? "on" : ""}`} onClick={() => changeView("varieties")} aria-label="Varieties"><Leaf size={15} /><span className="navlabel">Varieties</span>{filtering && <TabCount n={filteredVarieties.length} active={view === "varieties"} />}</button>
            <button className={`navbtn ${view === "farms" ? "on" : ""}`} onClick={() => changeView("farms")} aria-label="Farms"><MapPin size={15} /><span className="navlabel">Farms</span>{filtering && <TabCount n={filteredFarms.length} active={view === "farms"} />}</button>
            <button className={`navbtn ${view === "lots" ? "on" : ""}`} onClick={() => changeView("lots")} aria-label="Lots"><Sack size={15} /><span className="navlabel">Lots</span>{filtering && <TabCount n={filteredLots.length} active={view === "lots"} />}</button>
            <button className={`navbtn navadd ${view === "add" ? "on" : ""}`} onClick={() => changeView("add")} aria-label="Add"><Plus size={15} /><span className="navlabel">Add</span></button>
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px" }}>
        {/* search + tag filter (shared on reference views) */}
        {(view === "varieties" || view === "farms" || view === "lots") && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ position: "relative", marginBottom: 14 }}>
              <Search size={17} style={{ position: "absolute", left: 14, top: 13, color: "rgba(43,29,20,.4)" }} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={view === "varieties" ? "Search varieties, lineage, origin, character…" : view === "farms" ? "Search farms, growers, regions, varieties grown…" : "Search lots, producers, varieties, process, origin…"}
                style={{ width: "100%", padding: "11px 14px 11px 40px", borderRadius: 10, border: "1px solid rgba(43,29,20,.15)", fontSize: 15, background: "#fff" }}
              />
            </div>
            {view === "varieties" && (
              <TraitPicker activeTags={activeTags} toggleTag={toggleTag} clearTags={() => setActiveTags([])} present={varietyTraitSet} />
            )}
            {view === "lots" && lotNoteSet.size > 0 && (
              <NotePicker activeTags={activeTags} toggleTag={toggleTag} clearTags={() => setActiveTags([])} notes={lotNoteSet} />
            )}
          </div>
        )}

        {/* ── VARIETIES ── */}
        {view === "varieties" && (
          <div>
            <CountLine shown={filteredVarieties.length} total={VARIETIES.length} noun="varieties" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
            {filteredVarieties.map(v => (
              <div key={v.id} className="card" style={{ padding: 18, cursor: "pointer" }} onClick={() => setSelectedVariety(v)}>
                <h3 style={{ fontSize: 21, fontWeight: 600, margin: "0 0 12px", letterSpacing: "-0.01em" }}>{v.name}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "5px 12px", marginBottom: 12 }}>
                  <CardFact label="Species" value={v.species} accent={v.species !== "Arabica"} />
                  <CardFact label="Origin" value={v.origin} />
                  <CardFact label="Lineage" value={v.group} />
                </div>
                <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "rgba(43,29,20,.75)", margin: "0 0 12px" }}>{v.note}</p>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {(v.traits || []).map(t => (
                    <span key={t} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(58,90,64,.1)", color: BEAN }}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
            {filteredVarieties.length === 0 && <EmptyState msg={filtering ? "No varieties match your search." : "No varieties yet."} elsewhere={[{ label: "farms", n: filteredFarms.length, onClick: () => changeView("farms") }, { label: "lots", n: filteredLots.length, onClick: () => changeView("lots") }]} />}
            </div>
          </div>
        )}

        {/* ── LOTS ── */}
        {view === "lots" && (
          <div>
            <CountLine shown={filteredLots.length} total={LOTS.length} noun="lots" />
            <div style={{ display: "grid", gap: 12 }}>
            {filteredLots.map(l => {
              const v = varietyById[l.varietyId], p = farmById[l.producerId], pr = processById[l.processId], reg = p && regionById[p.regionId];
              return (
                <div key={l.id} className="card" style={{ padding: 18, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div className="mono" style={{ fontSize: 10, color: PINK, letterSpacing: 1 }}>{l.id.toUpperCase()} · {l.year}</div>
                    <h3 style={{ fontSize: 19, margin: "3px 0 8px", fontWeight: 600, letterSpacing: "-0.01em" }}>{l.name}</h3>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: "rgba(43,29,20,.7)" }}>
                      <button onClick={() => v && setSelectedVariety(v)} style={{ display: "flex", gap: 5, alignItems: "center", background: "none", border: "none", padding: 0, font: "inherit", color: "inherit", cursor: v ? "pointer" : "default" }}><Leaf size={13} color={BEAN} /><span style={{ borderBottom: v ? "1px dotted rgba(43,29,20,.35)" : "none" }}>{v ? v.name : "—"}</span></button>
                      <button onClick={() => p && setSelectedFarm(p)} style={{ display: "flex", gap: 5, alignItems: "center", background: "none", border: "none", padding: 0, font: "inherit", color: "inherit", cursor: p ? "pointer" : "default" }}><MapPin size={13} color={BEAN} /><span style={{ borderBottom: p ? "1px dotted rgba(43,29,20,.35)" : "none" }}>{p ? p.name : "—"}</span>{reg ? `, ${reg.region}` : ""}</button>
                      <span style={{ display: "flex", gap: 5, alignItems: "center" }}><Beaker size={13} color={BEAN} />{pr.name}</span>
                    </div>
                    {l.notes && l.notes.length > 0 && (
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 }}>
                        {l.notes.map(t => (
                          <span key={t} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(232,90,140,.1)", color: PINK }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {l.source && (
                    <span className="mono" title={`Documented via ${l.source}`} style={{ fontSize: 10, color: "rgba(43,29,20,.4)", whiteSpace: "nowrap", alignSelf: "flex-start" }}>
                      via {l.source}
                    </span>
                  )}
                </div>
              );
            })}
            {filteredLots.length === 0 && <EmptyState msg={filtering ? "No lots match your search." : "No lots yet."} elsewhere={[{ label: "varieties", n: filteredVarieties.length, onClick: () => changeView("varieties") }, { label: "farms", n: filteredFarms.length, onClick: () => changeView("farms") }]} />}
            </div>
          </div>
        )}

        {/* ── FARMS ── */}
        {view === "farms" && (() => {
          const countries = ["All", ...[...new Set(FARMS.map(f => regionById[f.regionId]?.country).filter(Boolean))].sort()];
          const farms = filteredFarms;
          // how many farms match the SEARCH alone, ignoring the famous/country filters?
          // tells the empty state whether a filter (not the query) is hiding results.
          const q = normalize(query);
          const matchesSearchOnly = FARMS.filter(f => {
            const reg = regionById[f.regionId];
            const grown = (f.varietyIds || []).map(id => varietyById[id] && varietyById[id].name).filter(Boolean);
            return !q || [f.name, f.people, f.note, f.altitude, reg && reg.region, reg && reg.country]
              .some(field => normalize(field).includes(q)) || grown.some(n => normalize(n).includes(q));
          }).length;
          const filterHidingMatches = farms.length === 0 && matchesSearchOnly > 0 && (famousOnly || farmCountry !== "All");
          return (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(43,29,20,.5)", fontWeight: 600 }}><Filter size={13} /> Country</span>
                {countries.map(c => (
                  <button key={c} className={`chip ${farmCountry === c ? "on" : ""}`} onClick={() => setFarmCountry(c)}>{c}</button>
                ))}
                <span style={{ width: 1, height: 18, background: "rgba(43,29,20,.15)", margin: "0 4px" }} />
                <button
                  className={`chip ${famousOnly ? "on" : ""}`}
                  onClick={() => setFamousOnly(v => !v)}
                  style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 600 }}
                >
                  <Star size={12} fill={famousOnly ? "#fff" : "none"} /> Famous only
                </button>
              </div>
              <CountLine shown={farms.length} total={FARMS.length} noun="farms" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
                {farms.map(f => {
                  const reg = regionById[f.regionId];
                  return (
                    <div key={f.id} className="card" style={{ padding: 18, cursor: "pointer" }} onClick={() => setSelectedFarm(f)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <h3 style={{ fontSize: 19, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>{f.name}</h3>
                        {f.notable && <span className="mono" title={f.notable || undefined} style={{ fontSize: 9, padding: "3px 7px", borderRadius: 6, background: "rgba(232,90,140,.12)", color: PINK, whiteSpace: "nowrap" }}>FAMOUS</span>}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "5px 12px", margin: "12px 0" }}>
                        <CardFact label="Grower" value={f.people} />
                        <CardFact label="Origin" value={reg ? `${reg.region}, ${reg.country}` : "—"} />
                        <CardFact label="Altitude" value={f.altitude} />
                      </div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {f.varietyIds.slice(0, 4).map(vid => varietyById[vid] && (
                          <span key={vid} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(58,90,64,.1)", color: BEAN }}>{varietyById[vid].name}</span>
                        ))}
                        {f.varietyIds.length > 4 && <span style={{ fontSize: 11, color: "rgba(43,29,20,.45)", padding: "2px 4px" }}>+{f.varietyIds.length - 4}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {farms.length === 0 && (
                filterHidingMatches ? (
                  <div style={{ gridColumn: "1/-1", padding: "40px 24px", textAlign: "center", color: "rgba(43,29,20,.6)", border: "1px dashed rgba(43,29,20,.2)", borderRadius: 14 }}>
                    <Filter size={26} style={{ opacity: .4 }} />
                    <p style={{ marginTop: 10, fontSize: 14 }}>
                      {matchesSearchOnly} farm{matchesSearchOnly === 1 ? "" : "s"} match{matchesSearchOnly === 1 ? "es" : ""} your search, but {famousOnly && farmCountry !== "All" ? "your filters are" : famousOnly ? "“Famous only” is" : "the country filter is"} hiding {matchesSearchOnly === 1 ? "it" : "them"}.
                    </p>
                    <button
                      onClick={() => { setFamousOnly(false); setFarmCountry("All"); }}
                      style={{ marginTop: 6, background: ROAST, color: "#fff", border: "none", padding: "8px 16px", borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <EmptyState msg={filtering ? "No farms match your search." : "No farms yet."} elsewhere={[{ label: "varieties", n: filteredVarieties.length, onClick: () => changeView("varieties") }, { label: "lots", n: filteredLots.length, onClick: () => changeView("lots") }]} />
                )
              )}
            </div>
          );
        })()}

        {/* ── ADD ── */}
        {view === "add" && (
          <AddContribute />
        )}
      </main>

      {/* variety detail drawer */}
      {selectedVariety && (
        <Drawer onClose={() => setSelectedVariety(null)}>
          <span className="mono" style={{ fontSize: 11, color: PINK, letterSpacing: 1 }}>{selectedVariety.species.toUpperCase()}</span>
          <h2 style={{ fontSize: 34, fontWeight: 600, margin: "6px 0 0", letterSpacing: "-0.02em" }}>{selectedVariety.name}</h2>
          <div style={{ margin: "16px 0", paddingTop: 16, borderTop: "1px solid rgba(43,29,20,.1)", display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 14px" }}>
            <CardFact label="Species" value={selectedVariety.species} accent={selectedVariety.species !== "Arabica"} />
            <CardFact label="Origin" value={selectedVariety.origin} />
            <CardFact label="Lineage" value={selectedVariety.group} />
            <CardFact label="Parentage" value={selectedVariety.parents} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <Label>Character</Label>
            <p style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.55 }}>{selectedVariety.note}</p>
          </div>
          <div style={{ marginBottom: 16 }}>
            <Label>Character traits</Label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {(selectedVariety.traits || []).map(t => (
                <span key={t} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 999, background: "rgba(58,90,64,.1)", color: BEAN }}>{t}</span>
              ))}
            </div>
          </div>
          <div>
            <Label>Lots in this database</Label>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {LOTS.filter(l => l.varietyId === selectedVariety.id).map(l => (
                <div key={l.id} className="mono" style={{ fontSize: 12, padding: "8px 12px", background: "rgba(43,29,20,.04)", borderRadius: 8 }}>{l.name} · {l.year}</div>
              ))}
              {LOTS.filter(l => l.varietyId === selectedVariety.id).length === 0 && (
                <p style={{ fontSize: 13, color: "rgba(43,29,20,.5)" }}>No lots logged yet for this variety.</p>
              )}
            </div>
            <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid rgba(43,29,20,.1)" }}>
              <ReportButton kind="variety" refId={selectedVariety.id} name={selectedVariety.name} />
            </div>
          </div>
        </Drawer>
      )}

      {/* farm detail drawer */}
      {selectedFarm && (() => {
        const reg = regionById[selectedFarm.regionId];
        return (
          <Drawer onClose={() => setSelectedFarm(null)}>
            <span className="mono" style={{ fontSize: 11, color: PINK, letterSpacing: 1 }}>{reg ? reg.country.toUpperCase() : "FARM"}{selectedFarm.notable ? " · FAMOUS" : ""}</span>
            <h2 style={{ fontSize: 30, fontWeight: 600, margin: "6px 0 0", letterSpacing: "-0.02em" }}>{selectedFarm.name}</h2>
            {selectedFarm.notable && (
              <div style={{ marginTop: 12, padding: "10px 13px", background: "rgba(232,90,140,.08)", borderLeft: `3px solid ${PINK}`, borderRadius: 8 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, lineHeight: 1.5, color: ROAST }}>
                  <Star size={13} fill={PINK} color={PINK} style={{ flexShrink: 0 }} /> {selectedFarm.notable}
                </span>
              </div>
            )}
            <div style={{ margin: "16px 0", paddingTop: 16, borderTop: "1px solid rgba(43,29,20,.1)", display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 14px" }}>
              <CardFact label="Grower" value={selectedFarm.people} />
              <CardFact label="Region" value={reg ? reg.region : "—"} />
              <CardFact label="Country" value={reg ? reg.country : "—"} />
              <CardFact label="Altitude" value={selectedFarm.altitude} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <Label>About</Label>
              <p style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.55 }}>{selectedFarm.note}</p>
            </div>
            <div>
              <Label>Varieties grown</Label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {selectedFarm.varietyIds.map(vid => varietyById[vid] && (
                  <button key={vid} onClick={() => { setSelectedFarm(null); setSelectedVariety(varietyById[vid]); }}
                    style={{ fontSize: 12, padding: "4px 11px", borderRadius: 999, background: "rgba(58,90,64,.1)", color: BEAN, border: "none", cursor: "pointer" }}>
                    {varietyById[vid].name}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid rgba(43,29,20,.1)" }}>
              <ReportButton kind="farm" refId={selectedFarm.id} name={selectedFarm.name} />
            </div>
          </Drawer>
        );
      })()}

    </div>
  );
}

// Variety character traits — an expanded, curated descriptive vocabulary
// (roaster / SCA flavour-wheel style), grouped aromatics → fruit → sweetness →
// structure → overall. Describes a variety's typical character tendencies.
const TRAIT_VOCAB = [
  "Floral", "Jasmine", "Tea-like", "Bergamot", "Perfumed",
  "Fruit-forward", "Tropical", "Stone fruit", "Berry-like", "Citrussy", "Winey",
  "Sweet", "Honeyed", "Caramelly", "Chocolatey", "Nutty",
  "High acidity", "Bright", "Medium acidity", "Low acidity",
  "Full body", "Medium body", "Delicate body", "Syrupy",
  "Complex", "Elegant", "Clean", "Balanced", "Rustic",
];

// Varieties: filter by inherent character traits (green chips, controlled list).
function TraitPicker({ activeTags, toggleTag, clearTags, present }) {
  const activeSet = new Set(activeTags);
  const traits = TRAIT_VOCAB.filter(t => !present || present.has(t));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(43,29,20,.5)", fontWeight: 600 }}><Filter size={13} /> Character</span>
        {traits.map(t => (
          <button
            key={t}
            onClick={() => toggleTag(t)}
            className="chip"
            style={activeSet.has(t)
              ? { background: BEAN, color: "#fff", borderColor: BEAN }
              : undefined}
          >{t}</button>
        ))}
        {activeTags.length > 0 && (
          <button className="chip" onClick={clearTags} style={{ color: PINK, fontWeight: 600 }}>clear ×</button>
        )}
      </div>
    </div>
  );
}

// Lots: filter by free-form roaster tasting notes (pink chips, only those present).
function NotePicker({ activeTags, toggleTag, clearTags, notes }) {
  const [open, setOpen] = useState(false);
  const activeSet = new Set(activeTags);
  const all = [...notes].sort();
  const shown = open ? all : all.slice(0, 18);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(43,29,20,.5)", fontWeight: 600 }}><Filter size={13} /> Tasting notes</span>
        {shown.map(t => (
          <button key={t} className={`chip ${activeSet.has(t) ? "on" : ""}`} onClick={() => toggleTag(t)}>{t}</button>
        ))}
        {all.length > 18 && (
          <button className="chip" onClick={() => setOpen(o => !o)} style={{ color: BEAN, fontWeight: 600 }}>
            {open ? "fewer −" : `+${all.length - 18} more`}
          </button>
        )}
        {activeTags.length > 0 && (
          <button className="chip" onClick={clearTags} style={{ color: PINK, fontWeight: 600 }}>clear ×</button>
        )}
      </div>
    </div>
  );
}

function Label({ children }) {
  return <span className="mono" style={{ fontSize: 10, letterSpacing: 1.5, color: "rgba(43,29,20,.45)", textTransform: "uppercase", fontWeight: 700 }}>{children}</span>;
}

function TabCount({ n, active }) {
  return (
    <span style={{
      marginLeft: 4, fontSize: 10, fontWeight: 700, lineHeight: 1,
      padding: "2px 5px", borderRadius: 999, flexShrink: 0,
      background: active ? PINK : (n ? "rgba(232,90,140,.12)" : "rgba(43,29,20,.08)"),
      color: active ? "#fff" : (n ? PINK : "rgba(43,29,20,.4)"),
    }}>{n}</span>
  );
}

function CardFact({ label, value, accent }) {
  return (
    <>
      <span className="mono" style={{ fontSize: 10, letterSpacing: 1, color: "rgba(43,29,20,.4)", textTransform: "uppercase", fontWeight: 700, paddingTop: 2 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: accent ? PINK : "rgba(43,29,20,.85)" }}>{(value && String(value).trim()) ? value : "—"}</span>
    </>
  );
}

// Small "Report inaccuracy" control placed on every reference card/drawer.
// Filing a report adds it to the review list under the Add page's queue.
function ReportButton({ kind, refId, name, style }) {
  const [done, setDone] = useState(false);
  const handle = (ev) => {
    ev.stopPropagation();              // don't trigger the card's own click
    if (done) return;
    fileReport({ kind, refId, name });
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  };
  return (
    <button
      onClick={handle}
      title="Report an inaccuracy in this entry"
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        background: "none", border: "none", cursor: done ? "default" : "pointer",
        color: done ? BEAN : "rgba(43,29,20,.4)", fontSize: 11, fontWeight: 600,
        padding: 2, ...style,
      }}
    >
      <AlertTriangle size={12} /> {done ? "Reported ✓" : "Report inaccuracy"}
    </button>
  );
}

function PcgnLogo() {
  return (
    <img
      src={pcnLogo}
      alt="PCN Wiki"
      style={{ height: 46, width: "auto", maxWidth: "100%", display: "block" }}
    />
  );
}

function CountLine({ shown, total, noun }) {
  const filtered = shown !== total;
  return (
    <div style={{ margin: "0 0 16px" }}>
      <span
        className="mono"
        style={{
          display: "inline-block",
          fontSize: 11,
          letterSpacing: 1,
          fontWeight: 700,
          textTransform: "uppercase",
          color: PINK,
          background: "rgba(232,90,140,.1)",
          border: "1px solid rgba(232,90,140,.25)",
          padding: "4px 11px",
          borderRadius: 999,
        }}
      >
        {filtered
          ? `${shown} of ${total} ${noun}`
          : `${total} ${noun}`}
      </span>
    </div>
  );
}

function EmptyState({ msg, elsewhere }) {
  // elsewhere: [{ label, n, onClick }] — other tabs that DO have matches
  const hits = (elsewhere || []).filter(e => e.n > 0);
  return (
    <div style={{ gridColumn: "1/-1", padding: "48px 24px", textAlign: "center", color: "rgba(43,29,20,.5)", border: "1px dashed rgba(43,29,20,.2)", borderRadius: 14 }}>
      <BookOpen size={28} style={{ opacity: .4 }} />
      <p style={{ marginTop: 10, fontSize: 14 }}>{msg}</p>
      {hits.length > 0 && (
        <p style={{ marginTop: 4, fontSize: 14 }}>
          Found elsewhere:{" "}
          {hits.map((e, i) => (
            <React.Fragment key={e.label}>
              {i > 0 && " · "}
              <button onClick={e.onClick} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: PINK, fontWeight: 600, fontSize: 14 }}>
                {e.n} {e.label}
              </button>
            </React.Fragment>
          ))}
        </p>
      )}
    </div>
  );
}

function Drawer({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(43,29,20,.35)", display: "flex", justifyContent: "flex-end", zIndex: 50 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "min(440px,100%)", background: "#F7F4EF", height: "100%", padding: 28, overflowY: "auto", boxShadow: "-12px 0 40px rgba(43,29,20,.15)" }}>
        <button onClick={onClose} style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "rgba(43,29,20,.5)" }}><X size={22} /></button>
        {children}
      </div>
    </div>
  );
}

function AddContribute() {
  const [open, setOpen] = useState(null); // 'lot' | 'farm' | 'variety' | 'roaster' | null
  const [queue, setQueue] = useState([]);
  const [copied, setCopied] = useState(false);
  const [clearPw, setClearPw] = useState("");
  const [clearErr, setClearErr] = useState(false);
  const CLEAR_PASSWORD = "nx2rkaro";

  // If a Worker URL is configured (window.PCN_QUEUE_API, set in index.html),
  // the queue is shared across all visitors via that backend. Otherwise it
  // falls back to this browser's localStorage so the page still works offline.
  const API = (typeof window !== "undefined" && window.PCN_QUEUE_API) || "";

  // Load the queue on mount — from the Worker if configured, else localStorage.
  useEffect(() => {
    let cancelled = false;
    if (API) {
      fetch(API + "/queue")
        .then(r => r.json())
        .then(d => { if (!cancelled && Array.isArray(d.queue)) setQueue(d.queue); })
        .catch(() => { /* network/Worker down — leave queue empty */ });
    } else {
      try {
        const raw = window.localStorage.getItem("pcn-queue");
        if (raw) setQueue(JSON.parse(raw));
      } catch (e) { /* storage unavailable — run in-memory */ }
    }
    return () => { cancelled = true; };
  }, [API]);

  // In localStorage mode, persist on every change. (In Worker mode the backend
  // is the source of truth, so we don't mirror to localStorage.)
  useEffect(() => {
    if (API) return;
    try { window.localStorage.setItem("pcn-queue", JSON.stringify(queue)); }
    catch (e) { /* ignore */ }
  }, [queue, API]);

  const options = [
    { key: "lot", label: "Add a lot", icon: Sack,
      blurb: "A specific coffee — a named lot from a farm.",
      fields: [
        { name: "lotName", label: "Lot name", placeholder: "e.g. Pink Bourbon Washed" },
        { name: "lotFarm", label: "Farm", placeholder: "Which farm grew it?" },
        { name: "country", label: "Country of origin", placeholder: "e.g. Colombia" },
        { name: "contributor", label: "Contributor's name", placeholder: "Who's suggesting this?" },
      ] },
    { key: "farm", label: "Add a farm", icon: MapPin,
      blurb: "A producer or estate that grows coffee.",
      fields: [
        { name: "farmName", label: "Farm name", placeholder: "e.g. Finca El Mirador" },
        { name: "owner", label: "Owner's name", placeholder: "Who runs the farm?" },
        { name: "country", label: "Country", placeholder: "e.g. Ethiopia" },
        { name: "contributor", label: "Contributor's name", placeholder: "Who's suggesting this?" },
      ] },
    { key: "variety", label: "Add a variety", icon: Leaf,
      blurb: "A coffee cultivar or landrace.",
      fields: [
        { name: "varietyName", label: "Variety name", placeholder: "e.g. Sidra" },
        { name: "country", label: "Country of origin", placeholder: "e.g. Ecuador" },
        { name: "contributor", label: "Contributor's name", placeholder: "Who's suggesting this?" },
      ] },
    { key: "roaster", label: "Add a roaster", icon: Flame,
      blurb: "A roaster's whole lineup, sourced from their website.",
      fields: [
        { name: "website", label: "Roaster's website", placeholder: "e.g. flowerchildcoffee.com" },
        { name: "contributor", label: "Contributor's name", placeholder: "Who's suggesting this?" },
      ] },
  ];
  const optByKey = Object.fromEntries(options.map(o => [o.key, o]));

  const addToQueue = (type, vals) => {
    if (API) {
      // optimistic: show immediately, reconcile with the server's entry
      const temp = { id: "tmp" + Date.now(), type, vals, date: new Date().toISOString().slice(0, 10) };
      setQueue(q => [temp, ...q]);
      fetch(API + "/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, vals }),
      })
        .then(r => r.json())
        .then(d => { if (d.entry) setQueue(q => q.map(e => e.id === temp.id ? d.entry : e)); })
        .catch(() => { /* keep optimistic entry; it'll sync on next load */ });
      return;
    }
    const entry = {
      id: "q" + Date.now() + Math.random().toString(36).slice(2, 6),
      type,
      vals,
      date: new Date().toISOString().slice(0, 10),
    };
    setQueue(q => [entry, ...q]);
  };

  const removeFromQueue = (id) => {
    setQueue(q => q.filter(e => e.id !== id));
    if (API) {
      fetch(API + "/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }).catch(() => {});
    }
  };

  const clearQueue = () => {
    if (clearPw !== CLEAR_PASSWORD) { setClearErr(true); return; }
    setQueue([]);
    setClearPw("");
    setClearErr(false);
    if (API) {
      fetch(API + "/clear", { method: "POST" }).catch(() => {});
    }
  };

  // one-line, paste-friendly text for a single entry
  const entryToText = (e) => {
    const opt = optByKey[e.type];
    const parts = opt.fields.map(f => e.vals[f.name]).filter(Boolean);
    return e.type.toUpperCase() + " — " + parts.join(" | ") + "  (submitted " + e.date + ")";
  };
  const copyAll = () => {
    const text = queue.map(entryToText).join("\n");
    try {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) { /* clipboard blocked — user can still select text manually */ }
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <h2 style={{ fontSize: 30, margin: "0 0 10px", fontWeight: 600, letterSpacing: "-0.02em" }}>Add to the database</h2>
      <p style={{ margin: "0 0 24px", color: "rgba(43,29,20,.7)", fontSize: 15, lineHeight: 1.6 }}>
        Just sipped and enjoyed a coffee you can't find here? Contribute to the PCNWiki database using the forms below based on the information you have handy. Once they land in the queue, they'll be vetted and fact-checked weekly before being added — for the good of the community.
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        {options.map(opt => {
          const Icon = opt.icon;
          const isOpen = open === opt.key;
          return (
            <div key={opt.key} className="card" style={{ overflow: "hidden" }}>
              <button
                onClick={() => setOpen(isOpen ? null : opt.key)}
                aria-expanded={isOpen}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 13, padding: "16px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 10, background: isOpen ? PINK : "rgba(232,90,140,.1)", color: isOpen ? "#fff" : PINK, flexShrink: 0, transition: "background .15s, color .15s" }}>
                  <Icon size={18} />
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontSize: 17, fontWeight: 600, color: ROAST, letterSpacing: "-0.01em" }}>{opt.label}</span>
                  <span style={{ fontSize: 13, color: "rgba(43,29,20,.55)" }}>{opt.blurb}</span>
                </span>
                <Plus size={18} style={{ color: "rgba(43,29,20,.4)", flexShrink: 0, transform: isOpen ? "rotate(45deg)" : "none", transition: "transform .18s" }} />
              </button>

              {isOpen && (
                <ContributeForm
                  fields={opt.fields}
                  submitLabel={opt.label}
                  note={opt.note}
                  onSubmit={(vals) => { addToQueue(opt.key, vals); setOpen(null); }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── QUEUE ── publicly visible list of pending submissions */}
      <div style={{ marginTop: 40 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
          <h3 style={{ fontSize: 22, margin: 0, fontWeight: 600, letterSpacing: "-0.01em" }}>
            Queue {queue.length > 0 && <span style={{ color: PINK }}>({queue.length})</span>}
          </h3>
          {queue.length > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={copyAll} style={{ display: "flex", gap: 6, alignItems: "center", background: ROAST, color: "#fff", border: "none", padding: "7px 13px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {copied ? "Copied ✓" : "Copy queue"}
              </button>
            </div>
          )}
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "rgba(43,29,20,.55)", lineHeight: 1.55 }}>
          Pending submissions awaiting review. Copy the list and send it to Claude to look up, fact-check and add.
        </p>

        {queue.length === 0 ? (
          <div className="card" style={{ padding: "22px 18px", textAlign: "center", color: "rgba(43,29,20,.45)", fontSize: 14 }}>
            Nothing in the queue yet. Submitted coffees will appear here.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {queue.map(e => {
              const opt = optByKey[e.type];
              const parts = opt.fields.map(f => e.vals[f.name]).filter(Boolean);
              return (
                <div key={e.id} className="card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: PINK, background: "rgba(232,90,140,.1)", padding: "3px 8px", borderRadius: 6, flexShrink: 0 }}>
                    {e.type}
                  </span>
                  <span className="mono" style={{ flex: 1, fontSize: 13, color: "rgba(43,29,20,.85)" }}>
                    {parts.join("  ·  ") || "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {queue.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(43,29,20,.08)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="password"
              value={clearPw}
              onChange={ev => { setClearPw(ev.target.value); setClearErr(false); }}
              placeholder="Password to clear queue"
              style={{ padding: "7px 11px", borderRadius: 8, border: `1px solid ${clearErr ? PINK : "rgba(43,29,20,.15)"}`, fontSize: 13, background: "#fff", width: 200, boxSizing: "border-box" }}
            />
            <button
              onClick={clearQueue}
              style={{ background: "none", color: "rgba(43,29,20,.55)", border: "1px solid rgba(43,29,20,.15)", padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Clear queue
            </button>
            {clearErr && <span style={{ fontSize: 12, color: PINK }}>Incorrect password.</span>}
          </div>
        )}
      </div>

      {/* ── INACCURACY REPORTS ── reviewer-only list, password-gated clear */}
      <ReportReview />
    </div>
  );
}

function ReportReview() {
  const [reports, setReports] = useState([]);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const CLEAR_PASSWORD = "nx2rkaro";

  // load reports + refresh whenever a new one is filed elsewhere on the page
  useEffect(() => {
    const load = () => {
      if (REPORTS_API) {
        fetch(REPORTS_API + "/reports")
          .then(r => r.json())
          .then(d => { if (Array.isArray(d.reports)) setReports(d.reports); })
          .catch(() => {});
      } else {
        setReports(loadReportsLocal());
      }
    };
    load();
    const onFiled = () => load();
    window.addEventListener("pcn-report-filed", onFiled);
    return () => window.removeEventListener("pcn-report-filed", onFiled);
  }, []);

  const clear = () => {
    if (pw !== CLEAR_PASSWORD) { setErr(true); return; }
    setReports([]);
    setPw("");
    setErr(false);
    if (REPORTS_API) {
      fetch(REPORTS_API + "/reports/clear", { method: "POST" }).catch(() => {});
    } else {
      try { window.localStorage.removeItem(REPORTS_KEY); } catch (e) { /* ignore */ }
    }
  };

  return (
    <div style={{ marginTop: 40 }}>
      <div style={{ marginBottom: 4 }}>
        <h3 style={{ fontSize: 22, margin: 0, fontWeight: 600, letterSpacing: "-0.01em" }}>
          Reported inaccuracies {reports.length > 0 && <span style={{ color: PINK }}>({reports.length})</span>}
        </h3>
        <p style={{ margin: "4px 0 14px", fontSize: 13, color: "rgba(43,29,20,.55)" }}>
          Entries readers have flagged for review. Look each one up, fix the data, then clear the list.
        </p>
      </div>

      {reports.length === 0 ? (
        <p style={{ fontSize: 14, color: "rgba(43,29,20,.5)" }}>No reports yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {reports.map(r => (
            <div key={r.id} className="card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: PINK, background: "rgba(232,90,140,.1)", padding: "3px 8px", borderRadius: 6, flexShrink: 0 }}>
                {r.kind}
              </span>
              <span style={{ flex: 1, fontSize: 14, color: ROAST }}>{r.name}</span>
              <span className="mono" style={{ fontSize: 11, color: "rgba(43,29,20,.4)", flexShrink: 0 }}>{r.refId} · {r.date}</span>
            </div>
          ))}
        </div>
      )}

      {reports.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(43,29,20,.08)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="password"
            value={pw}
            onChange={ev => { setPw(ev.target.value); setErr(false); }}
            placeholder="Password to clear reports"
            style={{ padding: "7px 11px", borderRadius: 8, border: `1px solid ${err ? PINK : "rgba(43,29,20,.15)"}`, fontSize: 13, background: "#fff", width: 210, boxSizing: "border-box" }}
          />
          <button
            onClick={clear}
            style={{ background: "none", color: "rgba(43,29,20,.55)", border: "1px solid rgba(43,29,20,.15)", padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Clear reports
          </button>
          {err && <span style={{ fontSize: 12, color: PINK }}>Incorrect password.</span>}
        </div>
      )}
    </div>
  );
}

function ContributeForm({ fields, submitLabel, note, onSubmit }) {
  const [vals, setVals] = useState({});
  const [error, setError] = useState(false);
  const inputStyle = { width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid rgba(43,29,20,.15)", fontSize: 14, marginTop: 5, background: "#fff", boxSizing: "border-box" };
  const set = (n, v) => { setVals(s => ({ ...s, [n]: v })); setError(false); };
  const allFilled = fields.every(f => (vals[f.name] || "").trim());
  const handleSubmit = () => {
    if (!allFilled) { setError(true); return; }
    onSubmit(vals);
  };

  return (
    <div style={{ padding: "4px 18px 20px", borderTop: "1px solid rgba(43,29,20,.08)", display: "grid", gap: 14 }}>
      {note && (
        <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.55, color: "rgba(43,29,20,.6)" }}>{note}</p>
      )}
      {fields.map(f => {
        const missing = error && !(vals[f.name] || "").trim();
        return (
          <div key={f.name}>
            <Label>{f.label}</Label>
            <input
              value={vals[f.name] || ""}
              onChange={e => set(f.name, e.target.value)}
              placeholder={f.placeholder}
              style={{ ...inputStyle, border: `1px solid ${missing ? PINK : "rgba(43,29,20,.15)"}` }}
            />
          </div>
        );
      })}
      {error && (
        <p style={{ margin: 0, fontSize: 13, color: PINK, fontWeight: 600 }}>Please fill out the form completely before adding to the queue.</p>
      )}
      <button
        onClick={handleSubmit}
        style={{ background: ROAST, color: "#fff", border: "none", padding: "11px", borderRadius: 9, fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 2 }}
      >
        Add to queue
      </button>
    </div>
  );
}
