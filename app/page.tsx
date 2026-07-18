"use client";

import { useMemo, useRef, useState } from "react";

type Stage = "upload" | "settings" | "payment" | "printing" | "done";
type JobStatus = "Printed" | "Printing" | "Paid";

const initialJobs: { id: string; file: string; amount: number; status: JobStatus; time: string }[] = [
  { id: "SP-1048", file: "hall-ticket.pdf", amount: 8, status: "Printed", time: "10:42 AM" },
  { id: "SP-1047", file: "resume.pdf", amount: 4, status: "Printed", time: "10:36 AM" },
  { id: "SP-1046", file: "project-report.pdf", amount: 22, status: "Paid", time: "10:31 AM" },
];

function Brand() {
  return <div className="brand"><span className="brand-icon">▤</span><span>ScanPrint</span></div>;
}

function StatusPills() {
  return <div className="status-pills"><span><i className="online-dot" />Online</span><span className="divider" /><span>▤ &nbsp;A4 ready</span></div>;
}

function Steps({ stage }: { stage: Stage }) {
  const current = stage === "upload" ? 1 : stage === "settings" ? 2 : 3;
  return <div className="steps">
    {["Upload", "Choose settings", "Pay & Print"].map((label, i) => <div className={`step ${current >= i + 1 ? "active" : ""}`} key={label}>
      <span className="step-circle">{current > i + 1 ? "✓" : i + 1}</span><b>{label}</b>{i < 2 && <span className="step-line" />}
    </div>)}
  </div>;
}

export default function Home() {
  const [view, setView] = useState<"customer" | "admin">("customer");
  const [stage, setStage] = useState<Stage>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [color, setColor] = useState<"bw" | "color">("bw");
  const [sides, setSides] = useState<"single" | "double">("single");
  const [copies, setCopies] = useState(1);
  const [pages, setPages] = useState(4);
  const [range, setRange] = useState("All pages");
  const [jobs, setJobs] = useState(initialJobs);
  const inputRef = useRef<HTMLInputElement>(null);
  const price = useMemo(() => pages * copies * (color === "color" ? 10 : 2), [pages, copies, color]);

  function selectFile(next?: File) {
    if (!next) return;
    if (next.type !== "application/pdf" && !next.name.toLowerCase().endsWith(".pdf")) return alert("Please choose a PDF file.");
    if (next.size > 20 * 1024 * 1024) return alert("The maximum file size is 20 MB.");
    setFile(next); setStage("settings");
  }
  function reset() { setStage("upload"); setFile(null); setColor("bw"); setCopies(1); setPages(4); setRange("All pages"); }
  function pay() {
    setStage("printing");
    setJobs(old => [{ id: `SP-${1049 + old.length}`, file: file?.name || "document.pdf", amount: price, status: "Printing", time: "Just now" }, ...old]);
    setTimeout(() => setStage("done"), 2300);
  }

  return <main>
    <header><Brand /><nav><button className={view === "customer" ? "nav-active" : ""} onClick={() => setView("customer")}>Customer kiosk</button><button className={view === "admin" ? "nav-active" : ""} onClick={() => setView("admin")}>Admin</button></nav><StatusPills /></header>

    {view === "admin" ? <Admin jobs={jobs} /> : <section className="customer-shell">
      <div className="hero"><span className="eyebrow">KIOSK KAVALI · KSK-001</span><h1>Upload. Pay. Print.</h1><p>Your documents, printed in minutes.</p></div>
      <div className="flow-card">
        {stage === "upload" && <>
          <div className="card-heading"><div><h2>Upload your document</h2><p>We automatically delete your file after printing.</p></div></div>
          <div className={`dropzone ${dragging ? "dragging" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); selectFile(e.dataTransfer.files[0]); }}>
            <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={e => selectFile(e.target.files?.[0])} />
            <div className="pdf-icon"><span>PDF</span></div><h3>Drag & drop your PDF here</h3><p>or</p><button className="primary">Choose a file</button><small>PDF only · Up to 20 MB</small>
          </div>
        </>}
        {stage === "settings" && <>
          <div className="card-heading"><button className="back" onClick={reset}>←</button><div><h2>Choose print settings</h2><p>{file?.name} · {(file?.size || 0) / 1024 / 1024 < 0.1 ? "0.1" : ((file?.size || 0) / 1024 / 1024).toFixed(1)} MB</p></div></div>
          <div className="settings-grid">
            <label>Number of pages<input type="number" min="1" max="100" value={pages} onChange={e => setPages(Math.max(1, Number(e.target.value)))} /></label>
            <label>Page range<select value={range} onChange={e => setRange(e.target.value)}><option>All pages</option><option>Custom range</option><option>Odd pages only</option><option>Even pages only</option></select></label>
            <fieldset><legend>Print colour</legend><button className={color === "bw" ? "selected" : ""} onClick={() => setColor("bw")}><b>Black & white</b><small>₹2 / page</small></button><button className={color === "color" ? "selected" : ""} onClick={() => setColor("color")}><b>Colour</b><small>₹10 / page</small></button></fieldset>
            <fieldset><legend>Print sides</legend><button className={sides === "single" ? "selected" : ""} onClick={() => setSides("single")}><b>Single-sided</b><small>One side per sheet</small></button><button className={sides === "double" ? "selected" : ""} onClick={() => setSides("double")}><b>Double-sided</b><small>Save paper</small></button></fieldset>
            <label>Copies<div className="counter"><button onClick={() => setCopies(Math.max(1, copies - 1))}>−</button><b>{copies}</b><button onClick={() => setCopies(copies + 1)}>+</button></div></label>
          </div>
          <div className="summary-bar"><div><span>Total</span><strong>₹{price}</strong><small>{pages} pages × {copies} {copies === 1 ? "copy" : "copies"}</small></div><button className="primary" onClick={() => setStage("payment")}>Continue to payment →</button></div>
        </>}
        {stage === "payment" && <div className="payment-view"><button className="back floating" onClick={() => setStage("settings")}>←</button><div className="secure-icon">✓</div><h2>Pay ₹{price} to print</h2><p>Scan with any UPI app or use the demo payment below.</p><div className="qr-demo"><div className="qr-grid">{Array.from({length: 49}).map((_,i)=><i key={i} className={(i*7+i*3+11)%5<2 ? "dark" : ""}/>)}</div><span>SCAN & PAY</span></div><div className="upi-row"><span>G Pay</span><span>PhonePe</span><span>paytm</span><span>BHIM</span></div><button className="primary wide" onClick={pay}>Simulate successful UPI payment</button><small className="secure-note">🔒 Payment is verified securely before printing</small></div>}
        {stage === "printing" && <div className="result-view"><div className="printer-animation"><span>▤</span><i /></div><h2>Payment received!</h2><p>Your document is being printed now.</p><div className="progress"><i /></div><small>Please wait near the printer</small></div>}
        {stage === "done" && <div className="result-view"><div className="success">✓</div><h2>Your print is ready</h2><p>Please collect all pages from the output tray.</p><div className="receipt"><span>Job ID</span><b>SP-{1048 + jobs.length}</b><span>Amount paid</span><b>₹{price}</b><span>File deleted</span><b className="green">Yes ✓</b></div><button className="primary" onClick={reset}>Print another document</button></div>}
        <Steps stage={stage} />
      </div>
      <div className="trust-row"><span>🔒 Secure payment</span><span>🗑 Files auto-deleted</span><span>☎ Need help? 830 903 1203</span></div>
    </section>}
  </main>;
}

function Admin({ jobs }: { jobs: typeof initialJobs }) {
  const revenue = jobs.reduce((n, j) => n + j.amount, 0);
  return <section className="admin-shell"><div className="admin-title"><div><span className="eyebrow">LIVE OPERATIONS</span><h1>Kiosk dashboard</h1><p>Monitor printing, payments and machine health.</p></div><button className="primary">+ Add kiosk</button></div>
    <div className="metrics"><article><span>Today’s revenue</span><strong>₹{revenue + 1120}</strong><small className="green">↑ 12.4% from yesterday</small></article><article><span>Print jobs</span><strong>{jobs.length + 121}</strong><small>96% completed</small></article><article><span>Pages printed</span><strong>486</strong><small>72 colour · 414 B&W</small></article><article><span>Kiosk health</span><strong className="green">Online</strong><small>A4 paper: 68% · Toner: 74%</small></article></div>
    <div className="admin-grid"><article className="panel jobs"><div className="panel-head"><div><h2>Recent jobs</h2><p>Live queue from KSK-001</p></div><button>View all</button></div><div className="job-head"><span>Job</span><span>Document</span><span>Amount</span><span>Status</span></div>{jobs.map(j => <div className="job" key={j.id}><span><b>{j.id}</b><small>{j.time}</small></span><span className="file-cell">▤ {j.file}</span><b>₹{j.amount}</b><em className={`badge ${j.status.toLowerCase()}`}>{j.status}</em></div>)}</article>
      <aside className="panel health"><div className="panel-head"><div><h2>Printer status</h2><p>HP LaserJet Pro · KSK-001</p></div><i className="online-dot" /></div><div className="meter-label"><span>A4 paper</span><b>68%</b></div><div className="meter"><i style={{width:"68%"}} /></div><div className="meter-label"><span>Black toner</span><b>74%</b></div><div className="meter"><i style={{width:"74%"}} /></div><div className="health-info"><span>Connection</span><b className="green">● Online</b><span>Current queue</span><b>1 job</b><span>Last sync</span><b>Just now</b></div><button className="secondary wide">Open printer controls</button></aside></div>
  </section>;
}
