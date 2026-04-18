/**
 * seed-v14-test-data.js — Populate vol_registration with rows covering
 * every v1.4 state + suspicious flag + a leader for the portal.
 *
 * Target event_id=1, base role_id=3 (TNV team Nước) for non-leader rows,
 * role_id=1 (Leader Team nước, is_leader_role=TRUE) for the leader row.
 *
 * Usage: node scripts/seed-v14-test-data.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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

const TAG = 'qc-v14';
const TS = Date.now();
const EVENT_ID = 1;
const NON_LEADER_ROLE = 3; // TNV team Nước
const LEADER_ROLE = 1;     // Leader Team nước

function tok() {
  return crypto.randomBytes(32).toString('hex');
}

function ts(i) { return `${TAG}-${TS}-${i}`; }

const now = new Date();
const in30d = new Date(now.getTime() + 30 * 86400 * 1000);
const minus30min = new Date(now.getTime() - 30 * 60 * 1000);
const minus3h    = new Date(now.getTime() - 3 * 3600 * 1000);

// Each row fully specifies the shape for this seed — variations are only
// the status/checkin/completion fields.
function row({
  roleId = NON_LEADER_ROLE,
  label,
  status,
  contract_status = 'not_sent',
  qr_code = null,
  checked_in_at = null,
  suspicious = 0,
  completed_by = null,
  completed_at = null,
  rejection_reason = null,
  payment_status = 'pending',
  actual_working_days = null,
  snapshot_daily_rate = null,
  snapshot_working_days = null,
}) {
  return {
    role_id: roleId,
    event_id: EVENT_ID,
    full_name: `QC ${label} ${TS}`,
    email: `qc.${label.replace(/\s+/g, '.').toLowerCase()}.${TS}@5bib.test`,
    phone: `09${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
    form_data: JSON.stringify({ seed: TAG, label }),
    shirt_size: 'M',
    status,
    magic_token: tok(),
    magic_token_expires: in30d,
    contract_status,
    qr_code,
    checked_in_at,
    suspicious_checkin: suspicious,
    completion_confirmed_at: completed_at,
    completion_confirmed_by: completed_by,
    rejection_reason,
    payment_status,
    actual_working_days,
    snapshot_daily_rate,
    snapshot_working_days,
    checkin_method: checked_in_at ? 'qr_scan' : null,
  };
}

const rows = [
  row({ label: 'pending-1', status: 'pending_approval' }),
  row({ label: 'pending-2', status: 'pending_approval' }),
  row({ label: 'approved',  status: 'approved' }),
  row({ label: 'contract-sent',   status: 'contract_sent',   contract_status: 'sent' }),
  row({ label: 'contract-signed', status: 'contract_signed', contract_status: 'signed' }),
  row({ label: 'qr-sent',   status: 'qr_sent',   contract_status: 'signed', qr_code: `QR-${TS}-qrsent` }),
  row({ label: 'checkedin-fresh', status: 'checked_in', contract_status: 'signed', qr_code: `QR-${TS}-ckf`, checked_in_at: minus30min }),
  row({ label: 'checkedin-old',   status: 'checked_in', contract_status: 'signed', qr_code: `QR-${TS}-cko`, checked_in_at: minus3h }),
  row({ label: 'completed', status: 'completed', contract_status: 'signed',
        qr_code: `QR-${TS}-done`, checked_in_at: minus3h,
        completed_at: new Date(now.getTime() - 3600 * 1000),
        completed_by: 'leader', actual_working_days: 1,
        snapshot_daily_rate: '500000', snapshot_working_days: 1,
        payment_status: 'pending' }),
  row({ label: 'completed-suspicious', status: 'completed', contract_status: 'signed',
        qr_code: `QR-${TS}-sus`, checked_in_at: minus30min,
        completed_at: now, suspicious: 1,
        completed_by: 'leader', actual_working_days: 1,
        snapshot_daily_rate: '500000', snapshot_working_days: 1,
        payment_status: 'pending' }),
  row({ label: 'waitlisted', status: 'waitlisted' }),
  row({ label: 'rejected',   status: 'rejected',  rejection_reason: 'QC seed: not a fit for role' }),
  row({ label: 'cancelled',  status: 'cancelled' }),
  // Leader row, post-qr so token works
  row({ roleId: LEADER_ROLE, label: 'leader-qr', status: 'qr_sent', contract_status: 'signed', qr_code: `QR-${TS}-leader` }),
];

async function main() {
  const env = loadEnv();
  const c = await mysql.createConnection({
    host: env.VOLUNTEER_DB_HOST,
    port: Number(env.VOLUNTEER_DB_PORT),
    user: env.VOLUNTEER_DB_USER,
    password: env.VOLUNTEER_DB_PASS,
    database: env.VOLUNTEER_DB_NAME,
  });

  const insertedTokens = [];
  const insertedIds = [];
  for (const r of rows) {
    const cols = Object.keys(r);
    const placeholders = cols.map(() => '?').join(', ');
    const sql = `INSERT INTO vol_registration (${cols.join(', ')}) VALUES (${placeholders})`;
    const vals = cols.map((k) => r[k]);
    const [res] = await c.execute(sql, vals);
    insertedIds.push(res.insertId);
    insertedTokens.push({ id: res.insertId, label: r.form_data, email: r.email, magic_token: r.magic_token, status: r.status, role_id: r.role_id });
    console.log(`[seed] inserted id=${res.insertId} status=${r.status} role=${r.role_id} email=${r.email}`);
  }

  // Final distribution
  const [dist] = await c.query('SELECT status, COUNT(*) c FROM vol_registration WHERE event_id = ? GROUP BY status ORDER BY c DESC', [EVENT_ID]);
  console.log('\n[seed] Final status distribution for event', EVENT_ID);
  for (const d of dist) console.log(`  ${d.status.padEnd(20)} ${d.c}`);

  // Leader token for downstream tests
  const leader = insertedTokens.find(t => t.role_id === LEADER_ROLE);
  const memberCheckedIn = insertedTokens.find(t => t.status === 'checked_in');
  console.log('\n[seed] HANDY TOKENS');
  console.log('  leader_token        =', leader?.magic_token);
  console.log('  leader_reg_id       =', leader?.id);
  console.log('  member_token (non-leader, qr_sent) =',
      insertedTokens.find(t => t.status === 'qr_sent' && t.role_id !== LEADER_ROLE)?.magic_token);
  console.log('  suspicious_reg_id   =',
      insertedTokens.find(t => t.label.includes('suspicious'))?.id);
  console.log('  pending_reg_ids     =',
      insertedTokens.filter(t => t.status === 'pending_approval').map(t => t.id).join(','));
  console.log('  approved_reg_id     =',
      insertedTokens.find(t => t.status === 'approved')?.id);
  console.log('  checked_in_reg_id   =', memberCheckedIn?.id);
  console.log('  completed_suspicious_reg_id =',
      insertedTokens.find(t => t.label.includes('completed-suspicious'))?.id);

  await c.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
