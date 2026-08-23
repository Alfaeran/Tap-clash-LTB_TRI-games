// MV-3 check: ADMIN_DELETE_SCHEDULED removes exactly the named schedule, is
// rejected for a non-admin socket, and the removal survives a restart (i.e. it
// was persisted, not just broadcast).
const path = require('path');
const assert = require('assert');
const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
const ioc = require(path.join(ROOT, 'client', 'node_modules', 'socket.io-client'));
const { createRedisStub } = require('./redis-stub.cjs');

const TOKEN = 'deletetoken0123456789abcdef01234';
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

function boot() {
  srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: { ...process.env, ADMIN_TOKEN: TOKEN, PORT: String(PORT),
           REDIS_URL: `redis://127.0.0.1:${REDIS_PORT}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  srv.stdout.on('data', () => {});
  srv.stderr.on('data', () => {});
}
function connect(auth) {
  const s = ioc(URL, { transports: ['websocket'], forceNew: true, ...(auth ? { auth } : {}) });
  track(s);
  return new Promise(r => s.on('AUTH_STATE', () => r(s)));
}
// The server pushes MATCH_LISTS_UPDATE the moment it changes, so a listener
// attached after the fact misses it. Keep the latest payload per socket and poll
// that instead of racing the event.
const latest = new WeakMap();
function track(sock) {
  sock.on('MATCH_LISTS_UPDATE', d => latest.set(sock, d));
  return sock;
}
async function listsWhen(sock, pred, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const d = latest.get(sock);
    if (d && Array.isArray(d.scheduledMatches) && pred(d)) return d;
    if (Date.now() > deadline) {
      throw new Error(`listsWhen timed out; last seen ${d ? d.scheduledMatches.length : 'none'}`);
    }
    await sleep(50);
  }
}

stub.listen(REDIS_PORT, async () => {
  try {
    boot();
    await sleep(2200);
    const admin = await connect({ adminToken: TOKEN }); 

    for (const [a, b, t] of [['A1', 'B1', '10:00'], ['A2', 'B2', '11:00'], ['A3', 'B3', '12:00']]) {
      admin.emit('ADMIN_SCHEDULE_MATCH', { schoolA: a, schoolB: b, seriesCity: 'JOGJA', scheduledTime: t });
      await sleep(80);
    }
    const three = await listsWhen(admin, d => d.scheduledMatches.length === 3); 
    const victim = three.scheduledMatches[1];

    // A socket without the token must not be able to delete.
    const guest = await connect(null); 
    guest.emit('ADMIN_DELETE_SCHEDULED', { id: victim.id });
    await sleep(400);
    guest.close();

    // Unknown id is a no-op, not a crash or a silent wipe.
    admin.emit('ADMIN_DELETE_SCHEDULED', { id: 'does-not-exist' });
    await sleep(300);

    admin.emit('ADMIN_SCHEDULE_MATCH', { schoolA: 'A4', schoolB: 'B4', seriesCity: 'JOGJA', scheduledTime: '13:00' });
    const still = await listsWhen(admin, d => d.scheduledMatches.length >= 4);
    
    assert.strictEqual(still.scheduledMatches.length, 4,
      `guest delete or unknown id changed the list: ${still.scheduledMatches.length}`);
    console.log('  unauthorized delete + unknown id: list untouched (4 remain)');

    admin.emit('ADMIN_DELETE_SCHEDULED', { id: victim.id });
    const after = await listsWhen(admin, d => d.scheduledMatches.length === 3);
    assert.ok(!after.scheduledMatches.some(m => m.id === victim.id), 'victim still present');
    assert.deepStrictEqual(
      after.scheduledMatches.map(m => m.schoolA), ['A1', 'A3', 'A4'],
      'wrong row removed: ' + after.scheduledMatches.map(m => m.schoolA).join(','));
    console.log('  admin delete removed exactly the target row (A1,A3,A4 remain)');

    // Restart against the same Redis: the deletion must have been persisted.
    srv.kill('SIGKILL');
    await sleep(500);
    boot();
    await sleep(2200);
    const admin2 = await connect({ adminToken: TOKEN });
    const restored = await listsWhen(admin2, d => true);
    assert.strictEqual(restored.scheduledMatches.length, 3, 'deletion was not persisted');
    assert.ok(!restored.scheduledMatches.some(m => m.id === victim.id), 'victim came back after restart');
    console.log('  deletion survived a restart (3 scheduled restored)');
    admin.close(); admin2.close();

    finish(0, 'MV-3 delete-schedule check passed.');
  } catch (err) {
    finish(1, 'FAILED: ' + (err && err.message));
  }
});
