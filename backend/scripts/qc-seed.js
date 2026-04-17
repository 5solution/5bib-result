/* eslint-disable */
// One-shot seed: tạo 1 event LIVE + 1 ops_admin (phone/email/password đã hash bcrypt).
// Chạy: cd backend && node /tmp/ops-qc-seed.js
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const URL = process.env.MONGODB_URL;
const DB = process.env.MONGODB_DB_NAME;

(async () => {
  await mongoose.connect(URL, { dbName: DB });
  const db = mongoose.connection.db;

  const TENANT = process.env.OPS_DEFAULT_TENANT_ID || "5bib-default";
  const slug = "qc-event-" + Date.now();

  // Cleanup any pre-existing QC user/event with our marker email
  await db.collection("ops_users").deleteMany({ email: "qc-admin@local.test" });

  const eventInsert = await db.collection("ops_events").insertOne({
    tenant_id: TENANT,
    name: "QC Event " + new Date().toISOString().slice(0, 19),
    slug,
    date: new Date(),
    location: { name: "QC Lab", address: "127.0.0.1" },
    courses: [],
    stations: [{ station_id: "S1", name: "Cổng A", courses_served: [] }],
    status: "LIVE",
    created_by: new mongoose.Types.ObjectId(),
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  });
  const eventId = eventInsert.insertedId;

  const password_hash = await bcrypt.hash("qcpassword!", 10);
  const userInsert = await db.collection("ops_users").insertOne({
    phone: "0900000000",
    email: "qc-admin@local.test",
    full_name: "QC Admin",
    role: "ops_admin",
    event_id: eventId,
    team_id: null,
    password_hash,
    status: "ACTIVE",
    approved_by: null,
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  });

  console.log(JSON.stringify({
    event_id: eventId.toString(),
    admin_user_id: userInsert.insertedId.toString(),
    email: "qc-admin@local.test",
    password: "qcpassword!",
  }));

  await mongoose.disconnect();
})().catch((e) => {
  console.error("SEED_FAIL", e.message);
  process.exit(1);
});
