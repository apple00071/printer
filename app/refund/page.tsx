import Link from "next/link";

export default function RefundPolicy() {
  return (
    <main style={{ maxWidth: "800px", margin: "40px auto", padding: "0 20px", fontFamily: "var(--font-sans, sans-serif)", color: "var(--navy, #0f172a)" }}>
      <Link href="/" style={{ display: "inline-block", marginBottom: "20px", color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>← Back to Kiosk</Link>
      <h1 style={{ fontSize: "32px", fontWeight: 800, marginBottom: "24px" }}>Refund & Cancellation Policy</h1>
      <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "20px" }}>Last Updated: July 19, 2026</p>
      
      <section style={{ display: "flex", flexDirection: "column", gap: "20px", fontSize: "15px", lineHeight: "1.6" }}>
        <p>At ScanPrint, customer satisfaction is our top priority. Since we provide instant physical printing services, our policies regarding refunds and cancellations are outlined below.</p>
        
        <h2>1. Order Cancellations</h2>
        <p>Because print jobs are sent directly to the local kiosk queue for instant printing immediately after payment is confirmed, <strong>orders cannot be cancelled</strong> once payment has been processed.</p>

        <h2>2. Refund Eligibility</h2>
        <p>Refunds are processed only under the following conditions:
          <ul>
            <li><strong>Hardware Failure:</strong> The printer runs out of paper, experiences a paper jam, loses power, or has a hardware breakdown preventing the pages from printing.</li>
            <li><strong>Incorrect Billing:</strong> You were charged an incorrect amount relative to the print options selected.</li>
          </ul>
        </p>

        <h2>3. Non-Refundable Cases</h2>
        <p>We cannot issue refunds for:
          <ul>
            <li>User-introduced errors (e.g., uploading the wrong document, selecting the wrong page ranges, or choosing incorrect color options).</li>
            <li>Failure to collect printed documents from the kiosk output tray.</li>
          </ul>
        </p>

        <h2>4. How to Request a Refund</h2>
        <p>To request a refund, please contact us within 24 hours of the transaction:
          <ul>
            <li><strong>Email:</strong> kiosk@scanprint.in</li>
            <li><strong>Phone Support:</strong> +91 8309031203</li>
          </ul>
          Please provide the <strong>Job ID</strong> (e.g., `SP-XXXX`) and the physical kiosk location. Approved refunds will be credited back to your original payment method (UPI/Card) within 5 to 7 business days.
        </p>
      </section>
    </main>
  );
}
