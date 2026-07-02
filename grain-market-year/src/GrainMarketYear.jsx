import React, { useState, useMemo } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceArea,
} from "recharts";

// ---- Marketing year runs Sep 1 -> Aug 31 (US corn/soybeans) ----
const MONTHS = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];

// Fraction of the new crop that physically arrives each month (harvest window)
const HARVEST_INJECTION = [0.08, 0.50, 0.38, 0.04, 0, 0, 0, 0, 0, 0, 0, 0];

// Spoilage accelerates in warm months, crawls in winter
const SEASONAL_DECAY = [1.0, 0.8, 0.6, 0.5, 0.45, 0.5, 0.7, 0.9, 1.1, 1.4, 1.6, 1.6];

// Monthly sell-down "shape" per marketing strategy (relative weights)
const SALES_SHAPE = {
  harvest: [0.5, 1.9, 2.3, 1.6, 1.1, 0.8, 0.65, 0.55, 0.45, 0.35, 0.3, 0.25],
  even:    [0.75, 0.9, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.9, 0.85, 0.75],
  hold:    [0.35, 0.55, 0.65, 0.7, 0.8, 0.95, 1.35, 1.55, 1.6, 1.35, 1.05, 0.8],
};

const CARRY_IN = 12;        // old-crop bushels still in bins on Sep 1
const CARRY_IN_QUALITY = 77; // ...and it's the most-aged grain of the year
const FRESH_QUALITY = 99;
const COMMERCIAL_CAP = 20;  // steadier elevator/pipeline buffer
const USE_SHARE = 0.9;      // ~90% of supply moves out over the year

function buildData({ harvestMult, strategy, storage }) {
  const newCrop = 100 * harvestMult;
  const supply = CARRY_IN + newCrop;
  const decayBase = storage === "well" ? 1.2 : 3.0;

  // normalize the chosen sell-down shape to ~90% of total supply
  const weights = SALES_SHAPE[strategy];
  const wSum = weights.reduce((a, b) => a + b, 0);
  const sales = weights.map((w) => (w / wSum) * supply * USE_SHARE);

  let vol = CARRY_IN;
  let q = CARRY_IN_QUALITY;
  const rows = [];

  for (let m = 0; m < 12; m++) {
    const fresh = HARVEST_INJECTION[m] * newCrop;

    // 1. the pile ages over the month
    q = Math.max(0, q - decayBase * SEASONAL_DECAY[m]);

    // 2. fresh, high-quality grain blends in at harvest
    if (fresh > 0 && vol + fresh > 0) {
      q = (vol * q + fresh * FRESH_QUALITY) / (vol + fresh);
    }
    vol += fresh;

    // 3. grain sold / used (representative blend leaves, avg quality unchanged)
    vol = Math.max(0, vol - sales[m]);

    const commercial = Math.min(vol, COMMERCIAL_CAP);
    const onFarm = Math.max(0, vol - commercial);

    rows.push({
      month: MONTHS[m],
      onFarm: Math.round(onFarm * 10) / 10,
      commercial: Math.round(commercial * 10) / 10,
      total: Math.round(vol * 10) / 10,
      quality: vol > 0.5 ? Math.round(q * 10) / 10 : null,
    });
  }
  return rows;
}

const PALETTE = {
  paper: "#F4EEE0",
  ink: "#2A2317",
  inkSoft: "#6B6048",
  onFarm: "#C8881F",
  commercial: "#E6CD94",
  quality: "#2F5E34",
  grid: "#DCD2BC",
  harvestBand: "#C8881F",
};

const FONT_DISPLAY = 'Georgia, "Times New Roman", serif';
const FONT_BODY = 'ui-sans-serif, system-ui, -apple-system, sans-serif';

function Segmented({ label, value, options, onChange }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
        color: PALETTE.inkSoft, marginBottom: 6, fontFamily: FONT_BODY }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button key={opt.value} onClick={() => onChange(opt.value)}
              style={{
                fontFamily: FONT_BODY, fontSize: 13, padding: "7px 13px",
                borderRadius: 999, cursor: "pointer",
                border: `1px solid ${active ? PALETTE.ink : PALETTE.grid}`,
                background: active ? PALETTE.ink : "transparent",
                color: active ? PALETTE.paper : PALETTE.inkSoft,
                transition: "all .15s ease",
              }}>
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const total = payload.find((p) => p.dataKey === "onFarm")
    ? (payload.find((p) => p.dataKey === "onFarm")?.payload.total) : null;
  const q = payload.find((p) => p.dataKey === "onFarm")?.payload.quality;
  return (
    <div style={{ background: PALETTE.ink, color: PALETTE.paper, padding: "10px 13px",
      borderRadius: 8, fontFamily: FONT_BODY, fontSize: 12.5, lineHeight: 1.6 }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, marginBottom: 4 }}>{label}</div>
      <div>In storage: <b>{total ?? "—"}</b> units</div>
      <div style={{ color: PALETTE.commercial }}>On-farm bins: {payload.find(p=>p.dataKey==="onFarm")?.value}</div>
      <div style={{ color: "#bfae84" }}>Commercial: {payload.find(p=>p.dataKey==="commercial")?.value}</div>
      <div style={{ color: "#9fd0a4", marginTop: 2 }}>Quality index: <b>{q ?? "—"}</b>/100</div>
    </div>
  );
}

export default function GrainMarketYear() {
  const [harvestMult, setHarvestMult] = useState(1.0);
  const [strategy, setStrategy] = useState("even");
  const [storage, setStorage] = useState("well");

  const data = useMemo(
    () => buildData({ harvestMult, strategy, storage }),
    [harvestMult, strategy, storage]
  );

  const endQuality = [...data].reverse().find((d) => d.quality != null)?.quality;

  return (
    <div style={{ background: PALETTE.paper, color: PALETTE.ink, minHeight: "100%",
      padding: "28px 22px 36px", fontFamily: FONT_BODY }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>

        <div style={{ fontSize: 11.5, letterSpacing: "0.16em", textTransform: "uppercase",
          color: PALETTE.onFarm, fontWeight: 600 }}>Marketing year · Sep → Aug</div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 30, lineHeight: 1.15,
          margin: "6px 0 8px", fontWeight: 700 }}>
          The grain in the bins, over a year
        </h1>
        <p style={{ color: PALETTE.inkSoft, fontSize: 14.5, lineHeight: 1.6, maxWidth: 620, margin: 0 }}>
          Two things move against each other. Volume sawtooths — a thin pre-harvest carry-in,
          a flood at harvest, then a steady drawdown as it sells. Meanwhile the <i>quality</i> of
          whatever's still sitting in the bins erodes the whole time, fastest in summer heat.
        </p>

        {/* Controls */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: "0 28px", margin: "22px 0 8px" }}>
          <Segmented label="Harvest size" value={harvestMult} onChange={setHarvestMult}
            options={[{label:"Short crop",value:0.7},{label:"Average",value:1.0},{label:"Big crop",value:1.3}]} />
          <Segmented label="Farmer marketing" value={strategy} onChange={setStrategy}
            options={[{label:"Sell at harvest",value:"harvest"},{label:"Spread evenly",value:"even"},{label:"Hold for carry",value:"hold"}]} />
          <Segmented label="Storage condition" value={storage} onChange={setStorage}
            options={[{label:"Well-managed bin",value:"well"},{label:"Poor / wet",value:"poor"}]} />
        </div>

        {/* Chart */}
        <div style={{ background: "#FBF7EC", border: `1px solid ${PALETTE.grid}`,
          borderRadius: 14, padding: "18px 10px 8px", marginTop: 8 }}>
          <ResponsiveContainer width="100%" height={380}>
            <ComposedChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="onFarmFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PALETTE.onFarm} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={PALETTE.onFarm} stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={PALETTE.grid} strokeDasharray="2 4" vertical={false} />
              <ReferenceArea x1="Oct" x2="Nov" yAxisId="left" fill={PALETTE.harvestBand}
                fillOpacity={0.07} label={{ value: "HARVEST", position: "insideTop",
                fontSize: 10, fill: PALETTE.onFarm, letterSpacing: 1 }} />
              <XAxis dataKey="month" tick={{ fill: PALETTE.inkSoft, fontSize: 12 }}
                axisLine={{ stroke: PALETTE.grid }} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fill: PALETTE.inkSoft, fontSize: 11 }}
                axisLine={false} tickLine={false}
                label={{ value: "Bushels in storage (illustrative)", angle: -90,
                  position: "insideLeft", fill: PALETTE.inkSoft, fontSize: 11, dy: 70 }} />
              <YAxis yAxisId="right" orientation="right" domain={[60, 100]}
                tick={{ fill: PALETTE.quality, fontSize: 11 }} axisLine={false} tickLine={false}
                label={{ value: "Quality index", angle: 90, position: "insideRight",
                  fill: PALETTE.quality, fontSize: 11, dy: -34 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12.5, paddingTop: 6 }} />
              <Area yAxisId="left" dataKey="commercial" stackId="1" name="Commercial / pipeline"
                stroke={PALETTE.commercial} fill={PALETTE.commercial} fillOpacity={0.85} />
              <Area yAxisId="left" dataKey="onFarm" stackId="1" name="On-farm bins"
                stroke={PALETTE.onFarm} fill="url(#onFarmFill)" />
              <Line yAxisId="right" dataKey="quality" name="Quality of stored grain"
                stroke={PALETTE.quality} strokeWidth={2.5} dot={{ r: 3, fill: PALETTE.quality }}
                connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Read-out */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          gap: 14, marginTop: 18 }}>
          {[
            ["The harvest wall", "Almost the entire crop lands in 8–10 weeks. On-farm bins (amber) absorb the spike — that's the whole reason farmers build storage instead of dumping at the elevator."],
            ["The slow bleed", "From December on it's a drawdown. Strategy reshapes it: sell-at-harvest empties the bins by spring; hold-for-carry keeps grain on hand to capture the futures carry."],
            [`Quality lands at ~${endQuality ?? "—"}/100 by August`, "The grain still around right before next harvest is both the scarcest AND the most degraded — old crop that's been aging through the summer. Poor storage drops that line fast."],
          ].map(([h, b]) => (
            <div key={h} style={{ borderTop: `2px solid ${PALETTE.onFarm}`, paddingTop: 10 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15.5, fontWeight: 700, marginBottom: 5 }}>{h}</div>
              <div style={{ fontSize: 13, lineHeight: 1.55, color: PALETTE.inkSoft }}>{b}</div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 11.5, color: PALETTE.inkSoft, marginTop: 22, lineHeight: 1.5,
          borderTop: `1px solid ${PALETTE.grid}`, paddingTop: 12 }}>
          Illustrative model, not USDA data — the curve <i>shapes</i> are real (harvest timing, seasonal
          drawdown, heat-driven spoilage) but the magnitudes are stylized. Quality here is a single blended
          index; in practice you'd track test weight, moisture, damage, and mycotoxin risk separately.
          For real numbers: USDA Grain Stocks (reported Dec 1 / Mar 1 / Jun 1 / Sep 1) is the closest public mirror of this picture.
        </p>
      </div>
    </div>
  );
}
