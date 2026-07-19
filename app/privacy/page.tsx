import Link from "next/link";

export default function PrivacyPolicy() {
  return (
    <main style={{ maxWidth: "800px", margin: "40px auto", padding: "0 20px", fontFamily: "var(--font-sans, sans-serif)", color: "var(--navy, #0f172a)" }}>
      <Link href="/" style={{ display: "inline-block", marginBottom: "20px", color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>← Back to Kiosk</Link>
      <h1 style={{ fontSize: "32px", fontWeight: 800, marginBottom: "24px" }}>Privacy Policy</h1>
      <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "20px" }}>Last Updated: July 19, 2026</p>
      
      <section style={{ display: "flex", flexDirection: "column", gap: "20px", fontSize: "15px", lineHeight: "1.6" }}>
        <p>At ScanPrint, we value your privacy and are committed to protecting your personal data. This privacy policy explains how we handle your files and information when you use our self-service printing kiosks.</p>
        
        <h2>1. Information We Collect</h2>
        <p>We collect only the information necessary to fulfill your print requests and process payments:
          <ul>
            <li><strong>Uploaded Files:</strong> PDF files you upload for printing.</li>
            <li><strong>Transaction Details:</strong> Payment amount, print settings (pages, copies), transaction time, and kiosk ID.</li>
          </ul>
        </p>

        <h2>2. Data Security & Instant File Deletion</h2>
        <p>We employ strict security policies to protect your documents:
          <ul>
            <li>Your uploaded PDF files are transmitted securely via HTTPS.</li>
            <li><strong>Automatic Deletion:</strong> Your files are automatically and permanently deleted from our cloud storage servers immediately after the print job finishes, or after 1 hour if the print job is not completed.</li>
            <li>We do not read, share, or store your documents after printing.</li>
          </ul>
        </p>

        <h2>3. Third-Party Payment Services</h2>
        <p>Payments are processed securely via external payment gateway providers (Razorpay). We do not collect or store your credit/debit card numbers or UPI credentials on our servers.</p>

        <h2>4. Contact Us</h2>
        <p>If you have any questions about this Privacy Policy, please contact us at <strong>kiosk@scanprint.in</strong>.</p>
      </section>
    </main>
  );
}
