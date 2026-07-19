import Link from "next/link";

export default function ContactUs() {
  return (
    <main style={{ maxWidth: "800px", margin: "40px auto", padding: "0 20px", fontFamily: "var(--font-sans, sans-serif)", color: "var(--navy, #0f172a)" }}>
      <Link href="/" style={{ display: "inline-block", marginBottom: "20px", color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>← Back to Kiosk</Link>
      <h1 style={{ fontSize: "32px", fontWeight: 800, marginBottom: "24px" }}>Contact Us</h1>
      <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "20px" }}>We are here to help you. Get in touch with us for support, billing queries, or feedback.</p>
      
      <section style={{ display: "flex", flexDirection: "column", gap: "24px", marginTop: "20px" }}>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
          
          <div style={{ background: "#f8fafc", border: "1px solid var(--border, #e2e8f0)", borderRadius: "12px", padding: "20px" }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", fontWeight: 800 }}>Customer Support</h3>
            <p style={{ margin: "0 0 8px 0", fontSize: "14px" }}><strong>Phone:</strong> +91 8309031203</p>
            <p style={{ margin: 0, fontSize: "14px" }}><strong>Email:</strong> kiosk@scanprint.in</p>
          </div>

          <div style={{ background: "#f8fafc", border: "1px solid var(--border, #e2e8f0)", borderRadius: "12px", padding: "20px" }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", fontWeight: 800 }}>Merchant Location</h3>
            <p style={{ margin: "0 0 8px 0", fontSize: "14px", lineHeight: "1.5" }}>
              <strong>ScanPrint self-service Kiosks</strong><br />
              Main Bazaar Road, Kavali,<br />
              Andhra Pradesh, India - 524201
            </p>
          </div>

        </div>

        <div style={{ borderTop: "1px solid var(--border, #e2e8f0)", paddingTop: "20px", marginTop: "10px" }}>
          <h2>Hours of Operation</h2>
          <p style={{ fontSize: "14px", color: "var(--text, #475569)" }}>Our physical kiosks are operational daily from <strong>7:00 AM to 10:00 PM IST</strong>.</p>
        </div>

      </section>
    </main>
  );
}
