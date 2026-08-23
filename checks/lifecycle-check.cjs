// B-2/B-3/B-4 regression check. Drives the real server.js over real sockets
// against the RESP stub, asserting on state transitions rather than internals.
const path = require('path');
const assert = require('assert');
const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
const ioc = require(path.join(ROOT, 'client', 'node_modules', 'socket.io-client'));
const { createRedisStub } = require('./redis-stub.cjs');

const TOKEN = 'lifecycletoken0123456789abcdef01';
const PORT = 3997, REDIS_PORT = 6397;
const URL = `http://localhost:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// WATCHDOG: a hung await must report, not stall the run forever.
const watchdog = setTimeout(() => {
  console.log('TIMED OUT after 60s');
  process.exit(1);
}, 60000);
watchdog.unref();

const { server: stub } = createRedisStub();
let srv;
function finish(code, msg) {
  console.log(msg);
  if (srv) srv.kill();
  stub.close();
  setTimeout(() => process.exit(code), 200);
}

// Short phases so the whole check runs in seconds.
const COUNTDOWN = 400, BATTLE = 1200, OUTCOME = 5000;

function connect(auth) {
  const s = ioc(URL, { transports: ['websocket'], ...(auth ? { auth } : {}) });
  return new Promise(r => s.on('AUTH_STATE', () => r(s)));
}
function track(sock) {
  const states = [];
  sock.on('STATE_UPDATE', d => states.push(d.state));
  return states;
}
async function schedule(admin, a, b) {
  admin.emit('ADMIN_SCHEDULE_MATCH', { schoolA: a, schoolB: b, seriesCity: 'TEST', scheduledTime: '10:00' });
  const lists = await new Promise(r => admin.on('MATCH_LISTS_UPDATE', d => {
    if (d && d.scheduledMatches && d.scheduledMatches.length) r(d);
  }));
  return lists.scheduledMatches[lists.scheduledMatches.length - 1].id;
}

stub.listen(REDIS_PORT, async () => {
  srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: { ...process.env, ADMIN_TOKEN: TOKEN, PORT: String(PORT),
           REDIS_URL: `redis://127.0.0.1:${REDIS_PORT}`,
           COUNTDOWN_DURATION_MS: String(COUNTDOWN),
           BATTLE_DURATION_MS: String(BATTLE) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  srv.stderr.on('data', () => {});
  await sleep(2200);

  try {
    const admin = await connect({ adminToken: TOKEN });

    // ---- B-2: double ADMIN_START_COUNTDOWN must not restart a live battle ----
    const idA = await schedule(admin, 'SKUL A', 'SKUL B');
    admin.emit('ADMIN_START_SCHEDULED', { id: idA });
    await sleep(200);

    let starts = 0;
    admin.on('START_BATTLE', () => { starts++; });
    let rejected = 0;
    admin.on('ADMIN_REJECTED', () => { rejected++; });

    admin.emit('ADMIN_START_COUNTDOWN');
    admin.emit('ADMIN_START_COUNTDOWN'); // immediate double-click
    await sleep(COUNTDOWN + 300);
    admin.emit('ADMIN_START_COUNTDOWN'); // again, now mid-battle
    await sleep(300);

    assert.strictEqual(starts, 1, `B-2: battle started ${starts}x, expected exactly 1`);
    assert.ok(rejected >= 2, `B-2: expected the 2 extra clicks rejected, got ${rejected}`);
    console.log(`  B-2 double-start guard: 3 clicks -> ${starts} battle, ${rejected} rejected`);

    // ---- B-4: player count is exact the moment a socket drops ----
    const players = [];
    for (let i = 0; i < 4; i++) players.push(await connect());
    for (const p of players) p.emit('USER_JOIN_SESSION', { selectedSchoolCard: 'SKUL A' });
    const counts = [];
    admin.on('PLAYER_COUNT_UPDATE', c => counts.push(c.kicker));
    await sleep(250);
    assert.strictEqual(counts[counts.length - 1], 4, `B-4: expected 4 joined, saw ${counts[counts.length - 1]}`);

    players[0].disconnect();
    // A 60ms window: the old code needed 100ms+ to report, the new code is synchronous.
    await sleep(60);
    assert.strictEqual(counts[counts.length - 1], 3,
      `B-4: count should drop to 3 within 60ms, saw ${counts[counts.length - 1]}`);
    console.log(`  B-4 disconnect count: 4 -> ${counts[counts.length - 1]} within 60ms (no setTimeout)`);

    // ---- B-3: reset during the outcome animation must not later hop to LEADERBOARD ----
    const states = track(admin);
    admin.emit('ADMIN_STOP_BATTLE');
    await sleep(300);
    assert.ok(states.includes('STATE_OUTCOME_ANIMATION'), 'B-3: expected OUTCOME after stop');

    admin.emit('ADMIN_RESET');
    await sleep(200);
    assert.strictEqual(states[states.length - 1], 'STATE_ADMIN_SETUP', 'B-3: reset should land in SETUP');

    // Wait past the 5s outcome timer: the stale hop must never arrive.
    states.length = 0;
    await sleep(OUTCOME + 600);
    assert.ok(!states.includes('STATE_LEADERBOARD'),
      `B-3: stale outcome timer fired after reset -> ${states.join(',')}`);
    console.log(`  B-3 outcome timer: reset during animation, no LEADERBOARD hop after ${OUTCOME + 600}ms`);

    // ---- B-2 follow-up: a fresh match after reset still works end to end ----
    const idB = await schedule(admin, 'SKUL C', 'SKUL D');
    admin.emit('ADMIN_START_SCHEDULED', { id: idB });
    await sleep(200);
    starts = 0;
    admin.emit('ADMIN_START_COUNTDOWN');
    await sleep(COUNTDOWN + 300);
    assert.strictEqual(starts, 1, 'B-2: fresh match after reset must still start exactly once');
    console.log('  B-2 recovery: new match after reset starts cleanly');

    finish(0, 'Lifecycle check PASSED.');
  } catch (err) {
    finish(1, 'Lifecycle check FAILED: ' + err.message);
  }
});
