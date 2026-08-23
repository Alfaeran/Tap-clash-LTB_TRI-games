// The standings used to be pushed only at the OUTCOME->LEADERBOARD hop, so a
// client that connected afterwards (refresh, /leaderboard deep link, the
// KLASEMEN button) rendered "BELUM ADA DATA". Assert a late socket gets them.
const path = require('path');
const assert = require('assert');
const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
const ioc = require(path.join(ROOT, 'client', 'node_modules', 'socket.io-client'));
const { createRedisStub } = require('./redis-stub.cjs');

const TOKEN = 'lbconntoken0123456789abcdef01234';
const PORT = 3995, REDIS_PORT = 6395;
const URL = `http://localhost:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const watchdog = setTimeout(() => { console.log('TIMED OUT after 60s'); process.exit(1); }, 60000);
watchdog.unref();

const { server: stub } = createRedisStub();
let srv;
function finish(code, msg) {
  console.log(msg);
  if (srv) srv.kill();
  stub.close();
  setTimeout(() => process.exit(code), 200);
}

const connect = auth => new Promise(r => {
  const s = ioc(URL, { transports: ['websocket'], forceNew: true, ...(auth ? { auth } : {}) });
  s.on('AUTH_STATE', () => r(s));
});

stub.listen(REDIS_PORT, async () => {
  try {
    srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
      cwd: ROOT,
      env: { ...process.env, ADMIN_TOKEN: TOKEN, PORT: String(PORT),
             REDIS_URL: `redis://127.0.0.1:${REDIS_PORT}`,
             COUNTDOWN_DURATION_MS: '300', BATTLE_DURATION_MS: '800' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    srv.stdout.on('data', () => {});
    srv.stderr.on('data', () => {});
    await sleep(2200);

    const admin = await connect({ adminToken: TOKEN });
    admin.emit('ADMIN_SCHEDULE_MATCH', { schoolA: 'SKUL A', schoolB: 'SKUL B', seriesCity: 'JOGJA', scheduledTime: '10:00' });
    const lists = await new Promise(r => admin.on('MATCH_LISTS_UPDATE', d => {
      if (d && d.scheduledMatches && d.scheduledMatches.length) r(d);
    }));
    const id = lists.scheduledMatches[0].id;

    admin.emit('ADMIN_START_SCHEDULED', { id });
    await sleep(200);
    admin.emit('ADMIN_START_COUNTDOWN');
    await new Promise(r => admin.on('START_BATTLE', r));
    const p = await connect();
    for (let i = 0; i < 6; i++) { p.emit('TAP_BATCH', { matchId: id, team: 'A', count: 25 }); await sleep(70); }
    await new Promise(r => admin.on('MATCH_END', r));

    // A socket that arrives AFTER the match ended must still get the standings.
    const late = ioc(URL, { transports: ['websocket'], forceNew: true });
    const board = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('no LEADERBOARD_DATA within 5s of connecting')), 5000);
      late.on('LEADERBOARD_DATA', d => { clearTimeout(t); resolve(d.leaderboard); });
    });

    assert.ok(Array.isArray(board), 'leaderboard payload should be an array');
    assert.strictEqual(board.length, 2, `expected 2 schools, got ${board.length}`);
    assert.strictEqual(board[0].school, 'SKUL A', `winner should top the board, got ${board[0].school}`);
    assert.strictEqual(board[0].points, 3, `winner should have 3 points, got ${board[0].points}`);
    console.log(`  late socket received ${board.length} schools on connect`);

    finish(0, 'Leaderboard-on-connect check PASSED.');
  } catch (err) {
    finish(1, 'Leaderboard-on-connect check FAILED: ' + err.message);
  }
});
