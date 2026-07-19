const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Manually parse .env.local to avoid requiring external 'dotenv' dependency
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const parts = line.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim();
      process.env[key] = val;
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERROR: Supabase URL/Key missing in .env.local!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const konicaKiosk = {
  id: "KSK-002",
  name: "Konica Minolta bizhub",
  location: "Self-Service Station",
  ip: "192.168.1.123",
  status: "Online",
  paper: 100,
  toner: 100
};

async function main() {
  console.log(`Sending upsert request for Kiosk ${konicaKiosk.id} (${konicaKiosk.name}) to Supabase...`);
  
  const { data, error } = await supabase
    .from("kiosks")
    .upsert(konicaKiosk)
    .select();

  if (error) {
    console.error("ERROR: Failed to save printer:", error.message);
  } else {
    console.log("SUCCESS: Printer has been successfully saved to your Supabase database!");
    console.log(data);
  }
}

main();
