// End-to-end check of the B-1 tap path against the real server.js.
// Redis is stubbed with a ~40-line RESP server so we can assert on the exact
// commands the server issues: batching is only real if INCRBY count stays flat
// while tap volume grows.
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const ioc = require(path.join(__dirname, 'client', 'node_modules', 'socket.io-client'));

const store = new Map();
const commandLog = [];

function parse(buf) { // minimal RESP array parser
  const parts = buf.toString().split('\r\n');
  const out = []; let i = 0;
  while (i < parts.length) {
    if (parts[i].startsWith('*')) {
      const n = parseInt(parts[i].slice(1), 10); i++;
      const args = [];
      for (let k = 0; k < n; k++) { i++; args.push(parts[i]); i++; }
      out.push(args);
    } else i++;
  }
  return out;
}

const redisStub = net.createServer(sock => {
  sock.on('data', chunk => {
    let reply = '';
    for (const args of parse(chunk)) {
      const cmd = (args[0] || '').toUpperCase();
      commandLog.push(cmd);
      if (cmd === 'INCRBY') {
        const v = (store.get(args[1]) || 0) + parseInt(args[2], 10);
        store.set(args[1], v); reply += `:${v}\r\n`;
      } else if (cmd === 'INCR') {
        const v = (store.get(args[1]) || 0) + 1;
        store.set(args[1], v); reply += `:${v}\r\n`;
      } else if (cmd === 'SET') { store.set(args[1], parseInt(args[2], 10)); reply += '+OK\r\n'; }
      else if (cmd === 'GET') {
        const v = store.get(args[1]);
        reply += v === undefined ? '$-1\r\n' : `$${String(v).length}\r\n${v}\r\n`;
      }
      else if (cmd === 'HINCRBY') { reply += ':1\r\n'; }
      else if (cmd === 'KEYS') { reply += '*0\r\n'; }
      else if (cmd === 'HGETALL') { reply += '*0\r\n'; }
      else if (cmd === 'INFO') { reply += '$0\r\n\r\n'; }
      else reply += '+OK\r\n';
    }
    sock.write(reply);
  });
  sock.on('error', () => {});
});

const TOKEN = 'testtoken0123456789abcdef01234567';
const PORT = 3998, REDIS_PORT = 6399;
let srv;
const cleanup = (code, msg) => {
  console.log(msg);
  if (srv) srv.kill();
  redisStub.close();
  setTimeout(() => process.exit(code), 200);
};

redisStub.listen(REDIS_PORT, async () => {
  srv = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    cwd: __dirname,
    env: { ...process.env, ADMIN_TOKEN: TOKEN, PORT: String(PORT),
           REDIS_URL: `redis://127.0.0.1:${REDIS_PORT}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let srvLog = '';
  srv.stdout.on('data', d => { srvLog += d; });
  srv.stderr.on('data', d => { srvLog += d; });

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await sleep(2500);

  const URL = `http://localhost:${PORT}`;
  const admin = ioc(URL, { transports: ['websocket'], auth: { adminToken: TOKEN } });
  await new Promise(r => admin.on('AUTH_STATE', r));

  admin.emit('ADMIN_SCHEDULE_MATCH', { schoolA: 'SKUL A', schoolB: 'SKUL B', seriesCity: 'TEST', scheduledTime: '10:00' });
  // The server also emits MATCH_LISTS_UPDATE on connect, so wait for a non-empty one.
  const lists = await new Promise(r => admin.on('MATCH_LISTS_UPDATE', d => {
    if (d && d.scheduledMatches && d.scheduledMatches.length) r(d);
  }));
  const matchId = lists.scheduledMatches[0].id;
  admin.emit('ADMIN_START_SCHEDULED', { id: matchId });
  await sleep(400);

  const players = [];
  for (let i = 0; i < 20; i++) players.push(ioc(URL, { transports: ['websocket'] }));
  await Promise.all(players.map(p => new Promise(r => p.on('AUTH_STATE', r))));

  admin.emit('ADMIN_START_COUNTDOWN');
  await new Promise(r => admin.on('START_BATTLE', r));
  console.log('  battle started');

  commandLog.length = 0; // count only what the battle itself issues

  // 20 players x 20 batches x 10 taps = 4000 taps
  const TAPS_PER_BATCH = 10, BATCHES = 20;
  for (let b = 0; b < BATCHES; b++) {
    for (const p of players) p.emit('TAP_BATCH', { matchId, team: 'A', count: TAPS_PER_BATCH });
    await sleep(100);
  }
  // One forged batch: a cheater claiming 100000 taps.
  players[0].emit('TAP_BATCH', { matchId, team: 'B', count: 100000 });
  await sleep(600);

  const expectedTaps = 20 * TAPS_PER_BATCH * BATCHES;
  const keyA = `match:${matchId}:school:SKUL A:taps`;
  const keyB = `match:${matchId}:school:SKUL B:taps`;
  const gotA = store.get(keyA) || 0, gotB = store.get(keyB) || 0;
  const writes = commandLog.filter(c => c === 'INCRBY' || c === 'INCR').length;
  const reads  = commandLog.filter(c => c === 'GET').length;

  console.log(`  taps sent: ${expectedTaps}  -> Redis team A: ${gotA}`);
  console.log(`  forged 100000 -> Redis team B: ${gotB} (clamped)`);
  console.log(`  Redis write commands: ${writes}   read commands during battle: ${reads}`);

  if (gotA !== expectedTaps) return cleanup(1, `FAIL: expected ${expectedTaps} taps, Redis has ${gotA}`);
  if (gotB !== 25) return cleanup(1, `FAIL: forged batch should clamp to 25, got ${gotB}`);
  if (writes >= expectedTaps / 10) return cleanup(1, `FAIL: expected batched writes, got ${writes} for ${expectedTaps} taps`);
  if (reads !== 0) return cleanup(1, `FAIL: broadcast tick should not read Redis, got ${reads} GETs`);

  console.log(`  batching ratio: ${expectedTaps} taps -> ${writes} Redis writes (${Math.round(expectedTaps/writes)}x reduction)`);
  cleanup(0, 'Tap-flow integration check PASSED.');
});
