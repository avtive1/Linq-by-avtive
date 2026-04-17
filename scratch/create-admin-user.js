// One-time script to create the admin user in Supabase
// Run with: node scratch/create-admin-user.js

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://baprchzvczbbeowzfrga.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhcHJjaHp2Y3piYmVvd3pmcmdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQyMTc5NSwiZXhwIjoyMDkxOTk3Nzk1fQ.MvPIhI29EX3eQZ72jqTlNjGWEK1KtLnGdKenXnqyItg";

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createAdminUser() {
  console.log("Creating admin user on company Supabase...");
  
  const { data, error } = await adminClient.auth.admin.createUser({
    email: "afiaaziz044@gmail.com",
    password: "afiaaziz044@gmail.com",
    email_confirm: true,
  });

  if (error) {
    if (error.message.includes("already been registered")) {
      console.log("ℹ️  User already exists — skipping creation.");
    } else {
      console.error("❌ Error:", error.message);
    }
  } else {
    console.log("✅ Admin user created successfully!");
    console.log("   Email:   ", data.user.email);
    console.log("   User ID: ", data.user.id);
    console.log("\nYou can now log in at http://localhost:3000/login");
    console.log("Then go to http://localhost:3000/admin");
  }
}

createAdminUser();
