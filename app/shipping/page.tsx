import Link from "next/link";

export default function ShippingPolicy() {
  return (
    <main style={{ maxWidth: "800px", margin: "40px auto", padding: "0 20px", fontFamily: "var(--font-sans, sans-serif)", color: "var(--navy, #0f172a)" }}>
      <Link href="/" style={{ display: "inline-block", marginBottom: "20px", color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>← Back to Kiosk</Link>
      <h1 style={{ fontSize: "32px", fontWeight: 800, marginBottom: "24px" }}>Shipping & Delivery Policy</h1>
      <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "20px" }}>Last Updated: July 19, 2026</p>
      
      <section style={{ display: "flex", flexDirection: "column", gap: "20px", fontSize: "15px", lineHeight: "1.6" }}>
        <p>ScanPrint operates local self-service printing kiosks. This shipping and delivery policy explains how physical prints are fulfilled.</p>
        
        <h2>1. Instant On-Site Delivery</h2>
        <p>Because ScanPrint is a self-service physical kiosk service, <strong>there is no physical shipping or home delivery involved</strong>.</p>

        <h2>2. How Delivery Works</h2>
        <p>
          <ul>
            <li>Once payment is completed, the print job is sent to the physical printer at the kiosk location where you are standing.</li>
            <li>The physical printouts are delivered directly to the printer's output tray within 1 to 2 minutes of payment validation.</li>
            <li>The customer is responsible for collecting the physical printed pages directly from the kiosk output tray.</li>
          </ul>
        </p>

        <h2>3. Support</h2>
        <p>If your documents do not print at the kiosk after successful payment validation, please contact our on-site coordinator or call our support line at <strong>+91 8309031203</strong> for assistance or refund options.</p>
      </section>
    </main>
  );
}
