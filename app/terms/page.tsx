import Link from "next/link";

export default function TermsAndConditions() {
  return (
    <main style={{ maxWidth: "800px", margin: "40px auto", padding: "0 20px", fontFamily: "var(--font-sans, sans-serif)", color: "var(--navy, #0f172a)" }}>
      <Link href="/" style={{ display: "inline-block", marginBottom: "20px", color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>← Back to Kiosk</Link>
      <h1 style={{ fontSize: "32px", fontWeight: 800, marginBottom: "24px" }}>Terms & Conditions</h1>
      <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "20px" }}>Last Updated: July 19, 2026</p>
      
      <section style={{ display: "flex", flexDirection: "column", gap: "20px", fontSize: "15px", lineHeight: "1.6" }}>
        <p>Welcome to ScanPrint. By using our self-service printing kiosks and website, you agree to comply with and be bound by the following terms and conditions of use.</p>
        
        <h2>1. Services Provided</h2>
        <p>ScanPrint provides local self-service printing services at designated physical kiosk locations. Users upload documents via our web application, configure print options, complete payments, and collect physical prints directly from the kiosk.</p>

        <h2>2. User Obligations</h2>
        <p>You agree not to upload any content that:
          <ul>
            <li>Violates any intellectual property, copyright, or trademark laws.</li>
            <li>Contains malicious code, viruses, or software intended to disrupt the kiosk systems.</li>
            <li>Is illegal, threatening, defamatory, or violates local regulations.</li>
          </ul>
        </p>

        <h2>3. Payments & Fees</h2>
        <p>All fees are displayed transparently before payment checkout. By completing a transaction, you authorize the charge for the specified number of print pages and copies.</p>

        <h2>4. Limitation of Liability</h2>
        <p>ScanPrint is not responsible for print quality issues resulting from poorly formatted source documents, user configuration errors, or failure to collect physical prints from the kiosk output tray.</p>

        <h2>5. Governing Law</h2>
        <p>These terms are governed by and construed in accordance with the laws of India, and any disputes will be subject to the exclusive jurisdiction of the local courts.</p>
      </section>
    </main>
  );
}
