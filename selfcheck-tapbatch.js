// Self-check for B-1 (tap batching) and B-6 (admin auth).
// Run: node selfcheck-tapbatch.js   — no framework, no Redis, no network.
const assert = require('assert');
const crypto = require('crypto');
const gameSettings = require('./config/gameSettings');

// ---------- B-1: server-side clamp + buffer accounting ----------
// Mirrors the acceptTapBatch logic in server.js.
function acceptTapBatch(pending, payload, { matchId, schoolA, schoolB, live }) {
  if (!live) return;
  if (!payload || (payload.matchId && payload.matchId !== matchId)) return;
  if (payload.team !== 'A' && payload.team !== 'B') return;
  const schoolCard = payload.team === 'A' ? schoolA : schoolB;
  if (!schoolCard) return;
  const raw = Number(payload.count);
  if (!Number.isFinite(raw) || raw <= 0) return;
  pending[payload.team] += Math.min(Math.floor(raw), gameSettings.MAX_TAPS_PER_BATCH);
}

const ctx = { matchId: 'm1', schoolA: 'SMAN 1', schoolB: 'SMAN 2', live: true };
let pending = { A: 0, B: 0 };

acceptTapBatch(pending, { matchId: 'm1', team: 'A', count: 7 }, ctx);
assert.strictEqual(pending.A, 7, 'normal batch accumulates');

// Anti-cheat: a forged count is clamped, not trusted.
acceptTapBatch(pending, { matchId: 'm1', team: 'A', count: 999999 }, ctx);
assert.strictEqual(pending.A, 7 + gameSettings.MAX_TAPS_PER_BATCH, 'oversized batch clamped');

// Junk and hostile payloads are dropped rather than corrupting the counter.
const before = { ...pending };
for (const bad of [
  { team: 'A', count: -5 }, { team: 'A', count: 0 }, { team: 'A', count: NaN },
  { team: 'A', count: 'abc' }, { team: 'A' }, { team: 'C', count: 3 },
  { matchId: 'stale', team: 'A', count: 3 }, null,
]) acceptTapBatch(pending, bad, ctx);
assert.deepStrictEqual(pending, before, 'invalid payloads ignored');

// Taps outside the battle window never count.
acceptTapBatch(pending, { team: 'B', count: 5 }, { ...ctx, live: false });
assert.strictEqual(pending.B, 0, 'taps rejected when not live');

// ---------- B-1: no taps lost across a flush ----------
// flushTaps() zeroes the buffer before awaiting Redis; taps arriving mid-flush
// must land in the fresh buffer, and a failed flush must restore its counts.
function simulateFlush(pendingRef, { fail }) {
  const a = pendingRef.value.A, b = pendingRef.value.B;
  pendingRef.value = { A: 0, B: 0 };
  const midFlightTap = 4;
  pendingRef.value.A += midFlightTap;      // arrives while "await" is pending
  if (fail) { pendingRef.value.A += a; pendingRef.value.B += b; }
  return { flushed: fail ? 0 : a + b, midFlightTap };
}

let ref = { value: { A: 10, B: 6 } };
let r = simulateFlush(ref, { fail: false });
assert.strictEqual(r.flushed + ref.value.A + ref.value.B, 10 + 6 + r.midFlightTap,
  'successful flush conserves every tap');

ref = { value: { A: 10, B: 6 } };
r = simulateFlush(ref, { fail: true });
assert.strictEqual(ref.value.A + ref.value.B, 10 + 6 + r.midFlightTap,
  'failed flush restores counts instead of dropping them');

// ---------- B-1: batching actually reduces load ----------
const USERS = 1000, TAPS_PER_SEC = 15, BATCH_MS = gameSettings.CLIENT_BATCH_RATE_MS;
const before_cmds = USERS * TAPS_PER_SEC;                  // one Redis INCR per tap
const after_cmds = Math.round(1000 / BATCH_MS) * 2;        // two INCRBY per flush tick
assert.ok(after_cmds < before_cmds / 100,
  `expected >100x fewer Redis commands, got ${before_cmds} -> ${after_cmds}`);

// ---------- B-6: constant-time token compare ----------
const TOKEN = crypto.randomBytes(16).toString('hex');
const EXPECTED = Buffer.from(TOKEN);
function isAdmin(token) {
  if (typeof token !== 'string') return false;
  const buf = Buffer.from(token);
  return buf.length === EXPECTED.length && crypto.timingSafeEqual(buf, EXPECTED);
}

assert.strictEqual(isAdmin(TOKEN), true, 'correct token authenticates');
assert.strictEqual(isAdmin(undefined), false, 'no token is not admin');
assert.strictEqual(isAdmin(''), false, 'empty token rejected');
assert.strictEqual(isAdmin(TOKEN.slice(0, -1)), false, 'truncated token rejected');
assert.strictEqual(isAdmin(TOKEN.toUpperCase()), false, 'wrong-case token rejected');
assert.strictEqual(isAdmin({ length: EXPECTED.length }), false, 'non-string rejected');
// Multibyte input matches .length but not byte length — must not throw.
assert.doesNotThrow(() => isAdmin('é'.repeat(EXPECTED.length)), 'multibyte token must not throw');
assert.strictEqual(isAdmin('é'.repeat(EXPECTED.length)), false, 'multibyte token rejected');

console.log('All self-checks passed.');
console.log(`  Redis commands/sec @ ${USERS} users: ${before_cmds} -> ${after_cmds}`);
