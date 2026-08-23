// Minimal RESP server: just enough Redis for the lifecycle/tap checks to run
// against the real server.js without Docker. Logs every command so tests can
// assert on what the server actually issued.
const net = require('net');

function createRedisStub() {
  const store = new Map();   // string keys
  const hashes = new Map();  // hash keys -> Map
  const zsets = new Map();   // zset keys -> Map(member -> score)
  const sets = new Map();    // set keys -> Set
  const log = [];

  const bulk = (v) => (v === null || v === undefined ? '$-1\r\n' : `$${Buffer.byteLength(String(v))}\r\n${v}\r\n`);
  const arr = (items) => `*${items.length}\r\n` + items.map(bulk).join('');

  // Incremental parser: a pipeline can be split across TCP packets, and a
  // per-chunk parser drops the partial tail, leaving ioredis waiting on a reply
  // that never comes. Buffer until each command is whole.
  function makeParser() {
    let buf = Buffer.alloc(0);
    return function feed(chunk) {
      buf = Buffer.concat([buf, chunk]);
      const out = [];
      for (;;) {
        const consumed = tryOne(buf, out);
        if (consumed === 0) break;
        buf = buf.subarray(consumed);
      }
      return out;
    };
  }

  // Returns bytes consumed, or 0 if the buffer holds no complete command yet.
  function tryOne(buf, out) {
    const CRLF = '\r\n';
    const lineEnd = (from) => buf.indexOf(CRLF, from);
    if (buf.length === 0) return 0;
    if (buf[0] !== 0x2a /* * */) {
      const e = lineEnd(0);                    // inline command
      if (e === -1) return 0;
      const args = buf.subarray(0, e).toString().trim().split(/\s+/).filter(Boolean);
      if (args.length) out.push(args);
      return e + 2;
    }
    let p = lineEnd(0);
    if (p === -1) return 0;
    const n = parseInt(buf.subarray(1, p).toString(), 10);
    p += 2;
    const args = [];
    for (let k = 0; k < n; k++) {
      const h = lineEnd(p);
      if (h === -1) return 0;
      const len = parseInt(buf.subarray(p + 1, h).toString(), 10);
      const start = h + 2;
      if (buf.length < start + len + 2) return 0;
      args.push(buf.subarray(start, start + len).toString());
      p = start + len + 2;
    }
    out.push(args);
    return p;
  }

  const hash = (k) => { if (!hashes.has(k)) hashes.set(k, new Map()); return hashes.get(k); };
  const zset = (k) => { if (!zsets.has(k)) zsets.set(k, new Map()); return zsets.get(k); };
  const set = (k) => { if (!sets.has(k)) sets.set(k, new Set()); return sets.get(k); };

  function run(args) {
    const cmd = (args[0] || '').toUpperCase();
    log.push(cmd);
    switch (cmd) {
      case 'INCRBY': { const v = Number(store.get(args[1]) || 0) + parseInt(args[2], 10); store.set(args[1], v); return `:${v}\r\n`; }
      case 'INCR':   { const v = Number(store.get(args[1]) || 0) + 1; store.set(args[1], v); return `:${v}\r\n`; }
      case 'SET':    store.set(args[1], args[2]); return '+OK\r\n';
      case 'GET':    return bulk(store.has(args[1]) ? store.get(args[1]) : null);
      case 'DEL':    { let n = 0; for (const k of args.slice(1)) { if (store.delete(k)) n++; if (hashes.delete(k)) n++; if (zsets.delete(k)) n++; } return `:${n}\r\n`; }
      case 'HINCRBY': { const h = hash(args[1]); const v = (parseInt(h.get(args[2]) || 0, 10)) + parseInt(args[3], 10); h.set(args[2], String(v)); return `:${v}\r\n`; }
      case 'HSET':   { const h = hash(args[1]); for (let i = 2; i < args.length; i += 2) h.set(args[i], args[i + 1]); return `:1\r\n`; }
      case 'HGET':   return bulk(hash(args[1]).get(args[2]) ?? null);
      case 'HGETALL': { const flat = []; for (const [k, v] of hash(args[1])) flat.push(k, v); return arr(flat); }
      case 'ZADD':   { const z = zset(args[1]); for (let i = 2; i < args.length; i += 2) z.set(args[i + 1], parseFloat(args[i])); return ':1\r\n'; }
      case 'ZRANGE': case 'ZREVRANGE': {
        const z = zset(args[1]);
        let members = [...z.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
        if (cmd === 'ZRANGE' && !args.includes('REV')) members.reverse();
        const withScores = args.some(a => String(a).toUpperCase() === 'WITHSCORES');
        const flat = [];
        for (const [m, sc] of members) { flat.push(m); if (withScores) flat.push(String(sc)); }
        return arr(flat);
      }
      case 'SADD':   { const st = set(args[1]); let n = 0; for (const m of args.slice(2)) { if (!st.has(m)) { st.add(m); n++; } } return `:${n}\r\n`; }
      case 'SMEMBERS': return arr([...set(args[1])]);
      case 'SCARD':  return `:${set(args[1]).size}\r\n`;
      case 'MGET':   return arr(args.slice(1).map(k => (store.has(k) ? store.get(k) : null)));
      case 'ZCARD':  return `:${zset(args[1]).size}\r\n`;
      case 'KEYS': {
        const SPECIAL = '.+?^${}()|[]' + String.fromCharCode(92);
        const esc = [...String(args[1])]
          .map(c => (c === '*' ? '.*' : SPECIAL.includes(c) ? String.fromCharCode(92) + c : c))
          .join('');
        const re = new RegExp('^' + esc + '$');
        return arr([...store.keys(), ...hashes.keys(), ...zsets.keys()].filter(k => re.test(k)));
      }
      case 'INFO':   return bulk('');
      case 'PING':   return '+PONG\r\n';
      default:       return '+OK\r\n';
    }
  }

  const server = net.createServer(sock => {
    const feed = makeParser();
    sock.on('data', chunk => {
      let reply = '';
      for (const args of feed(chunk)) reply += run(args);
      if (reply) sock.write(reply);
    });
    sock.on('error', () => {});
  });

  return { server, store, hashes, zsets, sets, log };
}

module.exports = { createRedisStub };
