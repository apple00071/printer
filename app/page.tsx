"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type Stage = "upload" | "settings" | "payment" | "printing" | "done";

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

function getPdfPageCount(file: File): Promise<number> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const matches = text.match(/\/Count\s+(\d+)/g);
      if (matches) {
        let maxPages = 1;
        for (const match of matches) {
          const num = parseInt(match.match(/\d+/)![0], 10);
          if (num > maxPages && num < 10000) {
            maxPages = num;
          }
        }
        resolve(maxPages);
        return;
      }
      resolve(1);
    };
    reader.onerror = () => resolve(1);
    reader.readAsText(file);
  });
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [color, setColor] = useState<"bw" | "color">("bw");
  const [sides, setSides] = useState<"single" | "double">("single");
  const [copies, setCopies] = useState(1);
  const [pages, setPages] = useState(4);
  const [range, setRange] = useState("All pages");
  const [generatedJobId, setGeneratedJobId] = useState("");
  const [kioskId, setKioskId] = useState("KSK-001");
  const [kioskName, setKioskName] = useState("HP LaserJet Pro");
  const [kioskLocation, setKioskLocation] = useState("Kavali");
  const [uploadUrl, setUploadUrl] = useState("https://kiosk.scanprint.in/?kioskId=KSK-001");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("kioskId");
    const activeId = idParam ? idParam.toUpperCase() : "KSK-001";
    
    setKioskId(activeId);
    setUploadUrl(window.location.origin + "/?kioskId=" + activeId);

    // Fetch details for this kiosk dynamically from Supabase
    supabase
      .from("kiosks")
      .select("name, location")
      .eq("id", activeId)
      .single()
      .then(({ data }) => {
        if (data) {
          setKioskName(data.name);
          setKioskLocation(data.location);
        }
      });
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  const price = useMemo(() => pages * copies * (color === "color" ? 10 : 2), [pages, copies, color]);

  async function selectFile(next?: File) {
    if (!next) return;
    if (next.type !== "application/pdf" && !next.name.toLowerCase().endsWith(".pdf")) return alert("Please choose a PDF file.");
    if (next.size > 20 * 1024 * 1024) return alert("The maximum file size is 20 MB.");
    
    const pageCount = await getPdfPageCount(next);
    setPages(pageCount);
    setFile(next);
    setStage("settings");
  }
  
  function reset() { setStage("upload"); setFile(null); setColor("bw"); setCopies(1); setPages(4); setRange("All pages"); }

  async function pay() {
    if (!file) return;
    setStage("printing");
    const jobId = `SP-${Math.floor(1000 + Math.random() * 9000)}`;
    setGeneratedJobId(jobId);

    try {
      // 1. Upload file to Supabase Storage bucket 'kiosk-documents'
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.floor(Date.now() / 1000)}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
      const filePath = `staging/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from("kiosk-documents")
        .upload(filePath, file);

      if (uploadError) {
        console.warn("Storage upload warning (Check if 'kiosk-documents' bucket exists):", uploadError.message);
      }
      
      const newJob = {
        id: jobId,
        file: filePath, // Storing the staged storage file path key in DB
        amount: price,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        color,
        sides,
        copies,
        pages,
        range,
        kioskId: kioskId
      };

      // 2. Create print job entry in backend database
      await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newJob)
      });

      // 3. Simulate UPI confirmation delay, releasing print job
      setTimeout(async () => {
        await fetch("/api/jobs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: jobId, status: "Paid" })
        });
        
        setStage("done");
      }, 2300);
    } catch (err) {
      console.error("Payment flow failed:", err);
      setStage("done");
    }
  }

  return <main>
    <header><Brand /><StatusPills /></header>

    <section className="customer-shell">
      <div className="hero"><span className="eyebrow">KIOSK {kioskLocation.toUpperCase()} · {kioskId}</span><h1>Upload. Pay. Print.</h1><p>Your documents, printed in minutes.</p></div>
      <div className="flow-card">
        {stage === "upload" && <>
          <div className="card-heading"><div><h2>Upload your document</h2><p>We automatically delete your file after printing.</p></div></div>
          <div className={`dropzone ${dragging ? "dragging" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); selectFile(e.dataTransfer.files[0]); }}>
            <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={e => selectFile(e.target.files?.[0])} />
            <div className="pdf-icon"><span>PDF</span></div><h3>Drag & drop your PDF here</h3><p>or</p><button className="primary">Choose a file</button><small>PDF only · Up to 20 MB</small>
          </div>
          
          <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", gap: "20px", color: "var(--navy)" }}>
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(uploadUrl)}`} 
              alt="Scan to Upload QR"
              style={{ width: "90px", height: "90px", border: "1px solid var(--border)", borderRadius: "8px", padding: "6px", background: "#fff" }}
            />
            <div style={{ textAlign: "left" }}>
              <h4 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 800 }}>Print from your phone</h4>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--text)" }}>Scan this QR code to upload your PDF directly from your mobile storage.</p>
            </div>
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
        {stage === "done" && <div className="result-view"><div className="success">✓</div><h2>Your print is ready</h2><p>Please collect all pages from the output tray.</p><div className="receipt"><span>Job ID</span><b>{generatedJobId}</b><span>Amount paid</span><b>₹{price}</b><span>File deleted</span><b className="green">Yes ✓</b></div><button className="primary" onClick={reset}>Print another document</button></div>}
        <Steps stage={stage} />
      </div>
      <div className="trust-row"><span>🔒 Secure payment</span><span>🗑 Files auto-deleted</span><span>☎ Need help? 830 903 1203</span></div>
    </section>
  </main>;
}
