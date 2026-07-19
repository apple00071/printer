import crypto from "crypto";
import { supabase } from "../../../../lib/supabase";

export async function POST(request: Request) {
  try {
    // Parse application/x-www-form-urlencoded payload from Razorpay POST
    const formData = await request.formData();
    const razorpay_payment_id = formData.get("razorpay_payment_id")?.toString();
    const razorpay_order_id = formData.get("razorpay_order_id")?.toString();
    const razorpay_signature = formData.get("razorpay_signature")?.toString();

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !jobId) {
      throw new Error("Missing payment credentials");
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      throw new Error("Razorpay credentials not configured");
    }

    // Verify payment signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto
      .createHmac("sha256", keySecret)
      .update(text)
      .digest("hex");

    const isVerified = generated_signature === razorpay_signature;
    if (!isVerified) {
      throw new Error("Payment signature verification failed");
    }

    // Update print job status in database to 'Paid'
    const { error: dbError } = await supabase
      .from("jobs")
      .update({ status: "Paid" })
      .eq("id", jobId);

    if (dbError) throw dbError;

    // Trigger local printer socket release
    const origin = new URL(request.url).origin;
    await fetch(`${origin}/api/jobs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: jobId, status: "Paid" })
    });

    // Redirect customer to print success page
    return Response.redirect(`${origin}/?jobId=${jobId}&status=success`, 303);
  } catch (error: any) {
    console.error("[RAZORPAY CALLBACK ERROR]:", error);
    const origin = new URL(request.url).origin;
    return Response.redirect(`${origin}/?status=error&msg=${encodeURIComponent(error.message)}`, 303);
  }
}
