const fs = require("fs");
const path = require("path");
const net = require("net");
const { createClient } = require("@supabase/supabase-js");

// 1. Parse .env.local natively (zero external dependencies)
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      process.env[key] = value.trim();
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log("=========================================");
console.log("   SCANPRINT KIOSK LOCAL PRINT AGENT    ");
console.log("=========================================");
console.log(`Connected to Supabase: ${supabaseUrl}`);
console.log("Polling for 'Paid' jobs every 2 seconds...");

async function pollJobs() {
  try {
    // Fetch any jobs with status 'Paid'
    const { data: jobs, error: fetchError } = await supabase
      .from("jobs")
      .select("*")
      .eq("status", "Paid");

    if (fetchError) throw fetchError;

    if (jobs && jobs.length > 0) {
      for (const job of jobs) {
        console.log(`\n[NEW JOB FOUND] ID: ${job.id} for Kiosk: ${job.kiosk_id}`);
        
        // Immediately mark the job as 'Printing' to lock it
        const { error: updateStatusError } = await supabase
          .from("jobs")
          .update({ status: "Printing" })
          .eq("id", job.id);

        if (updateStatusError) {
          console.error(`Failed to lock job ${job.id}:`, updateStatusError.message);
          continue;
        }

        // Fetch active Kiosk details (IP, paper tray)
        const { data: kiosk, error: kioskError } = await supabase
          .from("kiosks")
          .select("*")
          .eq("id", job.kiosk_id)
          .single();

        if (kioskError || !kiosk) {
          console.error(`[ERROR] Kiosk ${job.kiosk_id} not found in database:`, kioskError?.message);
          await supabase.from("jobs").update({ status: "Error" }).eq("id", job.id);
          continue;
        }

        const printerIp = kiosk.ip || "192.168.1.101";
        const paperTray = kiosk.paper_tray || "AUTO";
        console.log(`Downloading file from Supabase Storage: ${job.file}...`);

        // Download document file from Supabase Storage bucket 'kiosk-documents'
        const { data: fileBlob, error: downloadError } = await supabase.storage
          .from("kiosk-documents")
          .download(job.file);

        if (downloadError || !fileBlob) {
          console.error(`[STORAGE ERROR] Failed to download file ${job.file}:`, downloadError?.message);
          await supabase.from("jobs").update({ status: "Error" }).eq("id", job.id);
          continue;
        }

        // Convert Blob file to Node Buffer
        const arrayBuffer = await fileBlob.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);

        console.log(`Connecting to physical printer at ${printerIp}:9100...`);

        // Connect and stream print job raw socket
        let isConnected = false;
        const client = new net.Socket();
        client.setTimeout(10000); // 10s timeout

        client.connect(9100, printerIp, () => {
          isConnected = true;
          console.log(`Connected! Streaming print job raw PJL headers...`);
          const pjlHeaders = 
            `\x1b%-12345X@PJL SET COPIES = ${job.copies || 1}\n` +
            `@PJL SET COLORMODE = ${job.color === "bw" ? "MONOCHROME" : "COLOR"}\n` +
            `@PJL SET INTRAY = ${paperTray}\n` +
            `@PJL SET MEDIASOURCE = ${paperTray}\n` +
            `@PJL ENTER LANGUAGE = PDF\n`;

          client.write(pjlHeaders);
          client.write(fileBuffer);
          client.write("\x1b%-12345X"); // End-of-job command
          client.end();
        });

        client.on("close", async () => {
          if (!isConnected) return; // Ignore close events from failed connection attempts
          console.log(`[SUCCESS] Print job ${job.id} streamed successfully.`);
          
          // Update status to Printed and decrement printer resources
          await supabase.from("jobs").update({ status: "Printed" }).eq("id", job.id);
          
          const pagesPrinted = (job.pages || 1) * (job.copies || 1);
          const newPaper = Math.max(0, kiosk.paper - pagesPrinted);
          const newToner = Math.max(0, kiosk.toner - Math.ceil(pagesPrinted * 0.2));
          
          await supabase
            .from("kiosks")
            .update({ paper: newPaper, toner: newToner })
            .eq("id", kiosk.id);
            
          console.log(`Kiosk resources updated: Paper=${newPaper}%, Toner=${newToner}%`);
        });

        client.on("error", async (err) => {
          console.error(`[PRINTER ERROR] Failed to print job ${job.id}:`, err.message);
          await supabase.from("jobs").update({ status: "Error" }).eq("id", job.id);
        });

        client.on("timeout", () => {
          console.error(`[PRINTER TIMEOUT] Connection to ${printerIp} timed out.`);
          client.destroy();
        });
      }
    }
  } catch (err) {
    console.error("Polling error:", err.message);
  }

  // Poll again in 2 seconds
  setTimeout(pollJobs, 2000);
}

// Start agent loop
pollJobs();
