"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const PabloApp = dynamic(() => import("./PabloApp"), { ssr: false });

const C = {
  bg:"#0a0a0f",card:"#12121a",border:"#1e1e2e",accent:"#c8a54e",
  accentGlow:"rgba(200,165,78,0.15)",text:"#e8e6e0",textDim:"#8a8a9a",white:"#fff",red:"#ef4444",
};

const SUPABASE_URL = "https://aksbdksccqlipjpygvvw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrc2Jka3NjY3FsaXBqcHlndnZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNDE3NDAsImV4cCI6MjA5MzkxNzc0MH0.zMQLpefdlvzoxufi30Ppfb7cFDiPc728USGcCvCuwzU";

export default function Page() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("pablo_user") : null;
    if (saved) try { setUser(JSON.parse(saved)); } catch {}
  }, []);

  const login = async () => {
    if (!username || !password) return;
    setLoading(true); setError("");
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_users?username=eq.${username}&password_hash=eq.${encodeURIComponent(password)}&limit=1`, {
        headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
      });
      const data = await r.json();
      if (data && data.length > 0) {
        const u = { id: data[0].id, username: data[0].username, name: data[0].display_name, role: data[0].role };
        setUser(u);
        localStorage.setItem("pablo_user", JSON.stringify(u));
        // Update last login
        fetch(`${SUPABASE_URL}/rest/v1/app_users?id=eq.${data[0].id}`, {
          method: "PATCH",
          headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ last_login: new Date().toISOString() })
        });
      } else {
        setError("Usuario o contraseña incorrectos");
      }
    } catch (e) { setError("Error de conexión"); }
    setLoading(false);
  };

  const logout = () => { setUser(null); localStorage.removeItem("pablo_user"); };

  if (user) return <PabloApp user={user} onLogout={logout} />;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 40, width: "min(400px, 90vw)", textAlign: "center" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 32, fontFamily: "'Playfair Display',serif", color: C.white }}>
          <span style={{ color: C.accent }}>Pablo</span> Investment
        </h1>
        <p style={{ color: C.textDim, fontSize: 13, margin: "0 0 30px" }}>Portfolio Tracker & AI Research</p>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 11, color: C.textDim, marginBottom: 5, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, textAlign: "left" }}>Usuario</label>
          <input value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === "Enter" && login()}
            placeholder="Tu usuario"
            style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: C.white, fontSize: 15, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 11, color: C.textDim, marginBottom: 5, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, textAlign: "left" }}>Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && login()}
            placeholder="••••••••"
            style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: C.white, fontSize: 15, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }} />
        </div>

        {error && <div style={{ color: C.red, fontSize: 13, marginBottom: 14, fontWeight: 600 }}>{error}</div>}

        <button onClick={login} disabled={loading}
          style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: C.accent, color: C.bg, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.2s" }}>
          {loading ? "Entrando..." : "Iniciar sesión"}
        </button>

        <div style={{ marginTop: 24, fontSize: 10, color: C.textDim }}>
          Powered by Claude AI + Supabase
        </div>
      </div>
    </div>
  );
}
