#!/usr/bin/env node
/**
 * Seed sample sponsors into MongoDB
 * Usage: node scripts/seed-sponsors.js
 * Requires MONGODB_URL env var or defaults to localhost
 */
const { MongoClient } = require('mongodb');

const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27018';
const DB_NAME = process.env.MONGODB_DB_NAME || '5bib-result';

const sponsors = [
  {
    name: 'Garmin',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Garmin_logo.svg/512px-Garmin_logo.svg.png',
    website: 'https://garmin.com',
    level: 'diamond',
    order: 0,
    isActive: true,
  },
  {
    name: 'HOKA',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Hoka_One_One_logo.svg/512px-Hoka_One_One_logo.svg.png',
    website: 'https://hoka.com',
    level: 'diamond',
    order: 1,
    isActive: true,
  },
  {
    name: 'The North Face',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/The_North_Face_Logo.svg/512px-The_North_Face_Logo.svg.png',
    website: 'https://thenorthface.com',
    level: 'gold',
    order: 0,
    isActive: true,
  },
  {
    name: 'Suunto',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Suunto_logo.svg/512px-Suunto_logo.svg.png',
    website: 'https://suunto.com',
    level: 'gold',
    order: 1,
    isActive: true,
  },
  {
    name: 'GU Energy',
    logoUrl: '',
    website: 'https://guenergy.com',
    level: 'silver',
    order: 0,
    isActive: true,
  },
  {
    name: 'Compressport',
    logoUrl: '',
    website: 'https://compressport.com',
    level: 'silver',
    order: 1,
    isActive: true,
  },
];

async function main() {
  const client = new MongoClient(MONGODB_URL);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const col = db.collection('sponsors');

    const existing = await col.countDocuments();
    if (existing > 0) {
      console.log(`Already ${existing} sponsors in DB. Skipping seed.`);
      return;
    }

    const now = new Date();
    const docs = sponsors.map((s) => ({
      ...s,
      created_at: now,
      updated_at: now,
    }));

    const result = await col.insertMany(docs);
    console.log(`Inserted ${result.insertedCount} sponsors.`);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
