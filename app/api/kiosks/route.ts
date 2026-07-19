import { supabase } from "../../../lib/supabase";

const DEFAULT_KIOSK = {
  id: "KSK-001",
  name: "HP LaserJet Pro",
  location: "Kavali",
  status: "Online",
  paper: 68,
  toner: 74,
  ip: "192.168.1.101"
};

export async function GET() {
  try {
    const { data: rows, error } = await supabase.from("kiosks").select("*");
    if (error) throw error;

    let kiosks = rows || [];
    if (kiosks.length === 0) {
      // Seed default kiosk if empty
      const { data: seeded, error: seedError } = await supabase
        .from("kiosks")
        .insert(DEFAULT_KIOSK)
        .select();
      if (seedError) throw seedError;
      kiosks = seeded || [DEFAULT_KIOSK];
    }

    // Sort by id to maintain consistent order
    kiosks.sort((a: any, b: any) => a.id.localeCompare(b.id));

    return Response.json({ kiosks });
  } catch (error: any) {
    console.error("[KIOSKS GET ERROR]:", error);
    const message = error?.message || JSON.stringify(error);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { id, name, location, ip, status, paper, toner } = payload;

    if (!id || !name || !location || !ip) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { error } = await supabase.from("kiosks").upsert({
      id: id.toUpperCase(),
      name,
      location,
      ip,
      status: status || "Online",
      paper: paper !== undefined ? Number(paper) : 100,
      toner: toner !== undefined ? Number(toner) : 100
    });

    if (error) throw error;

    return Response.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("[KIOSKS POST ERROR]:", error);
    const message = error?.message || JSON.stringify(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
