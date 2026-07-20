"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { supabase } from "../lib/supabase";

type Stage = "upload" | "settings" | "printing" | "done";

function Brand() {
  return <div className="brand"><span className="brand-icon">▤</span><span>ScanPrint</span></div>;
}

function StatusPills({ kioskId, status, paper }: { kioskId: string; status: string; paper: number }) {
  if (!kioskId) {
    return <div className="status-pills"><span><i className="online-dot" style={{ background: "#94a3b8", boxShadow: "0 0 0 5px #94a3b814" }} />No Kiosk</span><span className="divider" /><span>▤ &nbsp;Scan QR to connect</span></div>;
  }

  const isOnline = status?.toLowerCase() === "online";
  const dotColor = isOnline ? "var(--green)" : "var(--red)";
  const dotShadow = isOnline ? "#10a63814" : "#e83d4d14";
  
  let paperText = "A4 ready";
  if (paper === 0) {
    paperText = "Out of paper";
  } else if (paper < 10) {
    paperText = "Low paper";
  }

  return <div className="status-pills"><span><i className="online-dot" style={{ background: dotColor, boxShadow: `0 0 0 5px ${dotShadow}` }} />{status}</span><span className="divider" /><span>▤ &nbsp;{paperText}</span></div>;
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
  const [kioskId, setKioskId] = useState("");
  const [kioskName, setKioskName] = useState("HP LaserJet Pro");
  const [kioskLocation, setKioskLocation] = useState("Kavali");
  const [kioskStatus, setKioskStatus] = useState("Online");
  const [kioskPaper, setKioskPaper] = useState(100);
  const [uploadUrl, setUploadUrl] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [bypassKiosk, setBypassKiosk] = useState(false);
  const [isKioskDevice, setIsKioskDevice] = useState(false);
  const [started, setStarted] = useState(false);
  const [activeModal, setActiveModal] = useState<"scanner" | "kioskId" | "help" | null>(null);

  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  async function startScanner() {
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.play();
      }
      requestAnimationFrame(tick);
    } catch (err) {
      console.error("Camera access failed:", err);
      alert("Failed to access camera. Please grant camera permissions or type Kiosk ID manually.");
      setScanning(false);
    }
  }

  function stopScanner() {
    setScanning(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  useEffect(() => {
    if (activeModal === "scanner") {
      startScanner();
    } else {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
  }, [activeModal]);

  function tick() {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      if (streamRef.current) requestAnimationFrame(tick);
      return;
    }

    const canvas = canvasRef.current || document.createElement("canvas");
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // @ts-ignore
    if (window.jsQR) {
      // @ts-ignore
      const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert"
      });

      if (code) {
        const qrText = code.data;
        console.log("QR Code detected:", qrText);
        
        let detectedKioskId = "";
        try {
          const url = new URL(qrText);
          detectedKioskId = url.searchParams.get("kioskId") || "";
        } catch (e) {
          if (/^KSK-\d+$/i.test(qrText.trim())) {
            detectedKioskId = qrText.trim().toUpperCase();
          }
        }

        if (detectedKioskId) {
          stopScanner();
          setActiveModal(null);
          const finalId = detectedKioskId.toUpperCase();
          setKioskId(finalId);
          setUploadUrl(window.location.origin + "/?kioskId=" + finalId + "&view=mobile");
          supabase.from("kiosks").select("*").eq("id", finalId).single().then(({ data }) => {
            if (data) {
              setKioskName(data.name);
              setKioskLocation(data.location);
              setKioskStatus(data.status);
              setKioskPaper(data.paper);
            }
          });
          return;
        }
      }
    }

    if (streamRef.current) requestAnimationFrame(tick);
  }

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
        if (activeId) {
          const exists = kiosksList?.some(k => k.id === activeId);
          if (exists) {
            setKioskId(activeId);
            setUploadUrl(window.location.origin + "/?kioskId=" + activeId + "&view=mobile");
            const activeKiosk = kiosksList?.find(k => k.id === activeId);
            if (activeKiosk) {
              setKioskName(activeKiosk.name);
              setKioskLocation(activeKiosk.location);
              setKioskStatus(activeKiosk.status);
              setKioskPaper(activeKiosk.paper);
            }
          }
        }
      });

    const checkMobile = () => {
      const userAgent = (navigator.userAgent || navigator.vendor || (window as any).opera || "").toLowerCase();
      const isPhoneUA = /iphone|ipod|android.*mobile|windows phone|blackberry.*mobile/i.test(userAgent);
      const isSmallScreen = window.innerWidth < 600;
      const isMobileView = params.get("view") === "mobile";
      setIsMobile(isPhoneUA || isSmallScreen || isMobileView);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
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
    <div className="glow-orb glow-1"></div>
    <div className="glow-orb glow-2"></div>
    <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
    <Script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js" strategy="lazyOnload" />
    <header>
      <Brand />
      {kioskId ? (
        <div className="header-actions">
          <StatusPills kioskId={kioskId} status={kioskStatus} paper={kioskPaper} />
          <button className="header-btn" onClick={() => setActiveModal("help")}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>Help</span>
          </button>
        </div>
      ) : (
        <div className="header-actions">
          <button className="header-btn primary-header-btn" onClick={() => setActiveModal("scanner")}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            <span>Scan QR</span>
          </button>
          <button className="header-btn" onClick={() => setActiveModal("kioskId")}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" ry="2"/>
              <line x1="7" y1="16" x2="17" y2="16"/>
            </svg>
            <span>Enter Code</span>
          </button>
          <button className="header-btn" onClick={() => setActiveModal("help")}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>Help</span>
          </button>
        </div>
      )}
    </header>

    <section className="customer-shell">
      {!kioskId && !started ? (
        <div className="marketing-landing">
          <div className="hero-badge">
            🖨️ Self-Service Print Kiosks
          </div>
          <h1 className="hero-title">
            Print Documents Instantly From Your Phone
          </h1>
          <p className="hero-subtitle">
            No apps. No registrations. Simply scan the QR code on the kiosk, upload your files, and collect your printout instantly.
          </p>

          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon-wrapper yellow">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </div>
              <h3>Lightning Fast</h3>
              <p>Your document prints in less than 30 seconds from uploading.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon-wrapper green">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <h3>100% Secure</h3>
              <p>Files are processed over encrypted channels and auto-deleted immediately after printing.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper blue">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                  <line x1="12" y1="18" x2="12.01" y2="18"/>
                </svg>
              </div>
              <h3>No Apps Needed</h3>
              <p>Works directly in your mobile browser. Just scan the kiosk QR code and print.</p>
            </div>
          </div>

          <div className="how-it-works">
            <h2 className="section-title">How It Works</h2>
            <p className="section-subtitle">Get your printouts in 4 simple steps without any complex setup.</p>
            <div className="steps-grid">
              <div className="step-card">
                <span className="step-number">01</span>
                <div className="step-card-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 2v6h-6"/>
                    <path d="M21 13a9 9 0 1 1-9-9"/>
                  </svg>
                </div>
                <h4>Scan Kiosk QR</h4>
                <p>Point your mobile camera at the QR code sticker on the physical ScanPrint kiosk.</p>
              </div>

              <div className="step-card">
                <span className="step-number">02</span>
                <div className="step-card-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <h4>Upload Files</h4>
                <p>Choose PDFs, documents, or photos directly from your phone's storage.</p>
              </div>

              <div className="step-card">
                <span className="step-number">03</span>
                <div className="step-card-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"/>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                </div>
                <h4>Configure</h4>
                <p>Choose B&W or Color, single or double-sided, and select the number of copies.</p>
              </div>

              <div className="step-card">
                <span className="step-number">04</span>
                <div className="step-card-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9"/>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                    <rect x="6" y="14" width="12" height="8"/>
                  </svg>
                </div>
                <h4>Pay & Collect</h4>
                <p>Pay securely via UPI (Razorpay) and collect your printed pages instantly from the printer tray.</p>
              </div>
            </div>
          </div>

          <div className="pricing-section">
            <div className="pricing-info-card">
              <div>
                <h3>Affordable Pricing</h3>
                <p>Select your printing options. We offer clean, high-grade printing rates.</p>
              </div>
              <div className="price-rows">
                <div className="price-row">
                  <div className="price-name">
                    <span>Black & White</span>
                    <small>Standard clean laser print</small>
                  </div>
                  <div className="price-value">₹2 <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)", fontWeight: 400 }}>/ page</span></div>
                </div>
                <div className="price-row">
                  <div className="price-name">
                    <span>Color Print</span>
                    <small>Vibrant high-resolution print</small>
                  </div>
                  <div className="price-value">₹10 <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)", fontWeight: 400 }}>/ page</span></div>
                </div>
              </div>
            </div>

            <div className="formats-card">
              <div>
                <h3>Supported Formats</h3>
                <p>Upload files directly without converting. We support standard documents and image files.</p>
              </div>
              <div>
                <div className="format-tags">
                  <span className="format-tag">PDF</span>
                  <span className="format-tag">PNG</span>
                  <span className="format-tag">JPEG</span>
                  <span className="format-tag">JPG</span>
                  <span className="format-tag">WEBP</span>
                </div>
                <div className="format-limit">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}>
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  Maximum file size: 20 MB per print job
                </div>
              </div>
            </div>
          </div>

          <div className="security-banner">
            <div className="security-banner-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div className="security-banner-content">
              <h4>Privacy & Security First Policy</h4>
              <p>To guarantee complete privacy, all files are transmitted over secure TLS encrypted channels and automatically deleted from our servers immediately after printing.</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="hero">{kioskId && <span className="eyebrow">KIOSK {kioskLocation.toUpperCase()} · {kioskId}</span>}<h1>Upload. Pay. Print.</h1><p>Your documents, printed in minutes.</p></div>
          <div className="flow-card">
            {stage === "upload" && !kioskId && (
          <div className="connect-kiosk-view" style={{ textAlign: "center", padding: "30px 20px" }}>
            <div style={{ fontSize: "50px", margin: "0 0 16px" }}>📷</div>
            <h2 style={{ fontSize: "24px", color: "var(--navy)", margin: "0 0 8px", fontWeight: 800 }}>Scan Kiosk QR Code</h2>
            <p style={{ color: "var(--text)", fontSize: "14px", lineHeight: "1.5", margin: "0 0 24px" }}>
              To print your documents, scan the QR code sticker pasted on the physical printer kiosk.
            </p>
            
            {!scanning ? (
              <button className="primary wide" onClick={startScanner} style={{ padding: "12px 24px", fontSize: "16px", fontWeight: 700, margin: "10px 0" }}>
                📷 Start Camera Scanner
              </button>
            ) : (
              <div style={{ margin: "20px 0" }}>
                <div style={{ position: "relative", width: "100%", maxWidth: "320px", height: "240px", margin: "0 auto 16px", borderRadius: "12px", overflow: "hidden", border: "2px solid var(--blue)", background: "#000" }}>
                  <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", top: "15%", left: "15%", right: "15%", bottom: "15%", border: "2px dashed rgba(255,255,255,0.7)", borderRadius: "8px", pointerEvents: "none" }} />
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "8px", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: "11px" }}>Point camera at Kiosk QR Sticker</div>
                </div>
                <button className="primary" onClick={stopScanner} style={{ background: "#ef4444", padding: "10px 20px" }}>
                  Cancel
                </button>
              </div>
            )}
            
            <div style={{ margin: "24px 0", borderTop: "1px solid var(--border)", paddingTop: "20px" }}>
              <p style={{ color: "#64748b", fontSize: "12px", margin: "0 0 12px" }}>Or enter the Kiosk ID manually:</p>
              <form onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const input = form.elements.namedItem("kioskInput") as HTMLInputElement;
                const value = input.value.trim().toUpperCase();
                if (value) {
                  setKioskId(value);
                  setUploadUrl(window.location.origin + "/?kioskId=" + value + "&view=mobile");
                  supabase.from("kiosks").select("*").eq("id", value).single().then(({ data }) => {
                    if (data) {
                      setKioskName(data.name);
                      setKioskLocation(data.location);
                      setKioskStatus(data.status);
                      setKioskPaper(data.paper);
                    }
                  });
                }
              }} style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                <input 
                  name="kioskInput"
                  type="text" 
                  placeholder="e.g. KSK-001" 
                  required
                  style={{ padding: "10px 14px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "14px", width: "160px", textTransform: "uppercase" }}
                />
                <button type="submit" className="primary" style={{ padding: "10px 18px", fontSize: "14px" }}>
                  Connect
                </button>
              </form>
            </div>
          </div>
        )}

        {stage === "upload" && kioskId && isKioskDevice && !isMobile && !bypassKiosk && (
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

        {stage === "upload" && kioskId && (!isKioskDevice || isMobile || bypassKiosk) && <>
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
       </>
      )}
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

     {activeModal === "scanner" && (
       <div className="modal-overlay" onClick={() => setActiveModal(null)}>
         <div className="modal-container" onClick={(e) => e.stopPropagation()}>
           <div className="modal-header">
             <h3>Scan Kiosk QR Code</h3>
             <button className="modal-close-btn" onClick={() => setActiveModal(null)}>×</button>
           </div>
           <div className="modal-body" style={{ textAlign: "center" }}>
             <p style={{ fontSize: "14px", color: "var(--text)", marginBottom: "20px" }}>
               Point your camera at the QR code sticker on the physical printer kiosk to connect instantly.
             </p>
             <div className="scanner-frame">
               <video ref={videoRef} className="scanner-video" />
               <div className="scanner-laser" />
             </div>
             <button className="primary" onClick={() => setActiveModal(null)} style={{ background: "#ef4444", marginTop: "24px" }}>
               Cancel
             </button>
           </div>
         </div>
       </div>
     )}

     {activeModal === "kioskId" && (
       <div className="modal-overlay" onClick={() => setActiveModal(null)}>
         <div className="modal-container" onClick={(e) => e.stopPropagation()}>
           <div className="modal-header">
             <h3>Enter Kiosk ID</h3>
             <button className="modal-close-btn" onClick={() => setActiveModal(null)}>×</button>
           </div>
           <div className="modal-body">
             <form onSubmit={(e) => {
               e.preventDefault();
               const form = e.currentTarget;
               const input = form.elements.namedItem("kioskInput") as HTMLInputElement;
               const value = input.value.trim().toUpperCase();
               if (value) {
                 supabase.from("kiosks").select("*").eq("id", value).single().then(({ data }) => {
                   if (data) {
                     setKioskId(value);
                     setUploadUrl(window.location.origin + "/?kioskId=" + value + "&view=mobile");
                     setKioskName(data.name);
                     setKioskLocation(data.location);
                     setKioskStatus(data.status);
                     setKioskPaper(data.paper);
                     setActiveModal(null);
                   } else {
                     alert("Invalid Kiosk ID. Please check the ID printed on the printer and try again.");
                   }
                 });
               }
             }} className="modal-form">
               <div>
                 <label htmlFor="kioskInput">Kiosk ID (printed on the sticker):</label>
                 <input 
                   id="kioskInput"
                   name="kioskInput"
                   type="text" 
                   placeholder="e.g. KSK-001" 
                   required
                   style={{ textTransform: "uppercase" }}
                   autoFocus
                 />
               </div>
               <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                 <button type="button" className="secondary wide" onClick={() => setActiveModal(null)}>Cancel</button>
                 <button type="submit" className="primary wide">Connect</button>
               </div>
             </form>
           </div>
         </div>
       </div>
     )}

     {activeModal === "help" && (
       <div className="modal-overlay" onClick={() => setActiveModal(null)}>
         <div className="modal-container" onClick={(e) => e.stopPropagation()}>
           <div className="modal-header">
             <h3>How to Print</h3>
             <button className="modal-close-btn" onClick={() => setActiveModal(null)}>×</button>
           </div>
           <div className="modal-body">
             <div className="help-modal-content">
               <div className="help-step-item">
                 <span className="help-step-num">1</span>
                 <div className="help-step-text">
                   <h5>Scan or Connect</h5>
                   <p>Scan the QR code sticker on the physical print kiosk or click "Enter Kiosk ID" to connect manually.</p>
                 </div>
               </div>

               <div className="help-step-item">
                 <span className="help-step-num">2</span>
                 <div className="help-step-text">
                   <h5>Upload Document</h5>
                   <p>Upload a PDF, JPG, PNG, or WEBP file from your mobile or computer local storage (up to 20MB).</p>
                 </div>
               </div>

               <div className="help-step-item">
                 <span className="help-step-num">3</span>
                 <div className="help-step-text">
                   <h5>Choose Settings</h5>
                   <p>Select black & white or color printing, copies count, and single or double-sided layouts.</p>
                 </div>
               </div>

               <div className="help-step-item">
                 <span className="help-step-num">4</span>
                 <div className="help-step-text">
                   <h5>Secure Print</h5>
                   <p>Tap "Print Document", pay securely via UPI, and collect your pages instantly from the printer tray.</p>
                 </div>
               </div>

               <div className="help-support-box">
                 <h5>Need Immediate Help?</h5>
                 <p>Call or WhatsApp our support executive:</p>
                 <strong>📞 +91 830 903 1203</strong>
               </div>
             </div>
           </div>
         </div>
       </div>
     )}
   </main>;
 }
