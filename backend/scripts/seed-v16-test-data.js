/**
 * seed-v16-test-data.js — Populate v1.6 station + supply tables with
 * realistic shape for E2E QC. Target event_id=1, role_id=3 (TNV team Nước).
 *
 * Creates:
 *   - 3 stations (Km5, Km15, Km30) under role 3 — Km5/Km15 in setup, Km30 active
 *   - 3 supply items (Nước, Chuối, Gel năng lượng) created_by_role_id=1
 *   - 1 supply plan row per item for role 3:
 *       Nước:  requested=5000 fulfilled=4800 gap=200
 *       Chuối: requested=800  fulfilled=800  gap=0
 *       Gel:   requested=200  fulfilled=NULL gap=NULL  (admin chưa xử lý)
 *   - Round-1 allocations on 3 stations:
 *       Km5:  Nước=1000, Chuối=200
 *       Km15: Nước=1500, Chuối=250
 *       Km30: Nước=2000, Chuối=350   (SUM=4500 ≤ 4800 ✓)
 *   - Assignments: 1 crew + 2 volunteers per station (picked from existing
 *     role_id=3 approved-plus registrations)
 *   - Crew confirms Km5: Nước confirmed=980 (shortage=20 "Ly rách 20 cái"),
 *     Chuối confirmed=200 (match), is_locked=TRUE
 *   - Supplement round 1 on Km5 Nước: qty=200 note="Bổ sung ca chiều",
 *     confirmed=200 (match)
 *
 * Usage: node scripts/seed-v16-test-data.js
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  const env = {};
  for (const l of lines) {
    const m = l.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const EVENT_ID = 1;
const NON_LEADER_ROLE = 3; // TNV team Nước
const LEADER_ROLE = 1;     // Leader Team nước (used as created_by_role_id)

async function main() {
  const env = loadEnv();
  const c = await mysql.createConnection({
    host: env.VOLUNTEER_DB_HOST,
    port: Number(env.VOLUNTEER_DB_PORT),
    user: env.VOLUNTEER_DB_USER,
    password: env.VOLUNTEER_DB_PASS,
    database: env.VOLUNTEER_DB_NAME,
    charset: 'utf8mb4',
  });
  await c.query("SET NAMES utf8mb4");

  console.log('\n=== v1.6 SEED (event 1, role 3) ===\n');

  // ---- stations ----
  const stationDefs = [
    { station_name: 'Trạm Nước Km5',  gps_lat: 21.0285, gps_lng: 105.8048, status: 'setup',  sort_order: 1 },
    { station_name: 'Trạm Nước Km15', gps_lat: null,     gps_lng: null,     status: 'setup',  sort_order: 2 },
    { station_name: 'Trạm Nước Km30', gps_lat: 21.0391, gps_lng: 105.7906, status: 'active', sort_order: 3 },
  ];
  const stationIds = {};
  for (const s of stationDefs) {
    // Upsert-style: if an existing station with same event+role+name, reuse.
    const [existing] = await c.query(
      'SELECT id FROM vol_station WHERE event_id=? AND role_id=? AND station_name=? LIMIT 1',
      [EVENT_ID, NON_LEADER_ROLE, s.station_name],
    );
    let id;
    if (existing.length) {
      id = existing[0].id;
      await c.query(
        'UPDATE vol_station SET gps_lat=?, gps_lng=?, status=?, sort_order=?, is_active=TRUE WHERE id=?',
        [s.gps_lat, s.gps_lng, s.status, s.sort_order, id],
      );
      console.log(`  [station] reuse id=${id} "${s.station_name}"`);
    } else {
      const [res] = await c.query(
        'INSERT INTO vol_station (event_id, role_id, station_name, location_description, gps_lat, gps_lng, status, sort_order, is_active) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, TRUE)',
        [EVENT_ID, NON_LEADER_ROLE, s.station_name, s.gps_lat, s.gps_lng, s.status, s.sort_order],
      );
      id = res.insertId;
      console.log(`  [station] INSERT id=${id} "${s.station_name}" status=${s.status}`);
    }
    stationIds[s.station_name] = id;
  }

  // ---- supply items ----
  const itemDefs = [
    { item_name: 'Nước (ly)',       unit: 'ly',  sort_order: 1 },
    { item_name: 'Chuối',           unit: 'quả', sort_order: 2 },
    { item_name: 'Gel năng lượng',  unit: 'gói', sort_order: 3 },
  ];
  const itemIds = {};
  for (const it of itemDefs) {
    const [existing] = await c.query(
      'SELECT id FROM vol_supply_item WHERE event_id=? AND item_name=? LIMIT 1',
      [EVENT_ID, it.item_name],
    );
    let id;
    if (existing.length) {
      id = existing[0].id;
      await c.query(
        'UPDATE vol_supply_item SET unit=?, created_by_role_id=?, sort_order=? WHERE id=?',
        [it.unit, LEADER_ROLE, it.sort_order, id],
      );
      console.log(`  [item] reuse id=${id} "${it.item_name}"`);
    } else {
      const [res] = await c.query(
        'INSERT INTO vol_supply_item (event_id, item_name, unit, created_by_role_id, sort_order) VALUES (?, ?, ?, ?, ?)',
        [EVENT_ID, it.item_name, it.unit, LEADER_ROLE, it.sort_order],
      );
      id = res.insertId;
      console.log(`  [item] INSERT id=${id} "${it.item_name}"`);
    }
    itemIds[it.item_name] = id;
  }

  // ---- supply plan (role 3) ----
  const planDefs = [
    { item: 'Nước (ly)',      requested_qty: 5000, fulfilled_qty: 4800 },
    { item: 'Chuối',          requested_qty: 800,  fulfilled_qty: 800 },
    { item: 'Gel năng lượng', requested_qty: 200,  fulfilled_qty: null },
  ];
  for (const p of planDefs) {
    const itemId = itemIds[p.item];
    const [existing] = await c.query(
      'SELECT id FROM vol_supply_plan WHERE role_id=? AND item_id=? LIMIT 1',
      [NON_LEADER_ROLE, itemId],
    );
    if (existing.length) {
      await c.query(
        'UPDATE vol_supply_plan SET requested_qty=?, fulfilled_qty=?, request_note=?, fulfill_note=? WHERE id=?',
        [p.requested_qty, p.fulfilled_qty,
         'seed v1.6 — leader order',
         p.fulfilled_qty === null ? null : 'seed v1.6 — admin đã cấp',
         existing[0].id],
      );
      console.log(`  [plan] reuse id=${existing[0].id} item="${p.item}" requested=${p.requested_qty} fulfilled=${p.fulfilled_qty}`);
    } else {
      const [res] = await c.query(
        'INSERT INTO vol_supply_plan (event_id, role_id, item_id, requested_qty, fulfilled_qty, request_note, fulfill_note) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [EVENT_ID, NON_LEADER_ROLE, itemId, p.requested_qty, p.fulfilled_qty,
         'seed v1.6 — leader order',
         p.fulfilled_qty === null ? null : 'seed v1.6 — admin đã cấp'],
      );
      console.log(`  [plan] INSERT id=${res.insertId} item="${p.item}" requested=${p.requested_qty} fulfilled=${p.fulfilled_qty}`);
    }
  }

  // ---- allocations (round 1) ----
  const allocDefs = [
    { station: 'Trạm Nước Km5',  item: 'Nước (ly)', allocated_qty: 1000 },
    { station: 'Trạm Nước Km5',  item: 'Chuối',     allocated_qty: 200 },
    { station: 'Trạm Nước Km15', item: 'Nước (ly)', allocated_qty: 1500 },
    { station: 'Trạm Nước Km15', item: 'Chuối',     allocated_qty: 250 },
    { station: 'Trạm Nước Km30', item: 'Nước (ly)', allocated_qty: 2000 },
    { station: 'Trạm Nước Km30', item: 'Chuối',     allocated_qty: 350 },
  ];
  const allocIds = {};
  for (const a of allocDefs) {
    const stationId = stationIds[a.station];
    const itemId = itemIds[a.item];
    const [existing] = await c.query(
      'SELECT id FROM vol_supply_allocation WHERE station_id=? AND item_id=? LIMIT 1',
      [stationId, itemId],
    );
    let id;
    if (existing.length) {
      id = existing[0].id;
      // Don't stomp an already-confirmed row.
      const [row] = await c.query('SELECT is_locked FROM vol_supply_allocation WHERE id=?', [id]);
      if (!row[0].is_locked) {
        await c.query(
          'UPDATE vol_supply_allocation SET allocated_qty=? WHERE id=?',
          [a.allocated_qty, id],
        );
      }
      console.log(`  [alloc] reuse id=${id} ${a.station}/${a.item} allocated=${a.allocated_qty}`);
    } else {
      const [res] = await c.query(
        'INSERT INTO vol_supply_allocation (station_id, item_id, allocated_qty, is_locked) VALUES (?, ?, ?, FALSE)',
        [stationId, itemId, a.allocated_qty],
      );
      id = res.insertId;
      console.log(`  [alloc] INSERT id=${id} ${a.station}/${a.item} allocated=${a.allocated_qty}`);
    }
    allocIds[`${a.station}__${a.item}`] = id;
  }

  // ---- assignments ----
  // Fetch approved+ registrations in role 3, excluding any already assigned
  // to a station. We need 9 slots total (3 crew + 6 volunteers across 3 stations)
  // but we'll distribute what's available.
  const [eligible] = await c.query(
    `SELECT r.id, r.full_name
       FROM vol_registration r
  LEFT JOIN vol_station_assignment a ON a.registration_id = r.id
      WHERE r.event_id=? AND r.role_id=?
        AND r.status IN ('approved','contract_sent','contract_signed','qr_sent','checked_in','completed')
        AND a.id IS NULL
   ORDER BY r.id ASC`,
    [EVENT_ID, NON_LEADER_ROLE],
  );
  console.log(`\n  [assign] ${eligible.length} eligible role=${NON_LEADER_ROLE} TNVs (unassigned, post-approve)`);

  const stationOrder = ['Trạm Nước Km5', 'Trạm Nước Km15', 'Trạm Nước Km30'];
  const picks = {
    'Trạm Nước Km5':  { crew: null, vols: [] },
    'Trạm Nước Km15': { crew: null, vols: [] },
    'Trạm Nước Km30': { crew: null, vols: [] },
  };

  // First 3 → crew of Km5, Km15, Km30 respectively.
  // Next up to 6 → volunteers distributed across the 3 stations.
  let idx = 0;
  for (const sName of stationOrder) {
    if (idx < eligible.length) {
      picks[sName].crew = eligible[idx];
      idx++;
    }
  }
  while (idx < eligible.length && idx < 3 + 6) {
    const sName = stationOrder[(idx - 3) % 3];
    picks[sName].vols.push(eligible[idx]);
    idx++;
  }

  // Crew of Km5 is special — used for the confirm step below.
  let km5CrewRegId = null;

  for (const sName of stationOrder) {
    const stationId = stationIds[sName];
    if (picks[sName].crew) {
      await c.query(
        'INSERT INTO vol_station_assignment (station_id, registration_id, assignment_role, note, sort_order) VALUES (?, ?, ?, ?, 0)',
        [stationId, picks[sName].crew.id, 'crew', 'seed v1.6 — crew'],
      );
      console.log(`  [assign] ${sName} crew=${picks[sName].crew.full_name} reg_id=${picks[sName].crew.id}`);
      if (sName === 'Trạm Nước Km5') km5CrewRegId = picks[sName].crew.id;
    }
    for (const v of picks[sName].vols) {
      await c.query(
        'INSERT INTO vol_station_assignment (station_id, registration_id, assignment_role, note, sort_order) VALUES (?, ?, ?, ?, 1)',
        [stationId, v.id, 'volunteer', 'seed v1.6 — volunteer'],
      );
      console.log(`  [assign] ${sName} volunteer=${v.full_name} reg_id=${v.id}`);
    }
  }

  // ---- crew confirms Km5 ----
  if (km5CrewRegId) {
    const km5NuocAllocId = allocIds['Trạm Nước Km5__Nước (ly)'];
    const km5ChuoiAllocId = allocIds['Trạm Nước Km5__Chuối'];

    // Only confirm if not already locked.
    const [[nuocRow]] = await c.query('SELECT is_locked, allocated_qty FROM vol_supply_allocation WHERE id=?', [km5NuocAllocId]);
    if (!nuocRow.is_locked) {
      await c.query(
        `UPDATE vol_supply_allocation
            SET confirmed_qty=?, confirmed_at=NOW(), confirmed_by_registration_id=?,
                confirmation_note=?, is_locked=TRUE
          WHERE id=?`,
        [980, km5CrewRegId, 'Ly rách 20 cái', km5NuocAllocId],
      );
      console.log(`  [confirm] Km5 Nước alloc=${km5NuocAllocId} allocated=1000 confirmed=980 shortage=20 LOCKED`);
    } else {
      console.log(`  [confirm] Km5 Nước alloc=${km5NuocAllocId} already locked — skip`);
    }

    const [[chuoiRow]] = await c.query('SELECT is_locked FROM vol_supply_allocation WHERE id=?', [km5ChuoiAllocId]);
    if (!chuoiRow.is_locked) {
      await c.query(
        `UPDATE vol_supply_allocation
            SET confirmed_qty=200, confirmed_at=NOW(), confirmed_by_registration_id=?,
                confirmation_note='Đủ', is_locked=TRUE
          WHERE id=?`,
        [km5CrewRegId, km5ChuoiAllocId],
      );
      console.log(`  [confirm] Km5 Chuối alloc=${km5ChuoiAllocId} allocated=200 confirmed=200 match LOCKED`);
    } else {
      console.log(`  [confirm] Km5 Chuối alloc=${km5ChuoiAllocId} already locked — skip`);
    }

    // ---- supplement round 1 on Km5 Nước ----
    // Upsert by (allocation_id, round_number=1).
    const [existingSupp] = await c.query(
      'SELECT id FROM vol_supply_supplement WHERE allocation_id=? AND round_number=1 LIMIT 1',
      [km5NuocAllocId],
    );
    let suppId;
    if (existingSupp.length) {
      suppId = existingSupp[0].id;
      console.log(`  [supp] reuse id=${suppId} round 1 on Km5 Nước`);
    } else {
      const [res] = await c.query(
        `INSERT INTO vol_supply_supplement
           (allocation_id, round_number, qty, note, created_by_role_id,
            confirmed_qty, confirmed_at, confirmed_by_registration_id, confirmation_note)
         VALUES (?, 1, 200, 'Bổ sung ca chiều', ?, 200, NOW(), ?, 'Đủ 200')`,
        [km5NuocAllocId, LEADER_ROLE, km5CrewRegId],
      );
      suppId = res.insertId;
      console.log(`  [supp] INSERT id=${suppId} round=1 Km5 Nước qty=200 confirmed=200 match`);
    }
  } else {
    console.log('  [confirm] no Km5 crew — skip crew confirm + supplement');
  }

  // ---- summary ----
  console.log('\n=== SUMMARY ===');
  const tables = [
    ['vol_station', `WHERE event_id=${EVENT_ID} AND role_id=${NON_LEADER_ROLE}`],
    ['vol_supply_item', `WHERE event_id=${EVENT_ID}`],
    ['vol_supply_plan', `WHERE event_id=${EVENT_ID} AND role_id=${NON_LEADER_ROLE}`],
    ['vol_supply_allocation', `WHERE station_id IN (${Object.values(stationIds).join(',')})`],
    ['vol_supply_supplement', `WHERE allocation_id IN (SELECT id FROM vol_supply_allocation WHERE station_id IN (${Object.values(stationIds).join(',')}))`],
    ['vol_station_assignment', `WHERE station_id IN (${Object.values(stationIds).join(',')})`],
  ];
  for (const [t, w] of tables) {
    const [rows] = await c.query(`SELECT COUNT(*) c FROM ${t} ${w}`);
    console.log(`  ${t.padEnd(26)}  ${rows[0].c}`);
  }

  // Verify sum allocations ≤ fulfilled per item
  console.log('\n=== ALLOCATION SUMS (role 3) ===');
  const [sumRows] = await c.query(
    `SELECT si.item_name,
            sp.requested_qty, sp.fulfilled_qty,
            COALESCE(SUM(sa.allocated_qty), 0) AS total_allocated
       FROM vol_supply_item si
       LEFT JOIN vol_supply_plan sp ON sp.item_id = si.id AND sp.role_id = ?
       LEFT JOIN vol_supply_allocation sa ON sa.item_id = si.id
                                         AND sa.station_id IN (SELECT id FROM vol_station WHERE role_id = ?)
      WHERE si.event_id = ?
   GROUP BY si.id, si.item_name, sp.requested_qty, sp.fulfilled_qty
   ORDER BY si.sort_order`,
    [NON_LEADER_ROLE, NON_LEADER_ROLE, EVENT_ID],
  );
  for (const row of sumRows) {
    console.log(`  ${row.item_name.padEnd(16)} requested=${row.requested_qty} fulfilled=${row.fulfilled_qty ?? 'NULL'} allocated_sum=${row.total_allocated}`);
  }

  // Handy tokens for QC
  if (km5CrewRegId) {
    const [[crewTok]] = await c.query('SELECT magic_token FROM vol_registration WHERE id=?', [km5CrewRegId]);
    console.log(`\n  km5_crew_reg_id    = ${km5CrewRegId}`);
    console.log(`  km5_crew_token     = ${crewTok.magic_token}`);
  }
  // Leader token for role 1 (QC leader-qr seeded earlier)
  const [[leaderTok]] = await c.query(
    "SELECT id, magic_token FROM vol_registration WHERE event_id=? AND role_id=? ORDER BY id DESC LIMIT 1",
    [EVENT_ID, LEADER_ROLE],
  );
  if (leaderTok) {
    console.log(`  leader_reg_id (role 1) = ${leaderTok.id}`);
    console.log(`  leader_token           = ${leaderTok.magic_token}`);
  }
  console.log(`  station_ids: ${JSON.stringify(stationIds)}`);
  console.log(`  item_ids:    ${JSON.stringify(itemIds)}`);

  await c.end();
  console.log('\n[seed] DONE');
}

main().catch((err) => { console.error(err); process.exit(1); });
