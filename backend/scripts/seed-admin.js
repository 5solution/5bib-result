/**
 * Seed / upsert one admin user.
 *
 * Usage:
 *   MONGODB_URL="mongodb://..." MONGODB_DB_NAME="5bib_result" \
 *   ADMIN_EMAIL="danny@5bib.com" ADMIN_PASSWORD="Danny@111" \
 *   ADMIN_DISPLAY_NAME="Danny" \
 *   node scripts/seed-admin.js
 *
 * Idempotent: if email exists → resets password, updates displayName.
 * bcrypt rounds = 12 (matches AuthService seed).
 */
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

const BCRYPT_ROUNDS = 12;
const COLLECTION = 'admin_users';

function required(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`[seed-admin] missing env: ${name}`);
    process.exit(1);
  }
  return v;
}

(async () => {
  const uri = required('MONGODB_URL');
  const dbName = required('MONGODB_DB_NAME');
  const email = required('ADMIN_EMAIL').trim().toLowerCase();
  const password = required('ADMIN_PASSWORD');
  const displayName = process.env.ADMIN_DISPLAY_NAME || email.split('@')[0];

  let conn;
  try {
    conn = await mongoose
      .createConnection(uri, {
        dbName,
        serverSelectionTimeoutMS: 5000,
      })
      .asPromise();
    const coll = conn.collection(COLLECTION);

    const existing = await coll.findOne({ email });
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const now = new Date();

    if (existing) {
      const res = await coll.updateOne(
        { _id: existing._id },
        {
          $set: {
            password: hash,
            displayName,
            role: existing.role || 'admin',
            updated_at: now,
          },
        },
      );
      console.log(
        JSON.stringify(
          {
            action: 'updated',
            db: dbName,
            collection: COLLECTION,
            email,
            _id: String(existing._id),
            matched: res.matchedCount,
            modified: res.modifiedCount,
          },
          null,
          2,
        ),
      );
    } else {
      const res = await coll.insertOne({
        email,
        password: hash,
        role: 'admin',
        displayName,
        created_at: now,
        updated_at: now,
      });
      console.log(
        JSON.stringify(
          {
            action: 'inserted',
            db: dbName,
            collection: COLLECTION,
            email,
            _id: String(res.insertedId),
          },
          null,
          2,
        ),
      );
    }
  } catch (err) {
    console.error('[seed-admin] error:', err.message);
    process.exit(2);
  } finally {
    if (conn) await conn.close();
  }
})();
