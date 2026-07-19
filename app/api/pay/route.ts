import { supabase } from "../../../lib/supabase";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { jobId, amount, kioskId } = payload;

    if (!jobId || !amount) {
      return Response.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    const isProd = process.env.CASHFREE_ENV === "production";
    const baseUrl = isProd ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";

    // Fallback: If Cashfree keys are not set, return mock response for local simulation/testing
    if (!appId || !secretKey || appId.startsWith("test_")) {
      console.warn("Cashfree client keys are not configured. Falling back to UPI simulation mode.");
      return Response.json({ mock: true });
    }

    // Call Cashfree API to create an order
    const response = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "x-client-id": appId,
        "x-client-secret": secretKey,
        "x-api-version": "2023-08-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        order_id: jobId,
        order_amount: Number(amount),
        order_currency: "INR",
        customer_details: {
          customer_id: `cust_${jobId}`,
          customer_phone: "9999999999",
          customer_email: "kiosk@scanprint.in",
        },
        order_meta: {
          return_url: `${(request.headers.get("origin") || "").startsWith("https://") ? request.headers.get("origin") : "https://printer-eight-sigma.vercel.app"}/?order_id={order_id}&kioskId=${kioskId || "KSK-001"}`,
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Cashfree order creation failed");
    }

    return Response.json({
      paymentSessionId: data.payment_session_id,
      orderId: data.order_id,
    });
  } catch (error: any) {
    console.error("[CASHFREE POST ERROR]:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("order_id");

    if (!orderId) {
      return Response.json({ error: "Missing order_id" }, { status: 400 });
    }

    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    const isProd = process.env.CASHFREE_ENV === "production";
    const baseUrl = isProd ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";

    if (!appId || !secretKey || appId.startsWith("test_")) {
      return Response.json({ error: "Cashfree credentials not configured" }, { status: 500 });
    }

    const response = await fetch(`${baseUrl}/orders/${orderId}`, {
      method: "GET",
      headers: {
        "x-client-id": appId,
        "x-client-secret": secretKey,
        "x-api-version": "2023-08-01",
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch order status");
    }

    const isPaid = data.order_status === "PAID";
    
    // If order is paid, update status to 'Paid' in Supabase to trigger printer release
    if (isPaid) {
      await supabase
        .from("jobs")
        .update({ status: "Paid" })
        .eq("id", orderId);

      // Trigger server-side socket release
      await fetch(`${new URL(request.url).origin}/api/jobs`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status: "Paid" }),
      });
    }

    return Response.json({ status: data.order_status, isPaid });
  } catch (error: any) {
    console.error("[CASHFREE GET ERROR]:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
