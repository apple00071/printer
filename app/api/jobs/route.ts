import net from "net";
import { supabase } from "../../../lib/supabase";

const DEFAULT_JOBS = [
  { id: "SP-1048", file: "hall-ticket.pdf", amount: 8, status: "Printed", time: "10:42 AM", color: "bw", sides: "single", copies: 1, pages: 4, range: "All pages", kiosk_id: "KSK-001" },
  { id: "SP-1047", file: "resume.pdf", amount: 4, status: "Printed", time: "10:36 AM", color: "bw", sides: "single", copies: 1, pages: 2, range: "All pages", kiosk_id: "KSK-001" },
  { id: "SP-1046", file: "project-report.pdf", amount: 22, status: "Paid", time: "10:31 AM", color: "bw", sides: "single", copies: 1, pages: 11, range: "All pages", kiosk_id: "KSK-001" },
];

export async function GET() {
  try {
    const { data: rows, error } = await supabase
      .from("jobs")
      .select("*")
      .order("time", { ascending: false });

    if (error) throw error;

    let jobsList = rows || [];
    if (jobsList.length === 0) {
      // Ensure KSK-001 exists first in kiosks table due to foreign key constraints
      const { data: kiosksList } = await supabase.from("kiosks").select("id");
      if (!kiosksList || kiosksList.length === 0) {
        await supabase.from("kiosks").insert({
          id: "KSK-001",
          name: "HP LaserJet Pro",
          location: "Kavali",
          status: "Online",
          paper: 68,
          toner: 74,
          ip: "192.168.1.101"
        });
      }
      
      // Seed default jobs
      const { data: seeded, error: seedError } = await supabase
        .from("jobs")
        .insert(DEFAULT_JOBS)
        .select();

      if (seedError) throw seedError;
      jobsList = seeded || DEFAULT_JOBS;
    }

    return Response.json({ jobs: jobsList });
  } catch (error: any) {
    console.error("[JOBS GET ERROR]:", error);
    const message = error?.message || JSON.stringify(error);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { id, file, amount, time, color, sides, copies, pages, range, kioskId } = payload;

    if (!id || !file || amount === undefined) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { error } = await supabase.from("jobs").insert({
      id,
      file,
      amount,
      status: "Pending",
      time,
      color: color || "bw",
      sides: sides || "single",
      copies: copies || 1,
      pages: pages || 1,
      range: range || "All pages",
      kiosk_id: kioskId || "KSK-001"
    });

    if (error) throw error;

    return Response.json({ success: true }, { status: 201 });
  } catch (error: any) {
    console.error("[JOBS POST ERROR]:", error);
    const message = error?.message || JSON.stringify(error);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json();
    const { id, status } = payload;

    if (!id || !status) {
      return Response.json({ error: "Missing job ID or status" }, { status: 400 });
    }

    // Fetch the target job
    const { data: jobRecord, error: fetchError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !jobRecord) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }

    // Update job status in database
    const { error: updateError } = await supabase
      .from("jobs")
      .update({ status })
      .eq("id", id);

    if (updateError) throw updateError;

    // Stream to printer and decrement printer health
    if (status === "Paid" || status === "Printing") {
      const activeKioskId = jobRecord.kiosk_id || "KSK-001";
      const { data: kioskRecord } = await supabase
        .from("kiosks")
        .select("*")
        .eq("id", activeKioskId)
        .single();
      
      const printerIp = kioskRecord?.ip || "192.168.1.101";
      console.log(`[PRINTER CONNECT] Opening TCP connection to printer at ${printerIp}:9100...`);
      
      try {
        // 1. Download staged PDF from Supabase Storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("kiosk-documents")
          .download(jobRecord.file);

        if (downloadError || !fileData) {
          console.error(`[STORAGE ERROR] Failed to download file: ${jobRecord.file}`, downloadError);
        } else {
          // Convert Blob file to ArrayBuffer -> Node Buffer
          const arrayBuffer = await fileData.arrayBuffer();
          const fileBuffer = Buffer.from(arrayBuffer);

          // 2. Connect to printer JetDirect raw socket
          const client = new net.Socket();
          client.setTimeout(8000); // 8-second timeout for rapid feedback

          client.connect(9100, printerIp, () => {
            console.log(`[PRINTER RELEASE] Staging print job headers for ${jobRecord.id}`);
            const paperTray = kioskRecord?.paper_tray || "AUTO";
            
            // Format PJL headers for Konica Minolta
            const pjlHeaders = 
              `\x1b%-12345X@PJL SET COPIES = ${jobRecord.copies}\n` +
              `@PJL SET COLORMODE = ${jobRecord.color === "bw" ? "MONOCHROME" : "COLOR"}\n` +
              `@PJL SET INTRAY = ${paperTray}\n` +
              `@PJL SET MEDIASOURCE = ${paperTray}\n` +
              `@PJL ENTER LANGUAGE = PDF\n`;

            client.write(pjlHeaders);
            client.write(fileBuffer);
            client.write("\x1b%-12345X"); // End-of-job sequence
            client.end();
            console.log(`[PRINTER SUCCESS] Job ${jobRecord.id} successfully streamed.`);
          });

          client.on("error", (err) => {
            console.error(`[PRINTER ERROR] Failed to connect to ${printerIp}:9100 - ${err.message}`);
          });

          client.on("timeout", () => {
            console.warn(`[PRINTER TIMEOUT] Connection to ${printerIp}:9100 timed out`);
            client.destroy();
          });
        }
      } catch (err) {
        console.error("[PRINT PIPELINE ERROR]:", err);
      }

      // Simulate paper/toner decrement based on print counts
      if (kioskRecord) {
        const pagesPrinted = jobRecord.pages * jobRecord.copies;
        const newPaper = Math.max(0, kioskRecord.paper - pagesPrinted);
        const newToner = Math.max(0, kioskRecord.toner - Math.ceil(pagesPrinted * 0.2));
        
        await supabase
          .from("kiosks")
          .update({ paper: newPaper, toner: newToner })
          .eq("id", activeKioskId);
      }
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("[JOBS PUT ERROR]:", error);
    const message = error?.message || JSON.stringify(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
