import React, { useState, useMemo } from "react";
import { Search, Coffee, MapPin, Beaker, Star, Plus, X, Filter, Leaf, BookOpen, NotebookPen } from "lucide-react";
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
const TASTING_NOTES = data.tastingNotes;
const LOTS = data.lots;
const SEED_TASTINGS = data.seedTastings;

// ── derived tag sets ────────────────────────────────────────────────────────────
const ALL_TAGS = [...new Set(Object.values(TASTING_NOTES).flat())].sort();
const USED_TAGS = [...new Set(VARIETIES.flatMap(v => v.refNotes))].sort();

const PINK = "#E85A8C";
const BEAN = "#3A5A40";
const ROAST = "#2B1D14";

export default function CoffeeKB() {
  const [view, setView] = useState("varieties"); // varieties | lots | log
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState([]);
  const [showAllTags, setShowAllTags] = useState(false);
  const [selectedVariety, setSelectedVariety] = useState(null);
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [farmCountry, setFarmCountry] = useState("All");
  const [tastings, setTastings] = useState(SEED_TASTINGS);
  const [showAdd, setShowAdd] = useState(false);

  const regionById = useMemo(() => Object.fromEntries(REGIONS.map(r => [r.id, r])), []);
  const varietyById = useMemo(() => Object.fromEntries(VARIETIES.map(v => [v.id, v])), []);
  const farmById = useMemo(() => Object.fromEntries(FARMS.map(p => [p.id, p])), []);
  const processById = useMemo(() => Object.fromEntries(PROCESSES.map(p => [p.id, p])), []);
  const lotById = useMemo(() => Object.fromEntries(LOTS.map(l => [l.id, l])), []);

  const toggleTag = (t) =>
    setActiveTags(a => a.includes(t) ? a.filter(x => x !== t) : [...a, t]);

  const filteredVarieties = useMemo(() => {
    const q = query.toLowerCase();
    return VARIETIES.filter(v => {
      const matchQ = !q || [v.name, v.group, v.note, v.origin, v.species, v.parents]
        .some(f => (f || "").toLowerCase().includes(q)) || v.refNotes.some(t => t.toLowerCase().includes(q));
      const matchTags = activeTags.length === 0 || activeTags.every(t => v.refNotes.includes(t));
      return matchQ && matchTags;
    });
  }, [query, activeTags]);

  const filteredLots = useMemo(() => {
    const q = query.toLowerCase();
    return LOTS.filter(l => {
      const v = varietyById[l.varietyId], p = farmById[l.producerId];
      const pr = processById[l.processId], reg = p && regionById[p.regionId];
      const matchQ = !q || [l.name, String(l.year), v && v.name, p && p.name, p && p.people,
        pr && pr.name, reg && reg.region, reg && reg.country]
        .some(f => (f || "").toLowerCase().includes(q));
      const matchTags = activeTags.length === 0 || activeTags.every(t => v.refNotes.includes(t));
      return matchQ && matchTags;
    });
  }, [query, activeTags, varietyById, farmById, processById, regionById]);

  const filteredFarms = useMemo(() => {
    const q = query.toLowerCase();
    return FARMS.filter(f => {
      const reg = regionById[f.regionId];
      const byCountry = farmCountry === "All" || (reg && reg.country === farmCountry);
      const grownVarieties = (f.varietyIds || []).map(id => varietyById[id] && varietyById[id].name).filter(Boolean);
      const matchQ = !q || [f.name, f.people, f.note, f.altitude, reg && reg.region, reg && reg.country]
        .some(field => (field || "").toLowerCase().includes(q)) || grownVarieties.some(n => n.toLowerCase().includes(q));
      return byCountry && matchQ;
    });
  }, [query, farmCountry, regionById, varietyById]);

  return (
    <div style={{ minHeight: "100vh", background: "#F7F4EF", color: ROAST, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .serif { font-family: 'Newsreader', serif; }
        .display { font-family: 'Instrument Serif', serif; font-weight: 400; }
        .chip { cursor:pointer; border:1px solid rgba(43,29,20,.18); background:transparent; padding:4px 10px; border-radius:999px; font-size:12px; transition:all .15s; }
        .chip:hover { border-color:${PINK}; }
        .chip.on { background:${PINK}; color:#fff; border-color:${PINK}; }
        .navbtn { cursor:pointer; background:none; border:none; padding:8px 4px; font-size:14px; font-weight:600; color:rgba(43,29,20,.45); border-bottom:2px solid transparent; display:flex; gap:6px; align-items:center; }
        .navbtn.on { color:${ROAST}; border-bottom-color:${PINK}; }
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
          <nav style={{ display: "flex", gap: 22 }}>
            <button className={`navbtn ${view === "varieties" ? "on" : ""}`} onClick={() => setView("varieties")}><Leaf size={15} />Varieties</button>
            <button className={`navbtn ${view === "farms" ? "on" : ""}`} onClick={() => setView("farms")}><MapPin size={15} />Farms</button>
            <button className={`navbtn ${view === "lots" ? "on" : ""}`} onClick={() => setView("lots")}><Coffee size={15} />Lots</button>
            <button className={`navbtn ${view === "log" ? "on" : ""}`} onClick={() => setView("log")}><NotebookPen size={15} />My Log</button>
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
            {(view === "varieties" || view === "lots") && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(43,29,20,.5)", fontWeight: 600 }}><Filter size={13} /> Tasting notes</span>
                {(showAllTags ? ALL_TAGS : USED_TAGS).map(t => (
                  <button key={t} className={`chip ${activeTags.includes(t) ? "on" : ""}`} onClick={() => toggleTag(t)}>{t}</button>
                ))}
                <button className="chip" onClick={() => setShowAllTags(s => !s)} style={{ color: BEAN, fontWeight: 600 }}>
                  {showAllTags ? "fewer −" : `all ${ALL_TAGS.length} +`}
                </button>
                {activeTags.length > 0 && (
                  <button className="chip" onClick={() => setActiveTags([])} style={{ color: PINK, fontWeight: 600 }}>clear ×</button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── VARIETIES ── */}
        {view === "varieties" && (
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
                  {v.refNotes.slice(0, 4).map(t => (
                    <span key={t} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(232,90,140,.1)", color: PINK }}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
            {filteredVarieties.length === 0 && <EmptyState msg="No varieties match those filters. Try clearing a tasting note." />}
          </div>
        )}

        {/* ── LOTS ── */}
        {view === "lots" && (
          <div style={{ display: "grid", gap: 12 }}>
            {filteredLots.map(l => {
              const v = varietyById[l.varietyId], p = farmById[l.producerId], pr = processById[l.processId], reg = p && regionById[p.regionId];
              return (
                <div key={l.id} className="card" style={{ padding: 18, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div className="mono" style={{ fontSize: 10, color: PINK, letterSpacing: 1 }}>{l.id.toUpperCase()} · {l.year}</div>
                    <h3 className="serif" style={{ fontSize: 19, margin: "3px 0 8px", fontWeight: 600 }}>{l.name}</h3>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: "rgba(43,29,20,.7)" }}>
                      <span style={{ display: "flex", gap: 5, alignItems: "center" }}><Leaf size={13} color={BEAN} />{v.name}</span>
                      <span style={{ display: "flex", gap: 5, alignItems: "center" }}><MapPin size={13} color={BEAN} />{p ? p.name : "—"}{reg ? `, ${reg.region}` : ""}</span>
                      <span style={{ display: "flex", gap: 5, alignItems: "center" }}><Beaker size={13} color={BEAN} />{pr.name}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredLots.length === 0 && <EmptyState msg="No lots match. Lots link a producer, a variety and a process — add one from your log." />}
          </div>
        )}

        {/* ── FARMS ── */}
        {view === "farms" && (() => {
          const countries = ["All", ...[...new Set(FARMS.map(f => regionById[f.regionId]?.country).filter(Boolean))].sort()];
          const farms = filteredFarms;
          return (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(43,29,20,.5)", fontWeight: 600 }}><Filter size={13} /> Country</span>
                {countries.map(c => (
                  <button key={c} className={`chip ${farmCountry === c ? "on" : ""}`} onClick={() => setFarmCountry(c)}>{c}</button>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
                {farms.map(f => {
                  const reg = regionById[f.regionId];
                  return (
                    <div key={f.id} className="card" style={{ padding: 18, cursor: "pointer" }} onClick={() => setSelectedFarm(f)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <h3 style={{ fontSize: 19, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>{f.name}</h3>
                        {f.flagship && <span className="mono" style={{ fontSize: 9, padding: "3px 7px", borderRadius: 6, background: "rgba(232,90,140,.12)", color: PINK, whiteSpace: "nowrap" }}>FLAGSHIP</span>}
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
              {farms.length === 0 && <EmptyState msg="No farms match. Try a different search term or country." />}
            </div>
          );
        })()}

        {/* ── MY LOG ── */}
        {view === "log" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 className="serif" style={{ fontSize: 24, margin: 0 }}>Tasting log</h2>
              <button onClick={() => setShowAdd(true)} style={{ display: "flex", gap: 6, alignItems: "center", background: ROAST, color: "#fff", border: "none", padding: "9px 16px", borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                <Plus size={16} /> Log a tasting
              </button>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {tastings.map(t => {
                const lot = lotById[t.lotId];
                const v = lot ? varietyById[lot.varietyId] : null;
                return (
                  <div key={t.id} className="card" style={{ padding: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div>
                        <h3 className="serif" style={{ fontSize: 18, margin: 0, fontWeight: 600 }}>{lot ? lot.name : "Unknown lot"}</h3>
                        <div className="mono" style={{ fontSize: 11, color: "rgba(43,29,20,.5)", marginTop: 3 }}>
                          {t.roaster} · {t.date} {t.isPublic ? "· PUBLIC" : "· private"}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(232,90,140,.1)", color: PINK, padding: "5px 10px", borderRadius: 8, fontWeight: 700 }}>
                        <Star size={14} fill={PINK} /> {t.score}
                      </div>
                    </div>
                    <p style={{ fontSize: 14, lineHeight: 1.55, color: "rgba(43,29,20,.8)", margin: "10px 0" }}>{t.notes}</p>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {t.tags.map(tag => (
                        <span key={tag} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(58,90,64,.1)", color: BEAN }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
            <Label>Reference tasting notes</Label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {selectedVariety.refNotes.map(t => (
                <span key={t} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 999, background: "rgba(232,90,140,.1)", color: PINK }}>{t}</span>
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
          </div>
        </Drawer>
      )}

      {/* farm detail drawer */}
      {selectedFarm && (() => {
        const reg = regionById[selectedFarm.regionId];
        return (
          <Drawer onClose={() => setSelectedFarm(null)}>
            <span className="mono" style={{ fontSize: 11, color: PINK, letterSpacing: 1 }}>{reg ? reg.country.toUpperCase() : "FARM"}{selectedFarm.flagship ? " · FLAGSHIP" : ""}</span>
            <h2 style={{ fontSize: 30, fontWeight: 600, margin: "6px 0 0", letterSpacing: "-0.02em" }}>{selectedFarm.name}</h2>
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
          </Drawer>
        );
      })()}

      {/* add tasting modal */}
      {showAdd && (
        <AddTasting
          onClose={() => setShowAdd(false)}
          lots={LOTS}
          lotById={lotById}
          onSave={(rec) => { setTastings(t => [{ ...rec, id: "t" + (t.length + 1) }, ...t]); setShowAdd(false); }}
        />
      )}
    </div>
  );
}

function Label({ children }) {
  return <span className="mono" style={{ fontSize: 10, letterSpacing: 1.5, color: "rgba(43,29,20,.45)", textTransform: "uppercase", fontWeight: 700 }}>{children}</span>;
}

function CardFact({ label, value, accent }) {
  return (
    <>
      <span className="mono" style={{ fontSize: 10, letterSpacing: 1, color: "rgba(43,29,20,.4)", textTransform: "uppercase", fontWeight: 700, paddingTop: 2 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: accent ? PINK : "rgba(43,29,20,.85)" }}>{value}</span>
    </>
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

function EmptyState({ msg }) {
  return (
    <div style={{ gridColumn: "1/-1", padding: "48px 24px", textAlign: "center", color: "rgba(43,29,20,.5)", border: "1px dashed rgba(43,29,20,.2)", borderRadius: 14 }}>
      <BookOpen size={28} style={{ opacity: .4 }} />
      <p style={{ marginTop: 10, fontSize: 14 }}>{msg}</p>
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

function AddTasting({ onClose, lots, lotById, onSave }) {
  const [lotId, setLotId] = useState(lots[0]?.id || "");
  const [roaster, setRoaster] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [score, setScore] = useState(88);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState([]);
  const [isPublic, setIsPublic] = useState(false);

  const toggle = (t) => setTags(a => a.includes(t) ? a.filter(x => x !== t) : [...a, t]);
  const inputStyle = { width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid rgba(43,29,20,.15)", fontSize: 14, marginTop: 5, background: "#fff" };

  return (
    <Drawer onClose={onClose}>
      <h2 className="display" style={{ fontSize: 34, margin: "0 0 18px" }}>Log a tasting</h2>
      <div style={{ display: "grid", gap: 14 }}>
        <div><Label>Lot</Label>
          <select value={lotId} onChange={e => setLotId(e.target.value)} style={inputStyle}>
            {lots.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div><Label>Roaster</Label>
          <input value={roaster} onChange={e => setRoaster(e.target.value)} placeholder="Who roasted it?" style={inputStyle} />
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}><Label>Date</Label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ width: 100 }}><Label>Score</Label>
            <input type="number" min={0} max={100} step={0.25} value={score} onChange={e => setScore(parseFloat(e.target.value))} style={inputStyle} />
          </div>
        </div>
        <div><Label>Notes</Label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Aroma, acidity, body, finish…" style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div><Label>Tasting notes</Label>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
            {ALL_TAGS.map(t => (
              <button key={t} className={`chip ${tags.includes(t) ? "on" : ""}`} onClick={() => toggle(t)}>{t}</button>
            ))}
          </div>
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
          Share to community view
        </label>
        <button
          onClick={() => onSave({ lotId, roaster: roaster || "—", date, score, notes: notes || "—", tags, isPublic })}
          style={{ background: ROAST, color: "#fff", border: "none", padding: "11px", borderRadius: 9, fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 4 }}
        >
          Save tasting
        </button>
      </div>
    </Drawer>
  );
}
