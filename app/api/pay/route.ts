import crypto from "crypto";
import { supabase } from "../../../lib/supabase";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { jobId, amount } = payload;

    if (!jobId || !amount) {
      return Response.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // Fallback: If Razorpay keys are not configured, allow local UPI simulation mode
    if (!keyId || !keySecret || keyId.startsWith("test_")) {
      console.warn("Razorpay credentials not configured. Falling back to UPI simulation mode.");
      return Response.json({ mock: true });
    }

    // Call Razorpay API to create an order
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(Number(amount) * 100), // Amount in paise (1 INR = 100 paise)
        currency: "INR",
        receipt: jobId
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.description || "Razorpay order creation failed");
    }

    return Response.json({
      orderId: data.id,
      amount: data.amount,
      currency: data.currency,
      keyId: keyId
    });
  } catch (error: any) {
    console.error("[RAZORPAY POST ERROR]:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json();
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, jobId } = payload;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !jobId) {
      return Response.json({ error: "Missing signature parameters" }, { status: 400 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return Response.json({ error: "Razorpay secret key not configured" }, { status: 500 });
    }

    // Verify signature using HMAC SHA256
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto
      .createHmac("sha256", keySecret)
      .update(text)
      .digest("hex");

    const isVerified = generated_signature === razorpay_signature;

    if (!isVerified) {
      return Response.json({ error: "Invalid payment signature" }, { status: 400 });
    }

    // Update job status to Paid in Supabase to trigger print
    const { error: dbError } = await supabase
      .from("jobs")
      .update({ status: "Paid" })
      .eq("id", jobId);

    if (dbError) throw dbError;

    // Trigger local printer release socket
    await fetch(`${new URL(request.url).origin}/api/jobs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: jobId, status: "Paid" })
    });

    return Response.json({ success: true });
  } catch (error: any) {
    console.error("[RAZORPAY PUT ERROR]:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
