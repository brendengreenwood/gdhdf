import React, { useState, useMemo, useRef } from "react";
import * as d3 from "d3";

const VB = { w: 1000, h: 640 };
const M = 56, N = 36;
const SX = VB.w / M, SY = VB.h / N;
const COMP_FREIGHT = 0.0006; // fixed for the fake competitor backdrop

const YOU = { x: 440, y: 330 };
const COMPS = [
  { x: 120, y: 110, bid: 0.16, name: "Rival A", color: "#6E77BE" },
  { x: 880, y: 165, bid: 0.12, name: "Rival B", color: "#BE6E8E" },
  { x: 790, y: 545, bid: 0.20, name: "Rival C", color: "#5FA6A0" },
  { x: 175, y: 560, bid: 0.10, name: "Rival D", color: "#B79A55" },
];

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
function pip(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const cellOf = (x, y) => Math.min(N - 1, Math.max(0, Math.floor(y / SY))) * M + Math.min(M - 1, Math.max(0, Math.floor(x / SX)));

const C = {
  paper: "#F4EEE0", panel: "#FBF7EC", ink: "#2A2317", inkSoft: "#6B6048", grid: "#DCD2BC",
  land: "#E9E2D1", you: "#C8881F", gain: "#2F8C57", reach: "#1f7a4d", loss: "#B5402F",
};
const FD = 'Georgia, "Times New Roman", serif';
const FB = 'ui-sans-serif, system-ui, -apple-system, sans-serif';
const cents = (v) => `${Math.round(v * 100)}¢`;

function contourPath(mp) {
  if (!mp) return "";
  let d = "";
  for (const poly of mp.coordinates)
    for (const ring of poly) { ring.forEach((pt, i) => { d += (i ? "L" : "M") + (pt[0] * SX).toFixed(1) + "," + (pt[1] * SY).toFixed(1); }); d += "Z"; }
  return d;
}

export default function PushZonesMaxBid() {
  const [maxBidC, setMaxBidC] = useState(18);
  const [freightUI, setFreightUI] = useState(38);
  const [polys, setPolys] = useState([]);
  const [mode, setMode] = useState(false);
  const [draft, setDraft] = useState(null);
  const svgRef = useRef(null);
  const maxBid = maxBidC / 100;
  const freight = freightUI * 0.000016;

  const world = useMemo(() => {
    const distYou = new Float64Array(M * N), compBest = new Float64Array(M * N), compWin = new Int8Array(M * N);
    for (let j = 0; j < N; j++)
      for (let i = 0; i < M; i++) {
        const px = (i + 0.5) * SX, py = (j + 0.5) * SY, c = j * M + i;
        distYou[c] = dist(px, py, YOU.x, YOU.y);
        let best = -Infinity, who = 0;
        COMPS.forEach((cp, k) => { const v = cp.bid - COMP_FREIGHT * dist(px, py, cp.x, cp.y); if (v > best) { best = v; who = k; } });
        compBest[c] = best; compWin[c] = who;
      }
    let a = 9; const rng = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const producers = [];
    for (let p = 0; p < 70; p++) {
      const x = 50 + rng() * 900, y = 40 + rng() * 560, bu = Math.round(20 + rng() * 200), c = cellOf(x, y);
      producers.push({ id: p, x, y, bu, cell: c, distYou: distYou[c], compBest: compBest[c] });
    }
    const gen = d3.contours().size([M, N]);
    const compContours = COMPS.map((_, k) => { const f = new Uint8Array(M * N); for (let c = 0; c < M * N; c++) f[c] = compWin[c] === k ? 1 : 0; return gen.contour(f, 0.5); });
    return { distYou, compBest, compWin, producers, compContours };
  }, []);

  // your organic territory at current max bid + freight
  const youField = useMemo(() => { const a = new Uint8Array(M * N); for (let c = 0; c < M * N; c++) a[c] = (maxBid - freight * world.distYou[c]) >= world.compBest[c] ? 1 : 0; return a; }, [maxBid, freight, world]);

  // drawn reach + corridor connecting to current territory
  const claimed = useMemo(() => {
    const a = new Uint8Array(M * N);
    if (!polys.length) return a;
    for (const poly of polys) {
      const cells = [];
      for (let j = 0; j < N; j++) for (let i = 0; i < M; i++) { const px = (i + 0.5) * SX, py = (j + 0.5) * SY; if (pip(px, py, poly)) { a[j * M + i] = 1; cells.push([px, py]); } }
      if (!cells.length) continue;
      const cx = cells.reduce((s, c) => s + c[0], 0) / cells.length, cy = cells.reduce((s, c) => s + c[1], 0) / cells.length;
      let B = null;
      for (let j = 0; j < N; j++) for (let i = 0; i < M; i++) { if (!youField[j * M + i]) continue; const bx = (i + 0.5) * SX, by = (j + 0.5) * SY, d = (cx - bx) ** 2 + (cy - by) ** 2; if (!B || d < B.d) B = { d, x: bx, y: by }; }
      if (!B) continue;
      let A = cells[0], bd = Infinity;
      for (const c of cells) { const d = (c[0] - B.x) ** 2 + (c[1] - B.y) ** 2; if (d < bd) { bd = d; A = c; } }
      const steps = Math.max(1, Math.ceil(Math.hypot(A[0] - B.x, A[1] - B.y) / (Math.min(SX, SY) / 2)));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps, px = A[0] + (B.x - A[0]) * t, py = A[1] + (B.y - A[1]) * t, ci = Math.floor(px / SX), cj = Math.floor(py / SY);
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = ci + di, jj = cj + dj; if (ii >= 0 && ii < M && jj >= 0 && jj < N) a[jj * M + ii] = 1; }
      }
    }
    return a;
  }, [polys, youField]);

  const contours = useMemo(() => {
    const merged = new Uint8Array(M * N), reach = new Uint8Array(M * N);
    for (let c = 0; c < M * N; c++) { const r = claimed[c] === 1 && youField[c] === 0; merged[c] = (youField[c] || claimed[c]) ? 1 : 0; reach[c] = r ? 1 : 0; }
    const gen = d3.contours().size([M, N]);
    return { you: gen.contour(youField, 0.5), reach: gen.contour(reach, 0.5) };
  }, [youField, claimed]);

  const econ = useMemo(() => {
    let dBu = 0, dN = 0, binding = 0;
    const contest = COMPS.map((cp) => ({ name: cp.name, color: cp.color, bu: 0, n: 0 }));
    for (const pr of world.producers) {
      if (youField[pr.cell] || !claimed[pr.cell]) continue;
      dBu += pr.bu; dN++;
      const w = world.compWin[pr.cell]; contest[w].bu += pr.bu; contest[w].n++;
      const need = pr.compBest + freight * pr.distYou; // max bid required to win this producer
      if (need > binding) binding = need;
    }
    return { dBu, dN, binding, contest: contest.filter((c) => c.n > 0).sort((a, b) => b.bu - a.bu) };
  }, [youField, claimed, freight, world]);

  const captured = useMemo(() => { let n = 0, bu = 0; for (const pr of world.producers) if (youField[pr.cell]) { n++; bu += pr.bu; } return { n, bu }; }, [youField, world]);

  const toVB = (e) => { const r = svgRef.current.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * VB.w, ((e.clientY - r.top) / r.height) * VB.h]; };
  const down = (e) => { if (!mode) return; e.currentTarget.setPointerCapture(e.pointerId); setDraft([toVB(e)]); };
  const move = (e) => { if (!mode || !draft) return; const p = toVB(e), l = draft[draft.length - 1]; if (Math.hypot(p[0] - l[0], p[1] - l[1]) > 9) setDraft([...draft, p]); };
  const up = () => { if (!mode || !draft) return; if (draft.length >= 3) setPolys([...polys, draft]); setDraft(null); setMode(false); };

  const pStat = (pr) => youField[pr.cell] ? "you" : claimed[pr.cell] ? "reach" : "comp";

  return (
    <div style={{ background: C.paper, color: C.ink, minHeight: "100%", padding: "26px 20px 40px", fontFamily: FB }}>
      <style>{`
        input[type=range].pz{-webkit-appearance:none;height:5px;border-radius:5px;background:${C.grid};outline:none;}
        input[type=range].pz::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:${C.ink};cursor:pointer;}
        input[type=range].pz::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:${C.ink};border:none;cursor:pointer;}
      `}</style>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ fontSize: 11.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.you, fontWeight: 700 }}>Max bid + freight · draw push zones</div>
        <h1 style={{ fontFamily: FD, fontSize: 28, lineHeight: 1.15, margin: "6px 0 8px", fontWeight: 700 }}>Your reach, and what's past it</h1>
        <p style={{ color: C.inkSoft, fontSize: 14, lineHeight: 1.6, maxWidth: 660, margin: 0 }}>
          Your contour is where <b>max bid − cost of delivery</b> beats the rivals (fixed fake data). Bid and freight make it
          breathe. Then draw a <b>push zone</b> past it — it connects back to your zone by a corridor, and tells you whose
          turf it's on and the max bid you'd need to actually take it.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 22, alignItems: "flex-end", margin: "20px 0 12px" }}>
          <div style={{ flex: "1 1 200px", minWidth: 190 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Max bid</span>
              <span style={{ fontFamily: FD, fontWeight: 700 }}>{maxBidC}¢/bu</span>
            </div>
            <input className="pz" type="range" min="0" max="45" step="1" value={maxBidC} onChange={(e) => setMaxBidC(+e.target.value)} style={{ width: "100%" }} />
          </div>
          <div style={{ flex: "1 1 200px", minWidth: 190 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Freight / delivery cost</span>
              <span style={{ fontFamily: FD, fontWeight: 700 }}>{freightUI}</span>
            </div>
            <input className="pz" type="range" min="5" max="100" step="1" value={freightUI} onChange={(e) => setFreightUI(+e.target.value)} style={{ width: "100%" }} />
          </div>
          <button onClick={() => { setMode((v) => !v); setDraft(null); }} style={{ fontFamily: FB, fontSize: 13, fontWeight: 600, padding: "9px 14px", borderRadius: 9, cursor: "pointer", border: `1px solid ${mode ? C.ink : C.grid}`, background: mode ? C.ink : "transparent", color: mode ? C.paper : C.ink }}>{mode ? "Drawing…" : "✏️ Draw reach"}</button>
          <button onClick={() => setPolys([])} disabled={!polys.length} style={{ fontFamily: FB, fontSize: 13, padding: "9px 12px", borderRadius: 9, cursor: polys.length ? "pointer" : "default", border: `1px solid ${C.grid}`, background: "transparent", color: polys.length ? C.inkSoft : C.grid }}>Clear</button>
        </div>

        <div style={{ position: "relative", width: "100%", aspectRatio: "1000 / 640", border: `1px solid ${C.grid}`, borderRadius: 14, overflow: "hidden" }}>
          <svg ref={svgRef} viewBox={`0 0 ${VB.w} ${VB.h}`} preserveAspectRatio="none" width="100%" height="100%" style={{ touchAction: "none", cursor: mode ? "crosshair" : "default" }} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
            <rect x="0" y="0" width={VB.w} height={VB.h} fill={C.land} />
            {world.compContours.map((mp, k) => (<path key={k} d={contourPath(mp)} fillRule="evenodd" fill={COMPS[k].color} fillOpacity="0.12" stroke={COMPS[k].color} strokeWidth="1.5" strokeOpacity="0.5" pointerEvents="none" />))}
            <path d={contourPath(contours.you)} fillRule="evenodd" fill={C.you} fillOpacity="0.26" stroke={C.you} strokeWidth="3" pointerEvents="none" />
            <path d={contourPath(contours.reach)} fillRule="evenodd" fill={C.gain} fillOpacity="0.36" stroke={C.gain} strokeWidth="2" strokeDasharray="6 4" pointerEvents="none" />

            {world.producers.map((pr) => {
              const st = pStat(pr), r = 3 + pr.bu / 42;
              const fill = st === "you" ? C.you : st === "reach" ? C.reach : "transparent";
              const stroke = st === "comp" ? COMPS[world.compWin[pr.cell]].color : "#fff";
              return <circle key={pr.id} cx={pr.x} cy={pr.y} r={r} fill={fill} fillOpacity={st === "comp" ? 0 : 0.93} stroke={stroke} strokeWidth={st === "comp" ? 1.5 : 1} pointerEvents="none" />;
            })}

            {COMPS.map((cp, k) => (<g key={k} pointerEvents="none"><circle cx={cp.x} cy={cp.y} r="7" fill={cp.color} stroke="#fff" strokeWidth="1.5" /><text x={cp.x + 11} y={cp.y + 4} fontSize="11" fontFamily={FB} fill={cp.color} fontWeight="700">{cp.name}</text></g>))}
            <rect x={YOU.x - 9} y={YOU.y - 9} width="18" height="18" fill={C.ink} transform={`rotate(45 ${YOU.x} ${YOU.y})`} pointerEvents="none" />
            <text x={YOU.x + 15} y={YOU.y + 5} fontSize="15" fontFamily={FD} fill={C.ink} fontWeight="700" pointerEvents="none">Your house</text>
            {draft && draft.length > 1 && <polyline points={draft.map((p) => p.join(",")).join(" ")} fill="rgba(47,140,87,0.14)" stroke={C.gain} strokeWidth="2.5" pointerEvents="none" />}
          </svg>
        </div>

        <div style={{ fontSize: 13.5, marginTop: 13 }}>
          <span style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, color: C.you }}>{captured.n}</span><span style={{ color: C.inkSoft }}> producers · </span>
          <span style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, color: C.you }}>{Math.round(captured.bu)}k</span><span style={{ color: C.inkSoft }}> bu in your reach at {maxBidC}¢</span>
        </div>

        <div style={{ background: polys.length ? C.ink : C.panel, color: polys.length ? C.paper : C.ink, borderRadius: 12, padding: "15px 17px", marginTop: 14, border: `1px solid ${polys.length ? C.ink : C.grid}` }}>
          {polys.length ? (
            <>
              <div style={{ fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "#C9BD9B", fontWeight: 700 }}>Your push zone sits past your reach</div>
              <div style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, margin: "3px 0 10px" }}>{econ.dN} producers · {Math.round(econ.dBu)}k bu</div>
              {econ.contest.length ? <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {econ.contest.map((c) => (<div key={c.name} style={{ display: "flex", alignItems: "center", gap: 9 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: c.color, flexShrink: 0 }} /><span style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</span><span style={{ marginLeft: "auto", fontSize: 12.5, color: "#C9BD9B" }}>{c.n} producers · {Math.round(c.bu)}k bu is theirs</span></div>))}
              </div> : <div style={{ fontSize: 13, color: "#C9BD9B" }}>Open ground you already win.</div>}
              <div style={{ height: 1, background: "#4a4031", margin: "12px 0 10px" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 12.5, opacity: 0.85 }}>Max bid needed to take it</span>
                <span style={{ fontFamily: FD, fontWeight: 700, fontSize: 18 }}>{econ.binding > 0 ? `${cents(econ.binding)}/bu` : "already yours"}</span>
              </div>
              <p style={{ fontSize: 11, color: "#C9BD9B", lineHeight: 1.5, marginTop: 9, marginBottom: 0 }}>
                You're posting {maxBidC}¢. To win this ground you'd need to go to {econ.binding > 0 ? cents(econ.binding) : "—"} — {econ.binding > maxBid ? `${Math.round((econ.binding - maxBid) * 100)}¢ over your max.` : "within your max already."} Slide your max bid up and watch the reach get absorbed into your organic contour.
              </p>
            </>
          ) : <p style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.55, margin: 0 }}>Move max bid and freight to breathe your contour, then draw a reach past its edge to model contested ground and the bid it'd take to win it.</p>}
        </div>

        <p style={{ fontSize: 11, color: C.inkSoft, marginTop: 16, lineHeight: 1.5, borderTop: `1px solid ${C.grid}`, paddingTop: 12 }}>
          Your contour = marching-squares iso-line where <code>maxBid − freight·distance</code> beats the fixed rival backdrop. A drawn reach claims its cells plus a corridor back to your zone, then reports whose territory it overlaps and the max bid required. Rivals and producers are fake.
        </p>
      </div>
    </div>
  );
}
