// B-5 / B-7 check. Runs a full match, kills the server, restarts it against the
// same Redis, and asserts the schedule and history survived — plus that the
// leaderboard is built without a KEYS scan.
const path = require('path');
const assert = require('assert');
const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
const ioc = require(path.join(ROOT, 'client', 'node_modules', 'socket.io-client'));
const { createRedisStub } = require('./redis-stub.cjs');

const TOKEN = 'persisttoken0123456789abcdef0123';
const PORT = 3996, REDIS_PORT = 6396;
const URL = `http://localhost:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// WATCHDOG: a hung await must report, not stall the run forever.
const watchdog = setTimeout(() => {
  console.log('TIMED OUT after 60s');
  process.exit(1);
}, 60000);
watchdog.unref();
const COUNTDOWN = 300, BATTLE = 800;

const { server: stub, log } = createRedisStub();
let srv;
function finish(code, msg) {
  console.log(msg);
  if (srv) srv.kill();
  stub.close();
  setTimeout(() => process.exit(code), 200);
}

function boot() {
  srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: { ...process.env, ADMIN_TOKEN: TOKEN, PORT: String(PORT),
           REDIS_URL: `redis://127.0.0.1:${REDIS_PORT}`,
           COUNTDOWN_DURATION_MS: String(COUNTDOWN),
           BATTLE_DURATION_MS: String(BATTLE) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  srv.stdout.on('data', d => { out += d; });
  srv.stderr.on('data', () => {});
  return () => out;
}
function connect(auth) {
  const s = ioc(URL, { transports: ['websocket'], forceNew: true, ...(auth ? { auth } : {}) });
  return new Promise(r => s.on('AUTH_STATE', () => r(s)));
}
function firstLists(sock) {
  return new Promise(r => sock.once('MATCH_LISTS_UPDATE', d => r(d)));
}

stub.listen(REDIS_PORT, async () => {
  try {
    let readOut = boot();
    await sleep(2200); let admin = await connect({ adminToken: TOKEN });

    // Two scheduled matches; play one to completion.
    admin.emit('ADMIN_SCHEDULE_MATCH', { schoolA: 'SKUL A', schoolB: 'SKUL B', seriesCity: 'JOGJA', scheduledTime: '10:00' });
    await sleep(120);
    admin.emit('ADMIN_SCHEDULE_MATCH', { schoolA: 'SKUL C', schoolB: 'SKUL D', seriesCity: 'JOGJA', scheduledTime: '11:00' });
    const lists = await new Promise(r => admin.on('MATCH_LISTS_UPDATE', d => {
      if (d && d.scheduledMatches && d.scheduledMatches.length === 2) r(d);
    }));
    const playId = lists.scheduledMatches[0].id;

    admin.emit('ADMIN_START_SCHEDULED', { id: playId });
    await sleep(200);
    admin.emit('ADMIN_START_COUNTDOWN');
    await new Promise(r => admin.on('START_BATTLE', r));

    const p = await connect();
    for (let i = 0; i < 10; i++) { p.emit('TAP_BATCH', { matchId: playId, team: 'A', count: 20 }); await sleep(60); }
    await new Promise(r => admin.on('MATCH_END', r));

    // ---- B-5: leaderboard must come back without a KEYS scan ----
    log.length = 0;
    const lb = await new Promise(r => admin.on('LEADERBOARD_DATA', d => r(d.leaderboard)));
    const keysUsed = log.filter(c => c === 'KEYS').length;
    assert.strictEqual(keysUsed, 0, `B-5: leaderboard still issued ${keysUsed} KEYS scans`);
    assert.ok(log.includes('SMEMBERS'), 'B-5: expected SMEMBERS roster lookup');
    assert.strictEqual(lb.length, 2, `B-5: expected 2 schools on the board, got ${lb.length}`);
    assert.strictEqual(lb[0].school, 'SKUL A', `B-5: winner should top the board, got ${lb[0].school}`);
    assert.strictEqual(lb[0].points, 3, `B-5: winner should have 3 points, got ${lb[0].points}`);
    console.log(`  B-5 leaderboard: ${lb.length} schools via SMEMBERS+pipeline, 0 KEYS scans`);

    // ---- B-7: state must survive a hard restart ----
    const before = await firstLists(await connect());
    assert.strictEqual(before.scheduledMatches.length, 1, 'setup: 1 match should remain scheduled');
    assert.strictEqual(before.completedMatches.length, 1, 'setup: 1 match should be completed');

    srv.kill('SIGKILL');
    await sleep(600);
    readOut = boot();
    await sleep(2200);
    const after = await firstLists(await connect());
    assert.strictEqual(after.scheduledMatches.length, 1,
      `B-7: schedule lost on restart (${after.scheduledMatches.length} left)`);
    assert.strictEqual(after.scheduledMatches[0].schoolA, 'SKUL C', 'B-7: wrong match survived');
    assert.strictEqual(after.completedMatches.length, 1,
      `B-7: history lost on restart (${after.completedMatches.length} left)`);
    assert.strictEqual(after.completedMatches[0].winnerSchool, 'SKUL A', 'B-7: wrong result restored');
    assert.ok(/\[restore\] 1 scheduled, 1 completed/.test(readOut()),
      'B-7: server did not log a restore on boot');
    console.log('  B-7 restart: 1 scheduled + 1 completed survived SIGKILL');

    finish(0, 'Persistence check PASSED.');
  } catch (err) {
    finish(1, 'Persistence check FAILED: ' + err.message);
  }
});
