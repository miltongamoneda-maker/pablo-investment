"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import _ from "lodash";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, CartesianGrid, Legend } from "recharts";

const SUPABASE_URL = "https://aksbdksccqlipjpygvvw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrc2Jka3NjY3FsaXBqcHlndnZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNDE3NDAsImV4cCI6MjA5MzkxNzc0MH0.zMQLpefdlvzoxufi30Ppfb7cFDiPc728USGcCvCuwzU";
const hdrs = { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", "Prefer": "return=representation" };

const sb = {
  get: async (t, p = "") => { const r = await fetch(`${SUPABASE_URL}/rest/v1/${t}?${p}`, { headers: hdrs }); return r.json(); },
  post: async (t, d) => { const r = await fetch(`${SUPABASE_URL}/rest/v1/${t}`, { method: "POST", headers: hdrs, body: JSON.stringify(d) }); return r.json(); },
  patch: async (t, m, d) => { const r = await fetch(`${SUPABASE_URL}/rest/v1/${t}?${m}`, { method: "PATCH", headers: hdrs, body: JSON.stringify(d) }); return r.json(); },
  del: async (t, m) => { await fetch(`${SUPABASE_URL}/rest/v1/${t}?${m}`, { method: "DELETE", headers: hdrs }); },
  upsert: async (t, d) => { const r = await fetch(`${SUPABASE_URL}/rest/v1/${t}`, { method: "POST", headers: { ...hdrs, "Prefer": "return=representation,resolution=merge-duplicates" }, body: JSON.stringify(d) }); return r.json(); },
};

async function getQuote(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`;
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  // Try direct first, then proxy
  for (const u of [url, proxyUrl]) {
    try {
      const r = await fetch(u);
      if (!r.ok) continue;
      const txt = await r.text();
      if (!txt.startsWith('{')) continue;
      const d = JSON.parse(txt);
      if (!d.chart?.result?.[0]?.meta) continue;
      const m = d.chart.result[0].meta;
      return { price: m.regularMarketPrice, prevClose: m.chartPreviousClose, currency: m.currency };
    } catch { continue; }
  }
  return null;
}

async function getChartData(ticker, range = "1y") {
  const iv = { "1m": "5m", "5d": "15m", "1mo": "1d", "3mo": "1d", "6mo": "1d", "1y": "1wk", "5y": "1mo" };
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${iv[range]||"1d"}&range=${range}`);
    const d = await r.json(); const res = d.chart.result[0];
    return (res.timestamp||[]).map((t,i) => ({ date: new Date(t*1000).toLocaleDateString("en-US",{month:"short",day:"numeric",year:range==="5y"?"2-digit":undefined}), price: res.indicators.quote[0].close[i] ? parseFloat(res.indicators.quote[0].close[i].toFixed(2)) : null })).filter(d => d.price);
  } catch {
    try {
      const r2 = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${iv[range]||"1d"}&range=${range}`)}`);
      const d2 = await r2.json(); const res2 = d2.chart.result[0];
      return (res2.timestamp||[]).map((t,i) => ({ date: new Date(t*1000).toLocaleDateString("en-US",{month:"short",day:"numeric"}), price: res2.indicators.quote[0].close[i] ? parseFloat(res2.indicators.quote[0].close[i].toFixed(2)) : null })).filter(d => d.price);
    } catch { return []; }
  }
}

async function getQuotes(tickers) {
  const r = {}; await Promise.allSettled(tickers.map(async t => { const q = await getQuote(t); if(q) r[t]=q; })); return r;
}

const C = {
  bg:"#0a0a0f",card:"#12121a",cardHover:"#1a1a28",border:"#1e1e2e",
  accent:"#c8a54e",accentDim:"#a08530",accentGlow:"rgba(200,165,78,0.15)",
  green:"#22c55e",red:"#ef4444",text:"#e8e6e0",textDim:"#8a8a9a",
  textMuted:"#555566",white:"#ffffff",blue:"#3b82f6",
  chart:["#c8a54e","#22c55e","#3b82f6","#ef4444","#a855f7","#f97316","#06b6d4","#ec4899"],
};

const fmt = (n,d=2) => n!=null ? Number(n).toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d}) : "—";
const fmtUSD = n => n!=null ? `$${fmt(n)}` : "—";
const fmtPct = n => n!=null ? `${n>=0?"+":""}${fmt(n)}%` : "—";
const fmtB = n => n!=null ? (Math.abs(n)>=1e12?`$${(n/1e12).toFixed(1)}T`:Math.abs(n)>=1e9?`$${(n/1e9).toFixed(1)}B`:Math.abs(n)>=1e6?`$${(n/1e6).toFixed(1)}M`:fmtUSD(n)) : "—";
const hoursAgo = d => d ? ((Date.now() - new Date(d).getTime()) / 3600000).toFixed(1) : 999;

function Pill({children,active,onClick,count}){return <button onClick={onClick} style={{padding:"8px 18px",borderRadius:24,border:`1px solid ${active?C.accent:C.border}`,background:active?C.accentGlow:"transparent",color:active?C.accent:C.textDim,fontSize:13,fontWeight:600,cursor:"pointer",transition:"all 0.2s",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",gap:6}}>{children}{count!=null&&<span style={{background:active?C.accent:C.border,color:active?C.bg:C.textDim,borderRadius:10,padding:"1px 7px",fontSize:11}}>{count}</span>}</button>}

function KPICard({label,value,sub,color,small}){return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:small?"12px 14px":"18px 20px",flex:"1 1 160px",minWidth:small?120:160}}><div style={{fontSize:small?9:11,color:C.textDim,textTransform:"uppercase",letterSpacing:1.2,marginBottom:small?4:6,fontWeight:600}}>{label}</div><div style={{fontSize:small?18:26,fontWeight:700,color:color||C.white,fontFamily:"'DM Sans',sans-serif"}}>{value}</div>{sub&&<div style={{fontSize:small?10:12,color:typeof sub==='string'&&sub.startsWith("+")?C.green:typeof sub==='string'&&sub.startsWith("-")?C.red:C.textDim,marginTop:3,fontWeight:500}}>{sub}</div>}</div>}

function Modal({open,onClose,title,children}){if(!open)return null;return <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,backdropFilter:"blur(4px)"}}><div onClick={e=>e.stopPropagation()} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:28,width:"min(480px,92vw)",maxHeight:"90vh",overflowY:"auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}><h3 style={{margin:0,color:C.white,fontSize:18,fontFamily:"'Playfair Display',serif"}}>{title}</h3><button onClick={onClose} style={{background:"none",border:"none",color:C.textDim,fontSize:22,cursor:"pointer"}}>✕</button></div>{children}</div></div>}

function Input({label,...props}){return <div style={{marginBottom:14}}>{label&&<label style={{display:"block",fontSize:11,color:C.textDim,marginBottom:5,textTransform:"uppercase",letterSpacing:1,fontWeight:600}}>{label}</label>}<input {...props} style={{width:"100%",padding:"10px 14px",borderRadius:10,border:`1px solid ${C.border}`,background:C.bg,color:C.white,fontSize:14,fontFamily:"'DM Sans',sans-serif",outline:"none",boxSizing:"border-box",...(props.style||{})}}/></div>}

function Select({label,options,...props}){return <div style={{marginBottom:14}}>{label&&<label style={{display:"block",fontSize:11,color:C.textDim,marginBottom:5,textTransform:"uppercase",letterSpacing:1,fontWeight:600}}>{label}</label>}<select {...props} style={{width:"100%",padding:"10px 14px",borderRadius:10,border:`1px solid ${C.border}`,background:C.bg,color:C.white,fontSize:14,fontFamily:"'DM Sans',sans-serif",outline:"none",boxSizing:"border-box"}}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>}

function Btn({children,variant="primary",...props}){const s={primary:{background:C.accent,color:C.bg,border:"none"},secondary:{background:"transparent",color:C.accent,border:`1px solid ${C.accent}`},danger:{background:"transparent",color:C.red,border:`1px solid ${C.red}`},ghost:{background:"transparent",color:C.textDim,border:`1px solid ${C.border}`}};return <button {...props} style={{padding:"10px 20px",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all 0.2s",...s[variant],...(props.style||{})}}>{children}</button>}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPANY DASHBOARD with Supabase Cache
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function CompanyDashboard({ ticker, name, onBack, holding, quote: quoteProp, onCacheUpdate }) {
  const [cd, setCd] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [chartRange, setChartRange] = useState("1y");
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [customQ, setCustomQ] = useState("");
  const [source, setSource] = useState("");
  const [liveQuote, setLiveQuote] = useState(quoteProp || null);

  // Always fetch live quote for this ticker
  useEffect(() => {
    (async () => {
      const q = await getQuote(ticker);
      if (q) setLiveQuote(q);
    })();
  }, [ticker]);
  const quote = liveQuote || quoteProp;

  const fetchFromClaude = useCallback(async () => {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          system: "You are a financial data assistant. Return ONLY valid JSON, no markdown, no backticks, no preamble.",
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: `Search for the latest financial data for ${ticker} (${name}). Return ONLY this JSON:
{"company_name":"","ticker":"${ticker}","sector":"","industry":"","country":"","employees":0,"description":"2-3 sentence description in Spanish","market_cap":0,"pe_ratio":null,"forward_pe":null,"peg_ratio":null,"price_to_book":null,"ev_to_ebitda":null,"revenue":0,"revenue_growth_yoy":0,"net_income":0,"net_margin":0,"gross_margin":0,"operating_margin":0,"eps":0,"eps_growth_yoy":null,"roe":null,"roa":null,"debt_to_equity":null,"current_ratio":null,"free_cash_flow":null,"dividend_yield":null,"beta":null,"52w_high":0,"52w_low":0,"avg_volume":null,"revenue_history":[{"year":"FY2021","value":0},{"year":"FY2022","value":0},{"year":"FY2023","value":0},{"year":"FY2024","value":0},{"year":"FY2025","value":0}],"net_income_history":[{"year":"FY2021","value":0},{"year":"FY2022","value":0},{"year":"FY2023","value":0},{"year":"FY2024","value":0},{"year":"FY2025","value":0}],"margin_history":[{"year":"FY2021","gross":0,"operating":0,"net":0}],"competitors":["","",""],"recent_news_summary":"in Spanish","analyst_consensus":"buy/hold/sell","target_price_avg":0}
Use real data only.`}],
        }),
      });
      const d = await r.json();
      const txt = d.content?.filter(c => c.type === "text").map(c => c.text).join("") || "";
      const cleaned = txt.replace(/```json|```/g, "").trim();
      let parsed = null;
      try { parsed = JSON.parse(cleaned); } catch {
        const m = cleaned.match(/\{[\s\S]*\}/);
        if (m) try { parsed = JSON.parse(m[0]); } catch {}
      }
      return parsed;
    } catch (e) { console.error(e); return null; }
  }, [ticker, name]);

  const loadCompanyData = useCallback(async (forceRefresh = false) => {
    setLoadingData(true);
    // Check Supabase cache first
    if (!forceRefresh) {
      try {
        const cached = await sb.get("company_research", `ticker=eq.${ticker}&limit=1`);
        if (cached && cached.length > 0 && cached[0].data) {
          const hrs = hoursAgo(cached[0].researched_at);
          if (hrs < 24) { // Use cache if < 24 hours old
            setCd(cached[0].data);
            setSource(`cache (${Math.round(hrs)}h ago)`);
            setLoadingData(false);
            return;
          }
        }
      } catch {}
    }
    // Fetch live from Claude
    setSource("live — buscando datos...");
    const data = await fetchFromClaude();
    if (data) {
      setCd(data);
      setSource("live ✓");
      // Save/update in Supabase
      try {
        await sb.upsert("company_research", { ticker, name: data.company_name || name, asset_type: "stock", data, researched_at: new Date().toISOString() });
        if (onCacheUpdate) onCacheUpdate();
      } catch (e) { console.error("Error saving to cache:", e); }
    }
    setLoadingData(false);
  }, [ticker, name, fetchFromClaude, onCacheUpdate]);

  const loadChart = useCallback(async (range) => {
    setChartRange(range);
    setChartData(await getChartData(ticker, range));
  }, [ticker]);

  useEffect(() => { loadCompanyData(); loadChart("1y"); }, [loadCompanyData, loadChart]);

  const analyzeCompany = async (prompt) => {
    setAiLoading(true); setAiAnalysis("");
    try {
      const ctx = cd ? JSON.stringify(cd) : `Ticker: ${ticker}`;
      const pi = quote ? `Precio: $${quote.price}` : "";
      const hi = holding ? `\nMi posición: ${holding.total_shares} acc, costo $${holding.avg_cost_basis}` : "";
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          system: "Eres un analista financiero senior. Responde en español, directo, con datos. No recomendaciones de compra/venta.",
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: `${ctx}\n${pi}${hi}\n\n${prompt}` }],
        }),
      });
      const d = await r.json();
      const text = d.content?.filter(c => c.type === "text").map(c => c.text).join("\n") || "Error.";
      setAiAnalysis(text);
      await sb.post("ai_analyses", { analysis_type: "single_asset", prompt, response: text });
    } catch (e) { setAiAnalysis("Error: " + e.message); }
    setAiLoading(false);
  };

  const cp = quote?.price || 0;
  const dc = quote ? ((quote.price - quote.prevClose) / quote.prevClose) * 100 : 0;

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <button onClick={onBack} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 14px", color: C.accent, cursor: "pointer", fontSize: 14, fontFamily: "'DM Sans',sans-serif", fontWeight: 600 }}>← Volver</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 28, fontFamily: "'Playfair Display',serif", color: C.white }}>{ticker}</h2>
            <span style={{ color: C.textDim, fontSize: 15 }}>{cd?.company_name || name}</span>
          </div>
          {cd && <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ padding: "3px 10px", borderRadius: 6, background: C.accentGlow, color: C.accent, fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{cd.sector}</span>
            <span style={{ padding: "3px 10px", borderRadius: 6, background: C.border, color: C.textDim, fontSize: 10 }}>{cd.industry}</span>
            <span style={{ padding: "3px 10px", borderRadius: 6, background: source.includes("cache") ? "rgba(34,197,94,0.1)" : "rgba(59,130,246,0.1)", color: source.includes("cache") ? C.green : C.blue, fontSize: 9, fontWeight: 600 }}>📦 {source}</span>
          </div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: C.white }}>{fmtUSD(cp)}</div>
          <div style={{ fontSize: 14, color: dc >= 0 ? C.green : C.red, fontWeight: 600 }}>{fmtPct(dc)} hoy</div>
        </div>
      </div>

      {loadingData ? (
        <div style={{ textAlign: "center", padding: 80, color: C.accent }}>
          <div style={{ fontSize: 32, marginBottom: 12, animation: "spin 1s linear infinite" }}>⟳</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Investigando {ticker}...</div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 6 }}>Claude está buscando datos financieros</div>
        </div>
      ) : (
        <>
          {cd?.description && <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px", marginBottom: 16, color: C.text, fontSize: 14, lineHeight: 1.6 }}>{cd.description}{cd.employees && <span style={{ color: C.textDim, fontSize: 12, marginLeft: 8 }}>• {Number(cd.employees).toLocaleString()} empleados</span>}</div>}

          {/* Refresh button */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <Btn variant="ghost" onClick={() => loadCompanyData(true)} style={{ fontSize: 11, padding: "6px 12px" }}>🔄 Actualizar datos (buscar en vivo)</Btn>
            {source.includes("cache") && <span style={{ fontSize: 11, color: C.textDim, alignSelf: "center" }}>Datos cargados del cache</span>}
          </div>

          {holding && (
            <div style={{ background: `linear-gradient(135deg, ${C.card} 0%, rgba(200,165,78,0.05) 100%)`, border: `1px solid ${C.accent}33`, borderRadius: 14, padding: "16px 20px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}>📌 Mi Posición</div>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                {[["Acciones", fmt(holding.total_shares, 4)],["Costo prom", fmtUSD(holding.avg_cost_basis)],["Invertido", fmtUSD(holding.total_invested)],["Valor actual", fmtUSD(holding.total_shares*cp)],["P&L", fmtUSD((holding.total_shares*cp)-holding.total_invested)],["P&L %", fmtPct(holding.total_invested>0?(((holding.total_shares*cp)-holding.total_invested)/holding.total_invested)*100:0)]].map(([l,v])=><div key={l}><div style={{fontSize:9,color:C.textDim,textTransform:"uppercase",letterSpacing:1}}>{l}</div><div style={{fontSize:16,color:C.white,fontWeight:600,marginTop:2}}>{v}</div></div>)}
              </div>
            </div>
          )}

          {/* Price Chart */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: C.accent, fontWeight: 700 }}>Precio Histórico</div>
              <div style={{ display: "flex", gap: 4 }}>
                {["1m","3mo","6mo","1y","5y"].map(r => <button key={r} onClick={() => loadChart(r)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${chartRange === r ? C.accent : C.border}`, background: chartRange === r ? C.accentGlow : "transparent", color: chartRange === r ? C.accent : C.textDim, fontSize: 11, cursor: "pointer", fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}>{r.toUpperCase()}</button>)}
              </div>
            </div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData}><defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.accent} stopOpacity={0.3}/><stop offset="95%" stopColor={C.accent} stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="date" tick={{fill:C.textDim,fontSize:10}} axisLine={{stroke:C.border}} interval="preserveStartEnd"/><YAxis tick={{fill:C.textDim,fontSize:10}} axisLine={{stroke:C.border}} domain={["auto","auto"]} tickFormatter={v=>`$${v}`}/><Tooltip contentStyle={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,color:C.white,fontSize:12}} formatter={v=>[`$${v}`,"Precio"]}/><Area type="monotone" dataKey="price" stroke={C.accent} fill="url(#pg)" strokeWidth={2} dot={false}/></AreaChart>
              </ResponsiveContainer>
            ) : <div style={{ textAlign: "center", padding: 40, color: C.textDim }}>Cargando...</div>}
            {cd && <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
              <span style={{ fontSize: 11, color: C.textDim }}>52w Hi: <span style={{ color: C.green }}>{fmtUSD(cd["52w_high"])}</span></span>
              <span style={{ fontSize: 11, color: C.textDim }}>52w Lo: <span style={{ color: C.red }}>{fmtUSD(cd["52w_low"])}</span></span>
              {cd.beta && <span style={{ fontSize: 11, color: C.textDim }}>Beta: <span style={{ color: C.white }}>{fmt(cd.beta)}</span></span>}
            </div>}
          </div>

          {cd && <>
            <div style={{fontSize:13,color:C.accent,fontWeight:700,marginBottom:10}}>Valoración</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
              <KPICard small label="Market Cap" value={fmtB(cd.market_cap)}/><KPICard small label="P/E" value={cd.pe_ratio?fmt(cd.pe_ratio):"—"}/><KPICard small label="Forward P/E" value={cd.forward_pe?fmt(cd.forward_pe):"—"}/><KPICard small label="PEG" value={cd.peg_ratio?fmt(cd.peg_ratio):"—"}/><KPICard small label="P/B" value={cd.price_to_book?fmt(cd.price_to_book):"—"}/><KPICard small label="EV/EBITDA" value={cd.ev_to_ebitda?fmt(cd.ev_to_ebitda):"—"}/>
            </div>
            <div style={{fontSize:13,color:C.accent,fontWeight:700,marginBottom:10}}>Rentabilidad</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
              <KPICard small label="Revenue" value={fmtB(cd.revenue)} sub={cd.revenue_growth_yoy?fmtPct(cd.revenue_growth_yoy)+" YoY":undefined}/><KPICard small label="Net Income" value={fmtB(cd.net_income)}/><KPICard small label="EPS" value={cd.eps?`$${fmt(cd.eps)}`:"—"}/><KPICard small label="Gross Margin" value={cd.gross_margin?`${fmt(cd.gross_margin)}%`:"—"}/><KPICard small label="Op Margin" value={cd.operating_margin?`${fmt(cd.operating_margin)}%`:"—"}/><KPICard small label="Net Margin" value={cd.net_margin?`${fmt(cd.net_margin)}%`:"—"}/>
            </div>
            <div style={{fontSize:13,color:C.accent,fontWeight:700,marginBottom:10}}>Solidez & Retorno</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
              <KPICard small label="ROE" value={cd.roe?`${fmt(cd.roe)}%`:"—"}/><KPICard small label="ROA" value={cd.roa?`${fmt(cd.roa)}%`:"—"}/><KPICard small label="D/E" value={cd.debt_to_equity?fmt(cd.debt_to_equity):"—"}/><KPICard small label="Current" value={cd.current_ratio?fmt(cd.current_ratio):"—"}/><KPICard small label="FCF" value={cd.free_cash_flow?fmtB(cd.free_cash_flow):"—"}/><KPICard small label="Div Yield" value={cd.dividend_yield?`${fmt(cd.dividend_yield)}%`:"—"} color={C.accent}/>
            </div>

            {cd.revenue_history?.length > 0 && <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:18}}><div style={{fontSize:12,color:C.accent,fontWeight:700,marginBottom:10}}>Revenue</div><ResponsiveContainer width="100%" height={200}><BarChart data={cd.revenue_history}><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="year" tick={{fill:C.textDim,fontSize:10}} axisLine={{stroke:C.border}}/><YAxis tick={{fill:C.textDim,fontSize:10}} axisLine={{stroke:C.border}} tickFormatter={v=>`$${(v/1e9).toFixed(0)}B`}/><Tooltip contentStyle={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,color:C.white,fontSize:12}} formatter={v=>[fmtB(v),"Revenue"]}/><Bar dataKey="value" fill={C.accent} radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:18}}><div style={{fontSize:12,color:C.accent,fontWeight:700,marginBottom:10}}>Net Income</div><ResponsiveContainer width="100%" height={200}><BarChart data={cd.net_income_history||[]}><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="year" tick={{fill:C.textDim,fontSize:10}} axisLine={{stroke:C.border}}/><YAxis tick={{fill:C.textDim,fontSize:10}} axisLine={{stroke:C.border}} tickFormatter={v=>`$${(v/1e9).toFixed(0)}B`}/><Tooltip contentStyle={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,color:C.white,fontSize:12}} formatter={v=>[fmtB(v),"Net Income"]}/><Bar dataKey="value" fill={C.green} radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
            </div>}

            {cd.margin_history?.length > 0 && <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:18,marginBottom:16}}><div style={{fontSize:12,color:C.accent,fontWeight:700,marginBottom:10}}>Márgenes (%)</div><ResponsiveContainer width="100%" height={220}><LineChart data={cd.margin_history}><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="year" tick={{fill:C.textDim,fontSize:10}} axisLine={{stroke:C.border}}/><YAxis tick={{fill:C.textDim,fontSize:10}} axisLine={{stroke:C.border}} tickFormatter={v=>`${v}%`}/><Tooltip contentStyle={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,color:C.white,fontSize:12}} formatter={v=>[`${fmt(v)}%`]}/><Legend wrapperStyle={{fontSize:11}}/><Line type="monotone" dataKey="gross" stroke={C.accent} name="Gross" strokeWidth={2} dot={{r:3}}/><Line type="monotone" dataKey="operating" stroke={C.green} name="Operating" strokeWidth={2} dot={{r:3}}/><Line type="monotone" dataKey="net" stroke={C.blue} name="Net" strokeWidth={2} dot={{r:3}}/></LineChart></ResponsiveContainer></div>}

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
              {(cd.analyst_consensus||cd.target_price_avg)&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:18}}>
                <div style={{fontSize:12,color:C.accent,fontWeight:700,marginBottom:10}}>Consenso</div>
                {cd.analyst_consensus&&<div style={{marginBottom:8}}><span style={{padding:"4px 14px",borderRadius:8,fontSize:14,fontWeight:700,textTransform:"uppercase",background:cd.analyst_consensus==="buy"?"rgba(34,197,94,0.15)":cd.analyst_consensus==="sell"?"rgba(239,68,68,0.15)":"rgba(200,165,78,0.15)",color:cd.analyst_consensus==="buy"?C.green:cd.analyst_consensus==="sell"?C.red:C.accent}}>{cd.analyst_consensus==="buy"?"COMPRAR":cd.analyst_consensus==="sell"?"VENDER":"MANTENER"}</span></div>}
                {cd.target_price_avg&&<div><span style={{fontSize:11,color:C.textDim}}>Target: </span><span style={{color:C.white,fontWeight:700,fontSize:18}}>{fmtUSD(cd.target_price_avg)}</span><span style={{fontSize:11,color:cd.target_price_avg>cp?C.green:C.red,marginLeft:6}}>{fmtPct(((cd.target_price_avg-cp)/cp)*100)}</span></div>}
              </div>}
              {cd.competitors?.length>0&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:18}}><div style={{fontSize:12,color:C.accent,fontWeight:700,marginBottom:10}}>Competidores</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{cd.competitors.map(c=><span key={c} style={{padding:"6px 14px",borderRadius:8,background:C.bg,border:`1px solid ${C.border}`,color:C.white,fontSize:13,fontWeight:600}}>{c}</span>)}</div></div>}
            </div>

            {cd.recent_news_summary&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:18,marginBottom:16}}><div style={{fontSize:12,color:C.accent,fontWeight:700,marginBottom:8}}>📰 Noticias</div><div style={{color:C.text,fontSize:13,lineHeight:1.6}}>{cd.recent_news_summary}</div></div>}
          </>}

          {/* AI */}
          <div style={{background:C.card,border:`1px solid ${C.accent}44`,borderRadius:14,padding:22,marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}><span style={{fontSize:18}}>🤖</span><div style={{fontSize:14,color:C.accent,fontWeight:700,fontFamily:"'Playfair Display',serif"}}>AI Análisis — {ticker}</div></div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
              {[{l:"Análisis completo",p:`Análisis profundo de ${ticker}: valoración, crecimiento, riesgos, fortalezas.`},{l:"¿Cara o barata?",p:`¿${ticker} está sobrevaluada o subvaluada vs industria e historial?`},{l:"Riesgos",p:`Principales riesgos de ${ticker}: negocio, competitivos, regulatorios, macro.`},{l:"Moat",p:`Moat de ${ticker}: pricing power, switching costs, network effects, escala.`},{l:"Crecimiento",p:`Perspectivas de crecimiento de ${ticker}. ¿De dónde y es sostenible?`}].map(({l,p})=><Btn key={l} variant="secondary" onClick={()=>analyzeCompany(p)} style={{fontSize:11,padding:"5px 12px"}}>{l}</Btn>)}
            </div>
            <div style={{display:"flex",gap:8}}>
              <input placeholder={`Preguntá sobre ${ticker}...`} value={customQ} onChange={e=>setCustomQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&customQ&&analyzeCompany(customQ)} style={{flex:1,padding:"10px 14px",borderRadius:10,border:`1px solid ${C.border}`,background:C.bg,color:C.white,fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none"}}/>
              <Btn onClick={()=>customQ&&analyzeCompany(customQ)} disabled={aiLoading}>Analizar</Btn>
            </div>
            {aiLoading&&<div style={{textAlign:"center",padding:24,color:C.accent}}><div style={{fontSize:24,animation:"spin 1s linear infinite"}}>⟳</div><div style={{fontSize:12,marginTop:6}}>Analizando...</div></div>}
            {aiAnalysis&&!aiLoading&&<div style={{marginTop:14,padding:18,background:C.bg,borderRadius:12,border:`1px solid ${C.border}`,color:C.text,fontSize:14,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{aiAnalysis}</div>}
          </div>
        </>
      )}
    </div>
  );
}

// Modals
function AddAssetModal({open,onClose,onSaved}){
  const [f,sF]=useState({ticker:"",name:"",asset_type:"stock",sector:"",notes:""});
  const [tx,sTx]=useState({quantity:"",price_per_unit:"",transaction_date:new Date().toISOString().split("T")[0],transaction_type:"buy",broker:"",fees:"0"});
  const [ld,sLd]=useState(false);
  const save=async()=>{if(!f.ticker||!f.name)return;sLd(true);try{const a=await sb.post("assets",{...f,ticker:f.ticker.toUpperCase()});if(a?.[0]&&tx.quantity&&tx.price_per_unit){await sb.post("transactions",{asset_id:a[0].id,transaction_type:tx.transaction_type,quantity:parseFloat(tx.quantity),price_per_unit:parseFloat(tx.price_per_unit),transaction_date:tx.transaction_date,broker:tx.broker||null,fees:parseFloat(tx.fees)||0});}onSaved();onClose();sF({ticker:"",name:"",asset_type:"stock",sector:"",notes:""});sTx({quantity:"",price_per_unit:"",transaction_date:new Date().toISOString().split("T")[0],transaction_type:"buy",broker:"",fees:"0"});}catch(e){console.error(e);}sLd(false);};
  return <Modal open={open} onClose={onClose} title="Agregar Inversión">
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Input label="Ticker" placeholder="AAPL, BTC-USD..." value={f.ticker} onChange={e=>sF({...f,ticker:e.target.value})}/><Select label="Tipo" options={[{value:"stock",label:"Acción"},{value:"etf",label:"ETF"},{value:"crypto",label:"Crypto"},{value:"bond",label:"Bono"}]} value={f.asset_type} onChange={e=>sF({...f,asset_type:e.target.value})}/></div>
    <Input label="Nombre" placeholder="Apple Inc." value={f.name} onChange={e=>sF({...f,name:e.target.value})}/>
    <Input label="Sector" placeholder="Technology..." value={f.sector} onChange={e=>sF({...f,sector:e.target.value})}/>
    <div style={{borderTop:`1px solid ${C.border}`,margin:"18px 0",paddingTop:16}}>
      <div style={{fontSize:13,color:C.accent,fontWeight:700,marginBottom:12}}>Transacción Inicial</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Input label="Cantidad" type="number" value={tx.quantity} onChange={e=>sTx({...tx,quantity:e.target.value})}/><Input label="Precio" type="number" value={tx.price_per_unit} onChange={e=>sTx({...tx,price_per_unit:e.target.value})}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Input label="Fecha" type="date" value={tx.transaction_date} onChange={e=>sTx({...tx,transaction_date:e.target.value})}/><Input label="Broker" value={tx.broker} onChange={e=>sTx({...tx,broker:e.target.value})}/></div>
      <Input label="Comisiones" type="number" value={tx.fees} onChange={e=>sTx({...tx,fees:e.target.value})}/>
    </div>
    <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={save} disabled={ld}>{ld?"Guardando...":"Guardar"}</Btn></div>
  </Modal>;
}

function AddTxModal({open,onClose,onSaved,assets}){
  const [f,sF]=useState({asset_id:"",transaction_type:"buy",quantity:"",price_per_unit:"",transaction_date:new Date().toISOString().split("T")[0],broker:"",fees:"0"});
  const [ld,sLd]=useState(false);
  const save=async()=>{if(!f.asset_id||!f.quantity||!f.price_per_unit)return;sLd(true);await sb.post("transactions",{...f,quantity:parseFloat(f.quantity),price_per_unit:parseFloat(f.price_per_unit),fees:parseFloat(f.fees)||0});onSaved();onClose();sF({asset_id:"",transaction_type:"buy",quantity:"",price_per_unit:"",transaction_date:new Date().toISOString().split("T")[0],broker:"",fees:"0"});sLd(false);};
  return <Modal open={open} onClose={onClose} title="Registrar Transacción">
    <Select label="Activo" options={[{value:"",label:"Seleccionar..."},...assets.map(a=>({value:a.id,label:`${a.ticker} — ${a.name}`}))]} value={f.asset_id} onChange={e=>sF({...f,asset_id:e.target.value})}/>
    <Select label="Tipo" options={[{value:"buy",label:"Compra"},{value:"sell",label:"Venta"},{value:"dividend",label:"Dividendo"}]} value={f.transaction_type} onChange={e=>sF({...f,transaction_type:e.target.value})}/>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Input label="Cantidad" type="number" value={f.quantity} onChange={e=>sF({...f,quantity:e.target.value})}/><Input label="Precio" type="number" value={f.price_per_unit} onChange={e=>sF({...f,price_per_unit:e.target.value})}/></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Input label="Fecha" type="date" value={f.transaction_date} onChange={e=>sF({...f,transaction_date:e.target.value})}/><Input label="Comisiones" type="number" value={f.fees} onChange={e=>sF({...f,fees:e.target.value})}/></div>
    <Input label="Broker" value={f.broker} onChange={e=>sF({...f,broker:e.target.value})}/>
    <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={save} disabled={ld}>{ld?"Guardando...":"Guardar"}</Btn></div>
  </Modal>;
}

function AIPanel({holdings,quotes,onClose}){
  const [a,sA]=useState("");const [ld,sLd]=useState(false);const [q,sQ]=useState("");
  const ctx=()=>{let c="Mi portafolio:\n\n";holdings.forEach(h=>{const p=quotes[h.ticker]?.price||0;const v=h.total_shares*p;const pnl=v-h.total_invested;c+=`• ${h.ticker} (${h.name}): ${h.total_shares} acc, costo $${fmt(h.avg_cost_basis)}, precio $${fmt(p)}, valor $${fmt(v)}, P&L $${fmt(pnl)}\n`;});const tv=holdings.reduce((s,h)=>s+h.total_shares*(quotes[h.ticker]?.price||0),0);const ti=holdings.reduce((s,h)=>s+h.total_invested,0);c+=`\nTotal: $${fmt(tv)} | Invertido: $${fmt(ti)} | P&L: $${fmt(tv-ti)}`;return c;};
  const run=async(p)=>{sLd(true);sA("");try{const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:"Analista financiero experto. Español, conciso. Sin recomendaciones de compra/venta.",tools:[{type:"web_search_20250305",name:"web_search"}],messages:[{role:"user",content:`${ctx()}\n\n${p}`}]})});const d=await r.json();const t=d.content?.filter(c=>c.type==="text").map(c=>c.text).join("\n")||"Error.";sA(t);await sb.post("ai_analyses",{analysis_type:"portfolio",prompt:p,response:t});}catch(e){sA("Error: "+e.message);}sLd(false);};
  return <div style={{background:C.card,border:`1px solid ${C.accent}`,borderRadius:16,padding:24,marginTop:20}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:20}}>🤖</span><h3 style={{margin:0,color:C.accent,fontSize:16,fontFamily:"'Playfair Display',serif"}}>AI Portafolio</h3></div><button onClick={onClose} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:18}}>✕</button></div>
    <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>{[{l:"General",p:"Análisis general: diversificación y riesgos"},{l:"Exposición",p:"Exposición por sector y tipo"},{l:"Rendimiento",p:"Rendimiento por posición"},{l:"Dividendos",p:"Análisis de dividendos"}].map(({l,p})=><Btn key={l} variant="secondary" onClick={()=>run(p)} style={{fontSize:12,padding:"6px 14px"}}>{l}</Btn>)}</div>
    <div style={{display:"flex",gap:8}}><input placeholder="Preguntá..." value={q} onChange={e=>sQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&q&&run(q)} style={{flex:1,padding:"10px 14px",borderRadius:10,border:`1px solid ${C.border}`,background:C.bg,color:C.white,fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none"}}/><Btn onClick={()=>q&&run(q)} disabled={ld}>Analizar</Btn></div>
    {ld&&<div style={{textAlign:"center",padding:30,color:C.accent}}><div style={{fontSize:24,animation:"spin 1s linear infinite"}}>⟳</div></div>}
    {a&&!ld&&<div style={{marginTop:16,padding:18,background:C.bg,borderRadius:12,border:`1px solid ${C.border}`,color:C.text,fontSize:14,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{a}</div>}
  </div>;
}

// ━━━ MAIN ━━━
export default function PabloInvestment({ user, onLogout }) {
  const [tab, setTab] = useState("portfolio");
  const [holdings, setHoldings] = useState([]); const [assets, setAssets] = useState([]);
  const [transactions, setTransactions] = useState([]); const [watchlist, setWatchlist] = useState([]);
  const [quotes, setQuotes] = useState({}); const [loading, setLoading] = useState(true);
  const [showAddAsset, setShowAddAsset] = useState(false); const [showAddTx, setShowAddTx] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [resTicker, setResTicker] = useState(null); const [resName, setResName] = useState("");
  const [quickTicker, setQuickTicker] = useState("");
  const [watchForm, setWatchForm] = useState({ ticker: "", name: "", asset_type: "stock", target_price: "" });
  // Research history
  const [researchHistory, setResearchHistory] = useState([]);

  const loadResearchHistory = useCallback(async () => {
    try {
      const h = await sb.get("company_research", "order=researched_at.desc&limit=50");
      setResearchHistory(h || []);
    } catch {}
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [h,a,t,w] = await Promise.all([sb.get("current_holdings"),sb.get("assets","order=created_at.desc"),sb.get("transactions","order=transaction_date.desc"),sb.get("watchlist","order=created_at.desc")]);
      setHoldings(h||[]); setAssets(a||[]); setTransactions(t||[]); setWatchlist(w||[]);
      const tickers = [...new Set([...(h||[]).map(x=>x.ticker),...(w||[]).map(x=>x.ticker)])];
      if(tickers.length>0){const q=await getQuotes(tickers);setQuotes(q);}
    } catch(e){console.error(e);}
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); loadResearchHistory(); }, [loadData, loadResearchHistory]);

  const totalValue = holdings.reduce((s,h) => s + h.total_shares * (quotes[h.ticker]?.price || 0), 0);
  const totalInvested = holdings.reduce((s,h) => s + parseFloat(h.total_invested), 0);
  const totalPnL = totalValue - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  const totalDiv = holdings.reduce((s,h) => s + parseFloat(h.total_dividends || 0), 0);
  const pieData = holdings.map(h => ({ name: h.ticker, value: h.total_shares * (quotes[h.ticker]?.price || 0) })).filter(d => d.value > 0);
  const typeData = _.chain(holdings).groupBy("asset_type").map((items,type)=>({name:type==="stock"?"Acciones":type==="etf"?"ETFs":type==="crypto"?"Crypto":"Bonos",value:items.reduce((s,i)=>s+i.total_shares*(quotes[i.ticker]?.price||0),0)})).filter(d=>d.value>0).value();

  const openRes = (tk,nm) => { setResTicker(tk); setResName(nm); };
  const closeRes = () => { setResTicker(null); setResName(""); };
  const addWatch = async () => { if(!watchForm.ticker)return; await sb.post("watchlist",{...watchForm,ticker:watchForm.ticker.toUpperCase(),target_price:watchForm.target_price?parseFloat(watchForm.target_price):null}); setWatchForm({ticker:"",name:"",asset_type:"stock",target_price:""}); loadData(); };
  const delWatch = async id => { await sb.del("watchlist",`id=eq.${id}`); loadData(); };
  const delResearch = async id => { await sb.del("company_research",`id=eq.${id}`); loadResearchHistory(); };

  if (resTicker) {
    const hm = holdings.find(h => h.ticker === resTicker);
    return (
      <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'DM Sans',sans-serif" }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,700;1,700&display=swap" rel="stylesheet"/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}*{box-sizing:border-box}`}</style>
        <div style={{ background: `linear-gradient(135deg, ${C.bg} 0%, #111118 100%)`, borderBottom: `1px solid ${C.border}`, padding: "20px 28px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}><h1 style={{ margin: 0, fontSize: 24, fontFamily: "'Playfair Display',serif", color: C.white }}><span style={{ color: C.accent }}>Pablo</span> Investment <span style={{ fontSize: 14, color: C.textDim, fontFamily: "'DM Sans',sans-serif", fontWeight: 400 }}>/ Research</span></h1></div>
        </div>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 28px" }}>
          <CompanyDashboard ticker={resTicker} name={resName} onBack={closeRes} holding={hm} quote={quotes[resTicker]} onCacheUpdate={loadResearchHistory} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'DM Sans',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,700;1,700&display=swap" rel="stylesheet"/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}*{box-sizing:border-box}`}</style>

      <div style={{background:`linear-gradient(135deg,${C.bg} 0%,#111118 100%)`,borderBottom:`1px solid ${C.border}`,padding:"20px 28px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",maxWidth:1200,margin:"0 auto",flexWrap:"wrap",gap:12}}>
          <div><h1 style={{margin:0,fontSize:24,fontFamily:"'Playfair Display',serif",color:C.white}}><span style={{color:C.accent}}>Pablo</span> Investment</h1><div style={{fontSize:11,color:C.textDim,marginTop:2}}>Portfolio Tracker & AI Research{user && <span style={{marginLeft:8,color:C.accent}}>• {user.name}</span>}</div></div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{display:"flex",gap:4}}>
              <input placeholder="Buscar empresa..." value={quickTicker} onChange={e=>setQuickTicker(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&quickTicker){openRes(quickTicker.toUpperCase(),quickTicker.toUpperCase());setQuickTicker("");}}} style={{padding:"8px 12px",borderRadius:8,border:`1px solid ${C.border}`,background:C.bg,color:C.white,fontSize:12,width:160,fontFamily:"'DM Sans',sans-serif",outline:"none"}}/>
              <Btn variant="secondary" onClick={()=>{if(quickTicker){openRes(quickTicker.toUpperCase(),quickTicker.toUpperCase());setQuickTicker("");}}} style={{fontSize:11,padding:"8px 12px"}}>🔍</Btn>
            </div>
            <Btn variant="secondary" onClick={()=>setShowAI(!showAI)} style={{fontSize:12}}>🤖</Btn>
            <Btn onClick={()=>setShowAddAsset(true)} style={{fontSize:12}}>+ Inversión</Btn>{onLogout && <Btn variant="ghost" onClick={onLogout} style={{fontSize:11,padding:"8px 10px"}}>Salir</Btn>}
          </div>
        </div>
      </div>

      <div style={{maxWidth:1200,margin:"0 auto",padding:"20px 28px"}}>
        <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:24,animation:"fadeIn 0.5s ease"}}>
          <KPICard label="Valor" value={fmtUSD(totalValue)} sub={totalPnL!==0?`${totalPnL>=0?"+":""}$${fmt(Math.abs(totalPnL))}`:undefined} color={C.white}/>
          <KPICard label="P&L" value={fmtUSD(totalPnL)} sub={fmtPct(totalPnLPct)} color={totalPnL>=0?C.green:C.red}/>
          <KPICard label="Invertido" value={fmtUSD(totalInvested)}/>
          <KPICard label="Posiciones" value={holdings.length} sub={`${assets.length} activos`}/>
          <KPICard label="Dividendos" value={fmtUSD(totalDiv)} color={C.accent}/>
        </div>

        <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
          <Pill active={tab==="portfolio"} onClick={()=>setTab("portfolio")} count={holdings.length}>Portafolio</Pill>
          <Pill active={tab==="transactions"} onClick={()=>setTab("transactions")} count={transactions.length}>Transacciones</Pill>
          <Pill active={tab==="watchlist"} onClick={()=>setTab("watchlist")} count={watchlist.length}>Watchlist</Pill>
          <Pill active={tab==="research"} onClick={()=>setTab("research")} count={researchHistory.length}>📚 Historial</Pill>
          <Pill active={tab==="charts"} onClick={()=>setTab("charts")}>Gráficos</Pill>
        </div>

        {showAI && <AIPanel holdings={holdings} quotes={quotes} onClose={()=>setShowAI(false)}/>}

        {/* PORTFOLIO */}
        {tab==="portfolio"&&<div style={{animation:"fadeIn 0.3s ease"}}>
          {loading?<div style={{textAlign:"center",padding:60,color:C.textDim}}>Cargando...</div>:holdings.length===0?
          <div style={{textAlign:"center",padding:60,background:C.card,borderRadius:16,border:`1px solid ${C.border}`}}>
            <div style={{fontSize:48,marginBottom:14}}>📊</div><div style={{fontSize:18,color:C.white,fontWeight:600,marginBottom:8}}>Portafolio vacío</div><div style={{fontSize:14,color:C.textDim,marginBottom:20}}>Agregá tu primera inversión</div><Btn onClick={()=>setShowAddAsset(true)}>+ Agregar</Btn>
          </div>:
          <div style={{background:C.card,borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden"}}><div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>{["Activo","Tipo","Cant.","Costo","Precio","Valor","P&L","%",""].map(h=><th key={h} style={{padding:"12px 14px",textAlign:"left",fontSize:10,color:C.textDim,textTransform:"uppercase",letterSpacing:1.2,fontWeight:600}}>{h}</th>)}</tr></thead>
              <tbody>{holdings.map(h=>{const q=quotes[h.ticker];const p=q?.price||0;const v=h.total_shares*p;const pnl=v-h.total_invested;const pp=h.total_invested>0?(pnl/h.total_invested)*100:0;const dc=q?((q.price-q.prevClose)/q.prevClose)*100:null;
                return <tr key={h.asset_id} style={{borderBottom:`1px solid ${C.border}`,cursor:"pointer",transition:"background 0.15s"}} onMouseEnter={e=>e.currentTarget.style.background=C.cardHover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{padding:"14px"}} onClick={()=>openRes(h.ticker,h.name)}><div style={{fontWeight:700,color:C.white}}>{h.ticker}</div><div style={{fontSize:11,color:C.textDim,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.name}</div></td>
                  <td style={{padding:"14px"}} onClick={()=>openRes(h.ticker,h.name)}><span style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:700,textTransform:"uppercase",background:C.accentGlow,color:C.accent}}>{h.asset_type}</span></td>
                  <td style={{padding:"14px",color:C.text}} onClick={()=>openRes(h.ticker,h.name)}>{fmt(h.total_shares,4)}</td>
                  <td style={{padding:"14px",color:C.text}} onClick={()=>openRes(h.ticker,h.name)}>{fmtUSD(h.avg_cost_basis)}</td>
                  <td style={{padding:"14px"}} onClick={()=>openRes(h.ticker,h.name)}><div style={{color:C.white,fontWeight:600}}>{fmtUSD(p)}</div>{dc!=null&&<div style={{fontSize:10,color:dc>=0?C.green:C.red}}>{fmtPct(dc)}</div>}</td>
                  <td style={{padding:"14px",color:C.white,fontWeight:600}} onClick={()=>openRes(h.ticker,h.name)}>{fmtUSD(v)}</td>
                  <td style={{padding:"14px",color:pnl>=0?C.green:C.red,fontWeight:600}} onClick={()=>openRes(h.ticker,h.name)}>{fmtUSD(pnl)}</td>
                  <td style={{padding:"14px",color:pnl>=0?C.green:C.red,fontWeight:600}} onClick={()=>openRes(h.ticker,h.name)}>{fmtPct(pp)}</td>
                  <td style={{padding:"14px"}}><button onClick={()=>openRes(h.ticker,h.name)} style={{background:C.accentGlow,border:`1px solid ${C.accent}44`,borderRadius:6,padding:"4px 10px",color:C.accent,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>🔍</button></td>
                </tr>})}</tbody>
            </table>
          </div></div>}
          <div style={{marginTop:14,display:"flex",gap:10}}><Btn variant="secondary" onClick={()=>setShowAddTx(true)} style={{fontSize:12}}>+ Transacción</Btn><Btn variant="ghost" onClick={loadData} style={{fontSize:12}}>⟳ Actualizar</Btn></div>
        </div>}

        {/* TRANSACTIONS */}
        {tab==="transactions"&&<div style={{animation:"fadeIn 0.3s ease"}}>
          <div style={{background:C.card,borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden"}}>
            {transactions.length===0?<div style={{textAlign:"center",padding:40,color:C.textDim}}>Sin transacciones</div>:
            <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>{["Fecha","Tipo","Activo","Cant.","Precio","Total","Fee","Broker"].map(h=><th key={h} style={{padding:"12px 14px",textAlign:"left",fontSize:10,color:C.textDim,textTransform:"uppercase",letterSpacing:1.2,fontWeight:600}}>{h}</th>)}</tr></thead>
              <tbody>{transactions.map(tx=>{const a=assets.find(a=>a.id===tx.asset_id);return <tr key={tx.id} style={{borderBottom:`1px solid ${C.border}`}}><td style={{padding:"12px 14px",color:C.text}}>{tx.transaction_date}</td><td style={{padding:"12px 14px"}}><span style={{color:tx.transaction_type==="buy"?C.green:tx.transaction_type==="sell"?C.red:C.accent,fontWeight:700,fontSize:11,textTransform:"uppercase"}}>{tx.transaction_type==="buy"?"COMPRA":tx.transaction_type==="sell"?"VENTA":"DIV"}</span></td><td style={{padding:"12px 14px",color:C.white,fontWeight:600}}>{a?.ticker||"—"}</td><td style={{padding:"12px 14px",color:C.text}}>{fmt(tx.quantity,4)}</td><td style={{padding:"12px 14px",color:C.text}}>{fmtUSD(tx.price_per_unit)}</td><td style={{padding:"12px 14px",color:C.white,fontWeight:600}}>{fmtUSD(tx.total_amount)}</td><td style={{padding:"12px 14px",color:C.textDim}}>{fmtUSD(tx.fees)}</td><td style={{padding:"12px 14px",color:C.textDim}}>{tx.broker||"—"}</td></tr>})}</tbody>
            </table></div>}
          </div>
          <div style={{marginTop:14}}><Btn variant="secondary" onClick={()=>setShowAddTx(true)} style={{fontSize:12}}>+ Transacción</Btn></div>
        </div>}

        {/* WATCHLIST */}
        {tab==="watchlist"&&<div style={{animation:"fadeIn 0.3s ease"}}>
          <div style={{background:C.card,borderRadius:16,border:`1px solid ${C.border}`,padding:20,marginBottom:16}}>
            <div style={{fontSize:13,color:C.accent,fontWeight:700,marginBottom:12}}>Agregar a Watchlist</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
              <Input label="Ticker" placeholder="TSLA" value={watchForm.ticker} onChange={e=>setWatchForm({...watchForm,ticker:e.target.value})} style={{marginBottom:0}}/>
              <Input label="Nombre" placeholder="Tesla" value={watchForm.name} onChange={e=>setWatchForm({...watchForm,name:e.target.value})} style={{marginBottom:0}}/>
              <Input label="Target" type="number" placeholder="200" value={watchForm.target_price} onChange={e=>setWatchForm({...watchForm,target_price:e.target.value})} style={{marginBottom:0}}/>
              <Btn onClick={addWatch} style={{marginBottom:14}}>Agregar</Btn>
            </div>
          </div>
          <div style={{background:C.card,borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden"}}>
            {watchlist.length===0?<div style={{textAlign:"center",padding:40,color:C.textDim}}>Watchlist vacía</div>:
            <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>{["Ticker","Nombre","Precio","Hoy","Target","Dist.","",""].map((h,i)=><th key={h+i} style={{padding:"12px 14px",textAlign:"left",fontSize:10,color:C.textDim,textTransform:"uppercase",letterSpacing:1.2,fontWeight:600}}>{h}</th>)}</tr></thead>
              <tbody>{watchlist.map(w=>{const q=quotes[w.ticker];const p=q?.price||0;const dc=q?((q.price-q.prevClose)/q.prevClose)*100:null;const d=w.target_price&&p?((w.target_price-p)/p)*100:null;
                return <tr key={w.id} style={{borderBottom:`1px solid ${C.border}`}}>
                  <td style={{padding:"12px 14px",color:C.white,fontWeight:700}}>{w.ticker}</td>
                  <td style={{padding:"12px 14px",color:C.text}}>{w.name||"—"}</td>
                  <td style={{padding:"12px 14px",color:C.white,fontWeight:600}}>{p?fmtUSD(p):"—"}</td>
                  <td style={{padding:"12px 14px",color:dc!=null?(dc>=0?C.green:C.red):C.textDim}}>{dc!=null?fmtPct(dc):"—"}</td>
                  <td style={{padding:"12px 14px",color:C.accent}}>{w.target_price?fmtUSD(w.target_price):"—"}</td>
                  <td style={{padding:"12px 14px",color:d!=null?(d>0?C.green:C.red):C.textDim}}>{d!=null?fmtPct(d):"—"}</td>
                  <td style={{padding:"12px 14px"}}><button onClick={()=>openRes(w.ticker,w.name||w.ticker)} style={{background:C.accentGlow,border:`1px solid ${C.accent}44`,borderRadius:6,padding:"4px 10px",color:C.accent,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>🔍</button></td>
                  <td style={{padding:"12px 14px"}}><button onClick={()=>delWatch(w.id)} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:14}}>✕</button></td>
                </tr>})}</tbody>
            </table></div>}
          </div>
        </div>}

        {/* RESEARCH HISTORY */}
        {tab==="research"&&<div style={{animation:"fadeIn 0.3s ease"}}>
          <div style={{background:C.card,borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden"}}>
            <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:14,color:C.accent,fontWeight:700,fontFamily:"'Playfair Display',serif"}}>📚 Empresas Investigadas</div>
              <div style={{fontSize:11,color:C.textDim}}>{researchHistory.length} empresas en cache</div>
            </div>
            {researchHistory.length===0?<div style={{textAlign:"center",padding:40,color:C.textDim}}>No has investigado ninguna empresa aún. Usá el buscador 🔍 en el header.</div>:
            <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>{["Ticker","Empresa","Sector","Market Cap","P/E","Revenue","Última actualización","",""].map(h=><th key={h} style={{padding:"12px 14px",textAlign:"left",fontSize:10,color:C.textDim,textTransform:"uppercase",letterSpacing:1.2,fontWeight:600}}>{h}</th>)}</tr></thead>
              <tbody>{researchHistory.map(r=>{const d=r.data||{};const hrs=hoursAgo(r.researched_at);const stale=hrs>24;
                return <tr key={r.id} style={{borderBottom:`1px solid ${C.border}`,cursor:"pointer",transition:"background 0.15s"}} onMouseEnter={e=>e.currentTarget.style.background=C.cardHover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{padding:"14px"}} onClick={()=>openRes(r.ticker,r.name||r.ticker)}><div style={{fontWeight:700,color:C.white}}>{r.ticker}</div></td>
                  <td style={{padding:"14px",color:C.text}} onClick={()=>openRes(r.ticker,r.name||r.ticker)}>{d.company_name||r.name||"—"}</td>
                  <td style={{padding:"14px"}} onClick={()=>openRes(r.ticker,r.name||r.ticker)}><span style={{padding:"3px 8px",borderRadius:6,fontSize:10,background:C.accentGlow,color:C.accent}}>{d.sector||"—"}</span></td>
                  <td style={{padding:"14px",color:C.white,fontWeight:600}} onClick={()=>openRes(r.ticker,r.name||r.ticker)}>{d.market_cap?fmtB(d.market_cap):"—"}</td>
                  <td style={{padding:"14px",color:C.text}} onClick={()=>openRes(r.ticker,r.name||r.ticker)}>{d.pe_ratio?fmt(d.pe_ratio):"—"}</td>
                  <td style={{padding:"14px",color:C.text}} onClick={()=>openRes(r.ticker,r.name||r.ticker)}>{d.revenue?fmtB(d.revenue):"—"}</td>
                  <td style={{padding:"14px"}} onClick={()=>openRes(r.ticker,r.name||r.ticker)}>
                    <div style={{fontSize:11,color:stale?C.red:C.green}}>{Math.round(hrs)}h ago</div>
                    <div style={{fontSize:9,color:C.textDim}}>{new Date(r.researched_at).toLocaleDateString()}</div>
                  </td>
                  <td style={{padding:"14px"}}><button onClick={()=>openRes(r.ticker,r.name||r.ticker)} style={{background:C.accentGlow,border:`1px solid ${C.accent}44`,borderRadius:6,padding:"4px 10px",color:C.accent,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>🔍</button></td>
                  <td style={{padding:"14px"}}><button onClick={()=>delResearch(r.id)} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:14}}>✕</button></td>
                </tr>})}</tbody>
            </table></div>}
          </div>
        </div>}

        {/* CHARTS */}
        {tab==="charts"&&<div style={{animation:"fadeIn 0.3s ease",display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <div style={{background:C.card,borderRadius:16,border:`1px solid ${C.border}`,padding:20}}><div style={{fontSize:13,color:C.accent,fontWeight:700,marginBottom:14}}>Por Activo</div>{pieData.length>0?<ResponsiveContainer width="100%" height={250}><PieChart><Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} stroke="none">{pieData.map((_,i)=><Cell key={i} fill={C.chart[i%C.chart.length]}/>)}</Pie><Tooltip contentStyle={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,color:C.white,fontSize:12}} formatter={v=>fmtUSD(v)}/><Legend wrapperStyle={{fontSize:11,color:C.textDim}}/></PieChart></ResponsiveContainer>:<div style={{textAlign:"center",padding:40,color:C.textDim}}>Sin datos</div>}</div>
          <div style={{background:C.card,borderRadius:16,border:`1px solid ${C.border}`,padding:20}}><div style={{fontSize:13,color:C.accent,fontWeight:700,marginBottom:14}}>Por Tipo</div>{typeData.length>0?<ResponsiveContainer width="100%" height={250}><BarChart data={typeData}><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="name" tick={{fill:C.textDim,fontSize:11}} axisLine={{stroke:C.border}}/><YAxis tick={{fill:C.textDim,fontSize:11}} axisLine={{stroke:C.border}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/><Tooltip contentStyle={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,color:C.white,fontSize:12}} formatter={v=>fmtUSD(v)}/><Bar dataKey="value" fill={C.accent} radius={[6,6,0,0]}/></BarChart></ResponsiveContainer>:<div style={{textAlign:"center",padding:40,color:C.textDim}}>Sin datos</div>}</div>
          <div style={{background:C.card,borderRadius:16,border:`1px solid ${C.border}`,padding:20,gridColumn:"1/-1"}}><div style={{fontSize:13,color:C.accent,fontWeight:700,marginBottom:14}}>P&L por Posición</div>{holdings.length>0?<ResponsiveContainer width="100%" height={280}><BarChart data={holdings.map(h=>{const p=quotes[h.ticker]?.price||0;return{name:h.ticker,pnl:(h.total_shares*p)-h.total_invested};})}><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="name" tick={{fill:C.textDim,fontSize:11}} axisLine={{stroke:C.border}}/><YAxis tick={{fill:C.textDim,fontSize:11}} axisLine={{stroke:C.border}} tickFormatter={v=>`$${v.toFixed(0)}`}/><Tooltip contentStyle={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,color:C.white,fontSize:12}} formatter={v=>fmtUSD(v)}/><Bar dataKey="pnl" radius={[6,6,0,0]}>{holdings.map((h,i)=>{const p=quotes[h.ticker]?.price||0;return <Cell key={i} fill={(h.total_shares*p-h.total_invested)>=0?C.green:C.red}/>})}</Bar></BarChart></ResponsiveContainer>:<div style={{textAlign:"center",padding:40,color:C.textDim}}>Sin datos</div>}</div>
        </div>}
      </div>

      <AddAssetModal open={showAddAsset} onClose={()=>setShowAddAsset(false)} onSaved={loadData}/>
      <AddTxModal open={showAddTx} onClose={()=>setShowAddTx(false)} onSaved={loadData} assets={assets}/>
    </div>
  );
}
