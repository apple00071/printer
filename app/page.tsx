"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { supabase } from "../lib/supabase";

type Stage = "upload" | "settings" | "printing" | "done";

function Brand() {
  return <div className="brand"><span className="brand-icon">▤</span><span>ScanPrint</span></div>;
}

function StatusPills() {
  return <div className="status-pills"><span><i className="online-dot" />Online</span><span className="divider" /><span>▤ &nbsp;A4 ready</span></div>;
}

function Steps({ stage }: { stage: Stage }) {
  const current = stage === "upload" ? 1 : stage === "settings" ? 2 : 3;
  return <div className="steps">
    {["Upload", "Choose settings", "Print"].map((label, i) => <div className={`step ${current >= i + 1 ? "active" : ""}`} key={label}>
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

function parseCustomRangeCount(rangeStr: string, maxPages: number): number {
  if (!rangeStr.trim()) return 1;
  const pages = new Set<number>();
  const parts = rangeStr.split(",");
  for (const part of parts) {
    const range = part.trim().split("-");
    if (range.length === 1) {
      const num = parseInt(range[0], 10);
      if (!isNaN(num) && num >= 1 && num <= maxPages) {
        pages.add(num);
      }
    } else if (range.length === 2) {
      const start = parseInt(range[0], 10);
      const end = parseInt(range[1], 10);
      if (!isNaN(start) && !isNaN(end) && start >= 1 && end <= maxPages && start <= end) {
        for (let i = start; i <= end; i++) {
          pages.add(i);
        }
      }
    }
  }
  return pages.size > 0 ? pages.size : 1;
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [color, setColor] = useState<"bw" | "color">("bw");
  const [sides, setSides] = useState<"single" | "double">("single");
  const [copies, setCopies] = useState(1);
  const [pdfPages, setPdfPages] = useState(1);
  const [customRange, setCustomRange] = useState("");
  const [range, setRange] = useState("All pages");
  const [generatedJobId, setGeneratedJobId] = useState("");
  const [kioskId, setKioskId] = useState("KSK-001");
  const [kioskName, setKioskName] = useState("HP LaserJet Pro");
  const [kioskLocation, setKioskLocation] = useState("Kavali");
  const [uploadUrl, setUploadUrl] = useState("https://kiosk.scanprint.in/?kioskId=KSK-001");
  const [isMobile, setIsMobile] = useState(false);
  const [bypassKiosk, setBypassKiosk] = useState(false);
  const [isKioskDevice, setIsKioskDevice] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("kioskId");
    const jobIdParam = params.get("jobId");
    const statusParam = params.get("status");
    const msgParam = params.get("msg");

    setIsKioskDevice(params.has("kioskId"));

    if (statusParam === "success" && jobIdParam) {
      setGeneratedJobId(jobIdParam);
      setStage("done");
    } else if (statusParam === "error") {
      alert(`Payment failed: ${msgParam || "Unknown error"}`);
    }

    // Fetch all kiosks to determine active kiosk dynamically
    supabase
      .from("kiosks")
      .select("*")
      .then(({ data: kiosksList }) => {
        let activeId = idParam ? idParam.toUpperCase() : "";
        
        // If kioskId not provided, select first available kiosk, fallback to KSK-001
        if (!activeId) {
          activeId = kiosksList && kiosksList.length > 0 ? kiosksList[0].id : "KSK-001";
        } else {
          // If target kioskId doesn't exist, fallback to first available
          const exists = kiosksList?.some(k => k.id === activeId);
          if (!exists && kiosksList && kiosksList.length > 0) {
            activeId = kiosksList[0].id;
          }
        }

        setKioskId(activeId);
        setUploadUrl(window.location.origin + "/?kioskId=" + activeId + "&view=mobile");

        // Update details based on active resolved kiosk
        const activeKiosk = kiosksList?.find(k => k.id === activeId);
        if (activeKiosk) {
          setKioskName(activeKiosk.name);
          setKioskLocation(activeKiosk.location);
        }
      });

    const checkMobile = () => {
      const isMobileView = params.get("view") === "mobile";
      setIsMobile(isMobileView);
    };

    checkMobile();
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  
  const printedPages = useMemo(() => {
    if (range === "All pages") {
      return pdfPages;
    } else if (range === "Odd pages only") {
      return Math.ceil(pdfPages / 2);
    } else if (range === "Even pages only") {
      return Math.floor(pdfPages / 2);
    } else if (range === "Custom range") {
      return parseCustomRangeCount(customRange, pdfPages);
    }
    return pdfPages;
  }, [range, pdfPages, customRange]);

  const price = useMemo(() => printedPages * copies * (color === "color" ? 10 : 2), [printedPages, copies, color]);

  async function selectFile(next?: File) {
    if (!next) return;
    const isPdf = next.type === "application/pdf" || next.name.toLowerCase().endsWith(".pdf");
    const isImage = next.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(next.name);

    if (!isPdf && !isImage) {
      return alert("Please choose a PDF or image file (JPG, PNG).");
    }
    if (next.size > 20 * 1024 * 1024) return alert("The maximum file size is 20 MB.");
    
    let pageCount = 1;
    if (isPdf) {
      pageCount = await getPdfPageCount(next);
    }
    
    setPdfPages(pageCount);
    setCustomRange(`1-${pageCount}`);
    setFile(next);
    setStage("settings");
  }
  
  function reset() { setStage("upload"); setFile(null); setColor("bw"); setCopies(1); setRange("All pages"); setPdfPages(1); setCustomRange(""); }

  async function printFile() {
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
        amount: 0, // Free print!
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        color,
        sides,
        copies,
        pages: printedPages,
        range: range === "Custom range" ? customRange : range,
        kioskId: kioskId
      };

      // 2. Create pending print job entry in database
      await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newJob)
      });

      // 3. Directly trigger print job release on backend
      const response = await fetch("/api/jobs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: jobId, status: "Paid" })
      });
      const data = await response.json();
      
      if (data.success) {
        setStage("done");
      } else {
        alert("Print release failed: " + (data.error || "Unknown error"));
        setStage("settings");
      }
    } catch (err) {
      console.error("Print flow failed:", err);
      alert("Error sending print job to printer.");
      setStage("settings");
    }
  }

  return <main>
    <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
    <header><Brand /><StatusPills /></header>

    <section className="customer-shell">
      <div className="hero"><span className="eyebrow">KIOSK {kioskLocation.toUpperCase()} · {kioskId}</span><h1>Upload. Pay. Print.</h1><p>Your documents, printed in minutes.</p></div>
      <div className="flow-card">
        {stage === "upload" && isKioskDevice && !isMobile && !bypassKiosk && (
          <div className="kiosk-welcome-view" style={{ textAlign: "center", padding: "30px 10px" }}>
            <h2 style={{ fontSize: "28px", color: "var(--navy)", margin: "0 0 8px", fontWeight: 800 }}>Scan QR to Print</h2>
            <p style={{ color: "var(--text)", fontSize: "15px", margin: "0 0 32px" }}>
              Scan this QR code with your mobile camera to upload documents or images directly.
            </p>
            
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "40px", flexWrap: "wrap", margin: "24px 0" }}>
              <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "16px", padding: "16px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)" }}>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uploadUrl)}`} 
                  alt="Scan to Upload QR"
                  style={{ width: "180px", height: "180px" }}
                />
              </div>
              
              <div style={{ textAlign: "left", maxWidth: "280px" }}>
                <h3 style={{ fontSize: "18px", color: "var(--navy)", margin: "0 0 16px", fontWeight: 700 }}>How it works:</h3>
                <ol style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "12px", color: "var(--text)", fontSize: "14px", lineHeight: "1.5" }}>
                  <li>Scan the QR code using your phone's camera.</li>
                  <li>Choose files from your mobile phone local storage.</li>
                  <li>Select print settings and press print!</li>
                </ol>
              </div>
            </div>

            <div style={{ marginTop: "40px", borderTop: "1px solid var(--border)", paddingTop: "20px" }}>
              <button 
                onClick={() => setBypassKiosk(true)}
                style={{ background: "none", border: "none", color: "var(--blue)", cursor: "pointer", fontSize: "13px", fontWeight: 600, textDecoration: "underline" }}
              >
                Or upload directly from this computer
              </button>
            </div>
          </div>
        )}

        {stage === "upload" && (!isKioskDevice || isMobile || bypassKiosk) && <>
          <div className="card-heading"><div><h2>Upload your document</h2><p>We automatically delete your file after printing.</p></div></div>
          <div className={`dropzone ${dragging ? "dragging" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); selectFile(e.dataTransfer.files[0]); }}>
            <input ref={inputRef} type="file" accept="application/pdf, image/*" hidden onChange={e => selectFile(e.target.files?.[0])} />
            <div className="pdf-icon" style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}><span>FILE</span></div><h3>Drag & drop PDF or Image here</h3><p>or</p><button className="primary">Choose a file</button><small>PDF, JPG, PNG, WEBP · Up to 20 MB</small>
          </div>
        </>}
        {stage === "settings" && <>
          <div className="card-heading"><button className="back" onClick={reset}>←</button><div><h2>Choose print settings</h2><p>{file?.name} · {(file?.size || 0) / 1024 / 1024 < 0.1 ? "0.1" : ((file?.size || 0) / 1024 / 1024).toFixed(1)} MB</p></div></div>
          <div className="settings-grid">
            <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: "8px", border: "1px dashed var(--border)", display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "12px", color: "var(--text)", fontWeight: 700 }}>Total print sheets</span>
              <strong style={{ fontSize: "18px", color: "var(--navy)", marginTop: "4px" }}>{printedPages} pages <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 400 }}>(out of {pdfPages})</span></strong>
            </div>
            <label>Page range<select value={range} onChange={e => setRange(e.target.value)}><option>All pages</option><option>Custom range</option><option>Odd pages only</option><option>Even pages only</option></select></label>
            
            {range === "Custom range" && (
              <label style={{ gridColumn: "span 2" }}>
                Enter page numbers (e.g., 1-3, 5)
                <input 
                  type="text" 
                  placeholder={`e.g. 1-${pdfPages}`} 
                  value={customRange} 
                  onChange={e => setCustomRange(e.target.value)}
                  style={{ marginTop: "6px" }}
                />
              </label>
            )}
            
            <fieldset><legend>Print colour</legend><button className={color === "bw" ? "selected" : ""} onClick={() => setColor("bw")}><b>Black & white</b><small>₹2 / page</small></button><button className={color === "color" ? "selected" : ""} onClick={() => setColor("color")}><b>Colour</b><small>₹10 / page</small></button></fieldset>
            <fieldset><legend>Print sides</legend><button className={sides === "single" ? "selected" : ""} onClick={() => setSides("single")}><b>Single-sided</b><small>One side per sheet</small></button><button className={sides === "double" ? "selected" : ""} onClick={() => setSides("double")}><b>Double-sided</b><small>Save paper</small></button></fieldset>
            <label>Copies<div className="counter"><button onClick={() => setCopies(Math.max(1, copies - 1))}>−</button><b>{copies}</b><button onClick={() => setCopies(copies + 1)}>+</button></div></label>
          </div>
          <div className="summary-bar"><div><span>Free Print</span><strong>₹0</strong><small>{printedPages} pages × {copies} {copies === 1 ? "copy" : "copies"}</small></div><button className="primary" onClick={printFile}>Print document →</button></div>
        </>}
        {stage === "printing" && <div className="result-view"><div className="printer-animation"><span>▤</span><i /></div><h2>Sending document...</h2><p>Your document is being printed now.</p><div className="progress"><i /></div><small>Please wait near the printer</small></div>}
        {stage === "done" && <div className="result-view"><div className="success">✓</div><h2>Your print is ready</h2><p>Please collect all pages from the output tray.</p><div className="receipt"><span>Job ID</span><b>{generatedJobId}</b><span>Amount paid</span><b>₹0</b><span>File deleted</span><b className="green">Yes ✓</b></div><button className="primary" onClick={reset}>Print another document</button></div>}
        <Steps stage={stage} />
      </div>
       <div className="trust-row"><span>🖨️ Local Direct Printing</span><span>🗑 Files auto-deleted</span><span>☎ Need help? 830 903 1203</span></div>
      <footer style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "center", gap: "16px", fontSize: "11px", color: "#64748b", flexWrap: "wrap" }}>
        <Link href="/privacy" style={{ color: "inherit", textDecoration: "none" }}>Privacy Policy</Link>
        <span>·</span>
        <Link href="/terms" style={{ color: "inherit", textDecoration: "none" }}>Terms & Conditions</Link>
        <span>·</span>
        <Link href="/refund" style={{ color: "inherit", textDecoration: "none" }}>Refund Policy</Link>
        <span>·</span>
        <Link href="/shipping" style={{ color: "inherit", textDecoration: "none" }}>Shipping & Delivery</Link>
        <span>·</span>
        <Link href="/contact" style={{ color: "inherit", textDecoration: "none" }}>Contact Us</Link>
      </footer>
     </section>
   </main>;
 }
