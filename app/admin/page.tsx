"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

function Brand() {
  return <div className="brand"><span className="brand-icon">▤</span><span>ScanPrint</span></div>;
}

export default function AdminPage() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(true);

  const [kiosks, setKiosks] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedKioskId, setSelectedKioskId] = useState("KSK-001");
  const [showAddKiosk, setShowAddKiosk] = useState(false);
  const [showPrinterControls, setShowPrinterControls] = useState(false);
  const [activeTab, setActiveTab] = useState<"jobs" | "kiosks">("jobs");
  const [origin, setOrigin] = useState("https://kiosk.scanprint.in");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Form states for Add Kiosk
  const [newKioskId, setNewKioskId] = useState("");
  const [newKioskName, setNewKioskName] = useState("HP LaserJet Pro");
  const [newKioskLocation, setNewKioskLocation] = useState("Hyderabad");
  const [newKioskPaper, setNewKioskPaper] = useState(100);
  const [newKioskToner, setNewKioskToner] = useState(100);
  const [newKioskStatus, setNewKioskStatus] = useState("Online");
  const [newKioskIp, setNewKioskIp] = useState("");

  // 1. Manage auth state on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshData = async () => {
    try {
      const resKiosks = await fetch("/api/kiosks");
      const dataKiosks = await resKiosks.json();
      if (dataKiosks.kiosks) setKiosks(dataKiosks.kiosks);

      const resJobs = await fetch("/api/jobs");
      const dataJobs = await resJobs.json();
      if (dataJobs.jobs) setJobs(dataJobs.jobs);
    } catch (err) {
      console.error("Error refreshing database info:", err);
    }
  };

  // 2. Fetch kiosks/jobs only when authenticated
  useEffect(() => {
    if (session) {
      refreshData();
      const interval = setInterval(refreshData, 5000);
      return () => clearInterval(interval);
    }
  }, [session]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return alert("Enter both email and password.");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(`Login failed: ${error.message}`);
  };

  const handleRegister = async () => {
    if (!email || !password) return alert("Enter both email and password.");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      alert(`Registration failed: ${error.message}`);
    } else {
      alert("Sign-up request sent! Check your email verification link if email verification is enabled, or sign in directly if disabled.");
    }
  };

  const paidJobs = jobs.filter(j => j.status === "Paid" || j.status === "Printed");
  const dynamicRevenue = paidJobs.reduce((n, j) => n + j.amount, 0);
  const totalJobsCount = jobs.length;
  const completedJobsCount = jobs.filter(j => j.status === "Printed").length;
  const completionPercent = totalJobsCount > 0 ? Math.round((completedJobsCount / totalJobsCount) * 100) : 100;
  const totalPagesPrinted = paidJobs.reduce((n, j) => n + (j.pages * j.copies), 0);
  const colorPages = paidJobs.filter(j => j.color === "color").reduce((n, j) => n + (j.pages * j.copies), 0);
  const bwPages = totalPagesPrinted - colorPages;

  const activeKiosk = kiosks.find(k => k.id === selectedKioskId) || kiosks[0] || {
    id: "KSK-001", name: "HP LaserJet Pro", location: "Kavali", status: "Online", paper: 68, toner: 74, ip: "192.168.1.101"
  };

  useEffect(() => {
    if (showAddKiosk) {
      const nextNum = kiosks.length + 1;
      const idStr = `KSK-${String(nextNum).padStart(3, "0")}`;
      setNewKioskId(idStr);
      setNewKioskIp(`192.168.1.${100 + nextNum}`);
    }
  }, [showAddKiosk, kiosks.length]);

  const handleAddKiosk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKioskId.trim() || !newKioskName.trim() || !newKioskLocation.trim() || !newKioskIp.trim()) {
      alert("Please fill in all fields.");
      return;
    }
    if (kiosks.some(k => k.id.toLowerCase() === newKioskId.trim().toLowerCase())) {
      alert("Kiosk ID already exists.");
      return;
    }
    const newKiosk = {
      id: newKioskId.trim().toUpperCase(),
      name: newKioskName.trim(),
      location: newKioskLocation.trim(),
      status: newKioskStatus,
      paper: Number(newKioskPaper) || 0,
      toner: Number(newKioskToner) || 0,
      ip: newKioskIp.trim()
    };
    
    try {
      await fetch("/api/kiosks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newKiosk)
      });
      await refreshData();
      setSelectedKioskId(newKiosk.id);
      setShowAddKiosk(false);
      // Reset defaults
      setNewKioskName("HP LaserJet Pro");
      setNewKioskLocation("Hyderabad");
      setNewKioskPaper(100);
      setNewKioskToner(100);
      setNewKioskStatus("Online");
    } catch (err) {
      console.error("Failed to add kiosk:", err);
    }
  };

  const handleUpdateKioskStatus = async (status: string) => {
    try {
      await fetch("/api/kiosks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...activeKiosk, status })
      });
      await refreshData();
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleRefillPaper = async () => {
    try {
      await fetch("/api/kiosks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...activeKiosk, paper: 100 })
      });
      await refreshData();
    } catch (err) {
      console.error("Failed to refill paper:", err);
    }
  };

  const handleRefillToner = async () => {
    try {
      await fetch("/api/kiosks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...activeKiosk, toner: 100 })
      });
      await refreshData();
    } catch (err) {
      console.error("Failed to refill toner:", err);
    }
  };

  const handleUpdateActiveDetails = async (name: string, location: string, ip: string) => {
    try {
      setKiosks(prev => prev.map(k => k.id === activeKiosk.id ? { ...k, name, location, ip } : k));
      await fetch("/api/kiosks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...activeKiosk, name, location, ip })
      });
    } catch (err) {
      console.error("Failed to update details:", err);
    }
  };

  const handleToggleStatusFromList = async (k: any) => {
    const nextStatus = k.status === "Online" ? "Offline" : "Online";
    try {
      await fetch("/api/kiosks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...k, status: nextStatus })
      });
      await refreshData();
    } catch (err) {
      console.error("Failed to toggle status:", err);
    }
  };

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(7, 27, 68, 0.4)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
    color: "var(--navy)"
  };

  const modalStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: "20px",
    boxShadow: "0 22px 55px rgba(22, 55, 102, 0.15)",
    width: "100%",
    maxWidth: "450px",
    padding: "30px",
    position: "relative"
  };

  if (authLoading) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ fontSize: "18px", color: "var(--text)", fontWeight: "bold" }}>Verifying Authorization Session...</div>
      </main>
    );
  }

  // Render Login wall if not signed in
  if (!session) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 50% 15%,#fff 0,transparent 34%),linear-gradient(180deg,#fbfdff,var(--bg))", padding: "20px" }}>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "24px", padding: "40px", width: "100%", maxWidth: "420px", boxShadow: "0 22px 55px rgba(22, 55, 102, 0.1)" }}>
          <div style={{ textAlign: "center", marginBottom: "30px" }}>
            <Brand />
            <h2 style={{ fontSize: "24px", fontWeight: 800, margin: "16px 0 6px", color: "var(--navy)" }}>Admin Portal</h2>
            <p style={{ margin: 0, color: "var(--text)", fontSize: "14px" }}>Sign in to manage printer telemetry</p>
          </div>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "6px", color: "var(--navy)" }}>Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@scanprint.in"
                style={{ width: "100%", padding: "12px", border: "1px solid var(--border)", borderRadius: "10px", background: "#fff", color: "var(--navy)", fontSize: "14px" }}
                required
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "6px", color: "var(--navy)" }}>Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: "100%", padding: "12px", border: "1px solid var(--border)", borderRadius: "10px", background: "#fff", color: "var(--navy)", fontSize: "14px" }}
                required
              />
            </div>
            <button type="submit" className="primary wide" style={{ marginTop: "8px", padding: "14px" }}>
              Sign In
            </button>
            <div style={{ textAlign: "center", marginTop: "10px" }}>
              <button 
                type="button"
                onClick={handleRegister}
                style={{ border: "none", background: "none", color: "var(--blue)", fontWeight: 700, cursor: "pointer", fontSize: "13px" }}
              >
                Create New Admin Account
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main>
      <header>
        <Brand />
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ padding: "10px 16px", borderRadius: "10px", background: "#ebf7ef", fontWeight: 700, fontSize: "14px", color: "var(--green)" }}>
            🔒 Admin: {session.user.email}
          </div>
          <button 
            onClick={() => supabase.auth.signOut()} 
            style={{ 
              border: "1px solid var(--border)", 
              background: "#fff", 
              padding: "10px 16px", 
              borderRadius: "10px", 
              fontWeight: 700, 
              color: "var(--red)", 
              cursor: "pointer",
              fontSize: "14px" 
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      <section className="admin-shell">
        <div className="admin-title">
          <div>
            <span className="eyebrow">LIVE OPERATIONS</span>
            <h1>Kiosk dashboard</h1>
            <p>Monitor printing, payments and machine health.</p>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <select
              value={selectedKioskId}
              onChange={(e) => setSelectedKioskId(e.target.value)}
              style={{
                padding: "9px 14px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                fontWeight: 700,
                background: "#fff",
                color: "var(--navy)",
                cursor: "pointer"
              }}
            >
              {kiosks.map(k => (
                <option key={k.id} value={k.id}>{k.id} - {k.name} ({k.location})</option>
              ))}
            </select>
            <button className="primary" onClick={() => setShowAddKiosk(true)}>+ Add kiosk</button>
          </div>
        </div>

        <div className="metrics">
          <article>
            <span>Today’s revenue</span>
            <strong>₹{dynamicRevenue}</strong>
            <small className="green">Based on live payments</small>
          </article>
          <article>
            <span>Print jobs</span>
            <strong>{totalJobsCount}</strong>
            <small>{completionPercent}% completed</small>
          </article>
          <article>
            <span>Pages printed</span>
            <strong>{totalPagesPrinted}</strong>
            <small>{colorPages} colour · {bwPages} B&W</small>
          </article>
          <article>
            <span>Kiosk health</span>
            <strong className={activeKiosk.status === "Online" ? "green" : "red"}>{activeKiosk.status}</strong>
            <small>A4 paper: {activeKiosk.paper}% · Toner: {activeKiosk.toner}%</small>
          </article>
        </div>

        <div className="admin-grid">
          <article className="panel jobs">
            <div className="panel-head" style={{ borderBottom: "1px solid #edf1f6", paddingBottom: "12px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "20px" }}>
                <button 
                  onClick={() => setActiveTab("jobs")}
                  style={{ 
                    background: "none", 
                    border: "none", 
                    fontSize: "18px", 
                    fontWeight: activeTab === "jobs" ? 800 : 550, 
                    color: activeTab === "jobs" ? "var(--navy)" : "var(--text)",
                    borderBottom: activeTab === "jobs" ? "3px solid var(--blue)" : "none",
                    paddingBottom: "8px",
                    cursor: "pointer",
                    paddingLeft: 0,
                    paddingRight: 0
                  }}
                >
                  Recent Jobs
                </button>
                <button 
                  onClick={() => setActiveTab("kiosks")}
                  style={{ 
                    background: "none", 
                    border: "none", 
                    fontSize: "18px", 
                    fontWeight: activeTab === "kiosks" ? 800 : 550, 
                    color: activeTab === "kiosks" ? "var(--navy)" : "var(--text)",
                    borderBottom: activeTab === "kiosks" ? "3px solid var(--blue)" : "none",
                    paddingBottom: "8px",
                    cursor: "pointer",
                    paddingLeft: 0,
                    paddingRight: 0
                  }}
                >
                  All Kiosks ({kiosks.length})
                </button>
              </div>
              <span style={{ fontSize: "12px", color: "var(--text)" }}>● Live update</span>
            </div>

            {activeTab === "jobs" ? (
              <>
                <div className="job-head">
                  <span>Job</span>
                  <span>Document</span>
                  <span>Amount</span>
                  <span>Status</span>
                </div>
                {jobs.map(j => (
                  <div className="job" key={j.id}>
                    <span>
                      <b>{j.id}</b>
                      <small>{j.time}</small>
                    </span>
                    <span className="file-cell">▤ {j.file}</span>
                    <b>₹{j.amount}</b>
                    <em className={`badge ${j.status.toLowerCase()}`}>{j.status}</em>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2.2fr 1.2fr 1.2fr 1fr 1.2fr", gap: "10px", fontSize: "11px", letterSpacing: ".08em", textTransform: "uppercase", color: "#7d8ba0", padding: "10px 12px", background: "#f5f8fc", borderRadius: "8px", fontWeight: 700 }}>
                  <span>Kiosk ID</span>
                  <span>Printer / IP</span>
                  <span>Location</span>
                  <span>Health</span>
                  <span>Status</span>
                  <span style={{ textAlign: "right" }}>Actions</span>
                </div>
                {kiosks.map(k => (
                  <div key={k.id} style={{ display: "grid", gridTemplateColumns: "1fr 2.2fr 1.2fr 1.2fr 1fr 1.2fr", gap: "10px", alignItems: "center", padding: "12px", borderBottom: "1px solid #edf1f6", fontSize: "14px" }}>
                    <b>{k.id}</b>
                    <span>
                      <div style={{ fontWeight: 650 }}>{k.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--text)" }}>🔗 {k.ip}</div>
                    </span>
                    <span>{k.location}</span>
                    <span style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span>📄 P: {k.paper}%</span>
                      <span>💧 T: {k.toner}%</span>
                    </span>
                    <span>
                      <em 
                        className={`badge ${k.status === "Online" ? "online" : "printing"}`} 
                        style={{ 
                          backgroundColor: k.status === "Online" ? "#ebf7ef" : "#ffebee", 
                          color: k.status === "Online" ? "var(--green)" : "var(--red)",
                          fontStyle: "normal"
                        }}
                      >
                        {k.status}
                      </em>
                    </span>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      <button 
                        className="secondary" 
                        style={{ padding: "6px 10px", fontSize: "12px", fontWeight: 700 }}
                        onClick={() => handleToggleStatusFromList(k)}
                      >
                        {k.status === "Online" ? "Offline" : "Online"}
                      </button>
                      <button 
                        className="secondary" 
                        style={{ padding: "6px 10px", fontSize: "12px", display: "grid", placeItems: "center" }}
                        onClick={() => {
                          setSelectedKioskId(k.id);
                          setShowPrinterControls(true);
                        }}
                      >
                        ⚙️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          <aside className="panel health">
            <div className="panel-head">
              <div>
                <h2>Printer status</h2>
                <p>{activeKiosk.name} · {activeKiosk.id}</p>
              </div>
              <i 
                className="online-dot" 
                style={{ 
                  backgroundColor: activeKiosk.status === "Online" ? "var(--green)" : "var(--red)", 
                  boxShadow: activeKiosk.status === "Online" ? "0 0 0 5px #10a63814" : "0 0 0 5px #e83d4d14" 
                }} 
              />
            </div>
            <div className="meter-label">
              <span>A4 paper</span>
              <b>{activeKiosk.paper}%</b>
            </div>
            <div className="meter">
              <i style={{ width: `${activeKiosk.paper}%`, backgroundColor: activeKiosk.paper < 20 ? "var(--red)" : "var(--blue)" }} />
            </div>
            <div className="meter-label">
              <span>Black toner</span>
              <b>{activeKiosk.toner}%</b>
            </div>
            <div className="meter">
              <i style={{ width: `${activeKiosk.toner}%`, backgroundColor: activeKiosk.toner < 20 ? "var(--red)" : "var(--blue)" }} />
            </div>
            <div className="health-info">
              <span>Connection</span>
              <b className={activeKiosk.status === "Online" ? "green" : "red"}>● {activeKiosk.status}</b>
              <span>Location</span>
              <b>{activeKiosk.location}</b>
              <span>IP Address</span>
              <b>{activeKiosk.ip}</b>
            </div>
            
            <div style={{ marginTop: "20px", borderTop: "1px solid #edf1f6", paddingTop: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "11px", color: "var(--text)", fontWeight: 700, letterSpacing: ".05em" }}>SCAN-TO-UPLOAD QR CODE</span>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(origin + "/?kioskId=" + activeKiosk.id)}`} 
                alt="Kiosk QR"
                style={{ width: "120px", height: "120px", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px", background: "#fff" }}
              />
              <span style={{ fontSize: "11px", color: "var(--text)" }}>Kiosk ID: <strong>{activeKiosk.id}</strong></span>
            </div>

            <button className="secondary wide" onClick={() => setShowPrinterControls(true)} style={{ marginTop: "16px" }}>Open printer controls</button>
          </aside>
        </div>

        {/* Add Kiosk Modal */}
        {showAddKiosk && (
          <div style={overlayStyle}>
            <div style={modalStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800 }}>Add New Kiosk</h2>
                <button 
                  onClick={() => setShowAddKiosk(false)} 
                  style={{ border: 0, background: "none", fontSize: "20px", color: "var(--text)", cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleAddKiosk} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "6px" }}>Kiosk ID</label>
                  <input 
                    type="text" 
                    value={newKioskId} 
                    onChange={(e) => setNewKioskId(e.target.value)} 
                    placeholder="e.g. KSK-002"
                    style={{ width: "100%", padding: "10px", border: "1px solid var(--border)", borderRadius: "8px", background: "#fff", color: "var(--navy)" }} 
                    required 
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "6px" }}>Printer Model Name</label>
                  <input 
                    type="text" 
                    value={newKioskName} 
                    onChange={(e) => setNewKioskName(e.target.value)} 
                    placeholder="e.g. HP LaserJet Pro"
                    style={{ width: "100%", padding: "10px", border: "1px solid var(--border)", borderRadius: "8px", background: "#fff", color: "var(--navy)" }} 
                    required 
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "6px" }}>IP Address</label>
                  <input 
                    type="text" 
                    value={newKioskIp} 
                    onChange={(e) => setNewKioskIp(e.target.value)} 
                    placeholder="e.g. 192.168.1.102"
                    style={{ width: "100%", padding: "10px", border: "1px solid var(--border)", borderRadius: "8px", background: "#fff", color: "var(--navy)" }} 
                    required 
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "6px" }}>Location</label>
                  <input 
                    type="text" 
                    value={newKioskLocation} 
                    onChange={(e) => setNewKioskLocation(e.target.value)} 
                    placeholder="e.g. Hyderabad"
                    style={{ width: "100%", padding: "10px", border: "1px solid var(--border)", borderRadius: "8px", background: "#fff", color: "var(--navy)" }} 
                    required 
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "6px" }}>A4 Paper %</label>
                    <input 
                      type="number" 
                      min="0" 
                      max="100" 
                      value={newKioskPaper} 
                      onChange={(e) => setNewKioskPaper(Number(e.target.value))} 
                      style={{ width: "100%", padding: "10px", border: "1px solid var(--border)", borderRadius: "8px", background: "#fff", color: "var(--navy)" }} 
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "6px" }}>Toner %</label>
                    <input 
                      type="number" 
                      min="0" 
                      max="100" 
                      value={newKioskToner} 
                      onChange={(e) => setNewKioskToner(Number(e.target.value))} 
                      style={{ width: "100%", padding: "10px", border: "1px solid var(--border)", borderRadius: "8px", background: "#fff", color: "var(--navy)" }} 
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "6px" }}>Initial Status</label>
                  <select 
                    value={newKioskStatus} 
                    onChange={(e) => setNewKioskStatus(e.target.value)}
                    style={{ width: "100%", padding: "10px", border: "1px solid var(--border)", borderRadius: "8px", background: "#fff", color: "var(--navy)" }}
                  >
                    <option value="Online">Online</option>
                    <option value="Offline">Offline</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: "12px", marginTop: "10px" }}>
                  <button 
                    type="button" 
                    className="secondary" 
                    onClick={() => setShowAddKiosk(false)} 
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="primary" 
                    style={{ flex: 1 }}
                  >
                    Add Kiosk
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Printer Controls Modal */}
        {showPrinterControls && (
          <div style={overlayStyle}>
            <div style={modalStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800 }}>Printer Controls</h2>
                <button 
                  onClick={() => setShowPrinterControls(false)} 
                  style={{ border: 0, background: "none", fontSize: "20px", color: "var(--text)", cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>
              <p style={{ fontSize: "14px", color: "var(--text)", marginBottom: "20px" }}>
                Managing Kiosk ID: <strong>{activeKiosk.id}</strong>
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "6px" }}>Printer Model Name</label>
                  <input 
                    type="text" 
                    value={activeKiosk.name} 
                    onChange={(e) => handleUpdateActiveDetails(e.target.value, activeKiosk.location, activeKiosk.ip)} 
                    style={{ width: "100%", padding: "10px", border: "1px solid var(--border)", borderRadius: "8px", background: "#fff", color: "var(--navy)" }} 
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "6px" }}>IP Address</label>
                  <input 
                    type="text" 
                    value={activeKiosk.ip} 
                    onChange={(e) => handleUpdateActiveDetails(activeKiosk.name, activeKiosk.location, e.target.value)} 
                    style={{ width: "100%", padding: "10px", border: "1px solid var(--border)", borderRadius: "8px", background: "#fff", color: "var(--navy)" }} 
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "6px" }}>Location</label>
                  <input 
                    type="text" 
                    value={activeKiosk.location} 
                    onChange={(e) => handleUpdateActiveDetails(activeKiosk.name, e.target.value, activeKiosk.ip)} 
                    style={{ width: "100%", padding: "10px", border: "1px solid var(--border)", borderRadius: "8px", background: "#fff", color: "var(--navy)" }} 
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "6px" }}>Connection Status</label>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button 
                      className={`secondary ${activeKiosk.status === "Online" ? "selected" : ""}`} 
                      onClick={() => handleUpdateKioskStatus("Online")}
                      style={{ flex: 1 }}
                    >
                      Online
                    </button>
                    <button 
                      className={`secondary ${activeKiosk.status === "Offline" ? "selected" : ""}`} 
                      onClick={() => handleUpdateKioskStatus("Offline")}
                      style={{ flex: 1 }}
                    >
                      Offline
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                  <button 
                    className="secondary" 
                    onClick={handleRefillPaper}
                    style={{ flex: 1, display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  >
                    📄 Refill Paper (100%)
                  </button>
                  <button 
                    className="secondary" 
                    onClick={handleRefillToner}
                    style={{ flex: 1, display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  >
                    💧 Refill Toner (100%)
                  </button>
                </div>
                <button 
                  className="primary wide" 
                  onClick={() => setShowPrinterControls(false)}
                  style={{ marginTop: "12px" }}
                >
                  Close Controls
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
