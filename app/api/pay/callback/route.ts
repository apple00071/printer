import crypto from "crypto";
import { supabase } from "../../../../lib/supabase";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  try {
    let razorpay_payment_id: string | undefined;
    let razorpay_order_id: string | undefined;
    let razorpay_signature: string | undefined;

    const contentType = request.headers.get("content-type") || "";
    console.log(`[RAZORPAY CALLBACK] Content-Type is ${contentType} for Job: ${jobId}`);

    if (contentType.includes("application/json")) {
      const body = await request.json();
      razorpay_payment_id = body.razorpay_payment_id;
      razorpay_order_id = body.razorpay_order_id;
      razorpay_signature = body.razorpay_signature;
    } else {
      const formData = await request.formData();
      razorpay_payment_id = formData.get("razorpay_payment_id")?.toString();
      razorpay_order_id = formData.get("razorpay_order_id")?.toString();
      razorpay_signature = formData.get("razorpay_signature")?.toString();
    }

    console.log("[RAZORPAY CALLBACK] Parsed credentials:", {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      jobId
    });

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !jobId) {
      throw new Error("Missing transaction token or signatures from Razorpay callback");
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      throw new Error("RAZORPAY_KEY_SECRET is not configured on the server environment");
    }

    // Verify payment signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto
      .createHmac("sha256", keySecret)
      .update(text)
      .digest("hex");

    const isVerified = generated_signature === razorpay_signature;
    console.log("[RAZORPAY CALLBACK] Signature verification result:", isVerified);

    if (!isVerified) {
      throw new Error("Razorpay checksum signature verification failed");
    }

    // Update print job status in database to 'Paid'
    const { error: dbError } = await supabase
      .from("jobs")
      .update({ status: "Paid" })
      .eq("id", jobId);

    if (dbError) throw dbError;

    // Trigger local printer socket release
    await fetch(`${origin}/api/jobs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: jobId, status: "Paid" })
    });

    console.log("[RAZORPAY CALLBACK] Job successfully verified & released to printer queue!");

    // Redirect customer to print success page
    return Response.redirect(`${origin}/?jobId=${jobId}&status=success`, 303);
  } catch (error: any) {
    console.error("[RAZORPAY CALLBACK ERROR]:", error.message);
    return Response.redirect(`${origin}/?status=error&msg=${encodeURIComponent(error.message)}`, 303);
  }
}
