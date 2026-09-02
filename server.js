const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Redis = require('ioredis');
const path = require('path');
const crypto = require('crypto');
const gameSettings = require('./config/gameSettings');

// B-6: admin auth. Without a token any client could emit ADMIN_RESET from DevTools.
// In production set ADMIN_TOKEN; in dev we generate one per run and print it.
const ADMIN_TOKEN = gameSettings.ADMIN_TOKEN || crypto.randomBytes(16).toString('hex');
if (!gameSettings.ADMIN_TOKEN) {
  console.warn('[auth] ADMIN_TOKEN not set. Generated for this run:', ADMIN_TOKEN);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Redis client
const redis = new Redis(gameSettings.REDIS_URL);
redis.on('error', (err) => console.error('Redis Client Error', err));

const { createProxyMiddleware } = require('http-proxy-middleware');
const { fork } = require('child_process');

const ssrServer = fork(path.join(__dirname, 'client', '.output', 'server', 'index.mjs'), {
  env: { ...process.env, PORT: 3001 }
});

ssrServer.on('error', (err) => console.error('SSR Server Error:', err));

// Properly clean up child process when parent dies to avoid orphaned zombie processes holding port 3001
const cleanupAndExit = () => {
  if (ssrServer) ssrServer.kill();
  process.exit();
};
process.on('SIGINT', cleanupAndExit);
process.on('SIGTERM', cleanupAndExit);
process.on('exit', () => { if (ssrServer) ssrServer.kill(); });

// Serve static assets from the root 'public' folder (like logos, images)
// NOTE: Must be registered BEFORE the proxy to avoid shadowing
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Proxy all frontend requests to React SSR Server
// (only proxies requests not matched by static files above)
app.use('/', createProxyMiddleware({ 
  target: 'http://localhost:3001', 
  changeOrigin: true 
}));

// Game State Enum
const STATES = {
  SETUP: 'STATE_ADMIN_SETUP',
  CARD_SELECT: 'STATE_CARD_SELECT',
  CHARGING: 'STATE_CHARGING',
  TAP_BATTLE: 'STATE_TAP_BATTLE',
  OUTCOME: 'STATE_OUTCOME_ANIMATION',
  LEADERBOARD: 'STATE_LEADERBOARD',
};

// Global in-memory state fallback (but taps go to Redis)
let currentGameState = STATES.SETUP;
let currentMatch = {
  id: null,
  schoolA: null,
  schoolB: null,
  seriesCity: null,
};
let activeMatchCode = null; // The 6-digit code for the live match

// MATCH_END was emitted once and never replayed, so a client that connected
// afterwards (a refresh on the result or twibbon screen) had winner === null.
// The twibbon then fell through its `win ? A : B` ternary and printed school B
// as the winner on a shareable image. Keep the last outcome so late joiners get
// the real one; cleared whenever a new match is set up.
let lastMatchResult = null;

let scheduledMatches = []; 
// array of { id, schoolA, schoolB, seriesCity, scheduledTime, status: 'scheduled' }

let completedMatches = [];
// array of { id, schoolA, schoolB, seriesCity, finalScoreA, finalScoreB, winnerSchool, timestamp }

// B-7: both lists lived only in memory, so a restart mid-event wiped the day's
// schedule and every completed result. They are small and rarely written, so a
// whole-list JSON write on each mutation is cheap and keeps Redis authoritative.
const KEY_SCHEDULED = 'matches:scheduled';
const KEY_COMPLETED = 'matches:completed';
// B-5: the roster of schools that have appeared in the series. Replaces the
// KEYS scan that used to enumerate leaderboard entries.
const KEY_SERIES_SCHOOLS = 'series:schools';

async function persistMatchLists() {
  try {
    await redis
      .pipeline()
      .set(KEY_SCHEDULED, JSON.stringify(scheduledMatches))
      .set(KEY_COMPLETED, JSON.stringify(completedMatches))
      .exec();
  } catch (err) {
    // In-memory state stays correct; only durability is lost.
    console.error('Failed to persist match lists:', err);
  }
}

// Emit + persist together: every call site needs both, and forgetting the
// persist half is exactly how the lists silently drift from Redis.
function publishMatchLists() {
  io.emit('MATCH_LISTS_UPDATE', { scheduledMatches, completedMatches });
  void persistMatchLists();
}

async function restoreMatchLists() {
  try {
    const [sched, done] = await redis.mget(KEY_SCHEDULED, KEY_COMPLETED);
    const parse = (raw) => {
      if (!raw) return [];
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    };
    scheduledMatches = parse(sched);
    completedMatches = parse(done);
    console.log(`[restore] ${scheduledMatches.length} scheduled, ${completedMatches.length} completed`);
  } catch (err) {
    // Corrupt or unreachable state must not stop the server from booting.
    console.error('Failed to restore match lists:', err);
  }
}

let broadcastInterval = null;

// B-2/B-3: every deferred transition is tracked so it can be cancelled. Without
// this a countdown, an auto-end, or the outcome->leaderboard hop from a previous
// match keeps firing and clobbers the state of the match that replaced it.
let countdownTimer = null;
let battleEndTimer = null;
let outcomeTimer = null;

function clearPhaseTimers() {
  for (const t of [countdownTimer, battleEndTimer, outcomeTimer]) {
    if (t) clearTimeout(t);
  }
  countdownTimer = null;
  battleEndTimer = null;
  outcomeTimer = null;
}

// B-1: tap buffer. Socket handlers only touch these counters; a single timer
// drains them into Redis so tap volume no longer scales Redis command count.
let pendingTaps = { A: 0, B: 0 };
let tapFlushInterval = null;
// Last values read back from Redis, reused by broadcastRatio so the broadcast
// tick does not issue its own reads.
let lastTapTotals = { A: 0, B: 0 };

async function flushTaps() {
  const a = pendingTaps.A;
  const b = pendingTaps.B;
  if (a === 0 && b === 0) return;
  // Zero the buffer before awaiting so taps arriving mid-flush are not lost.
  pendingTaps = { A: 0, B: 0 };

  if (!currentMatch.id) return;
  const keyA = `match:${currentMatch.id}:school:${currentMatch.schoolA}:taps`;
  const keyB = `match:${currentMatch.id}:school:${currentMatch.schoolB}:taps`;

  try {
    const pipeline = redis.pipeline();
    if (a > 0) pipeline.incrby(keyA, a);
    if (b > 0) pipeline.incrby(keyB, b);
    const results = await pipeline.exec();
    // Pipeline replies are [err, value] pairs in the order they were queued.
    let i = 0;
    if (a > 0) { lastTapTotals.A = parseInt(results[i]?.[1] ?? lastTapTotals.A, 10); i++; }
    if (b > 0) { lastTapTotals.B = parseInt(results[i]?.[1] ?? lastTapTotals.B, 10); i++; }
  } catch (err) {
    // Put the counts back so a transient Redis blip does not silently drop taps.
    pendingTaps.A += a;
    pendingTaps.B += b;
    console.error('Redis tap flush error:', err);
  }
}

// B-6: flag admin sockets at handshake. Players connect with no token and stay non-admin.
const EXPECTED_TOKEN = Buffer.from(ADMIN_TOKEN);
io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.adminToken;
  let ok = false;
  if (typeof token === 'string') {
    const buf = Buffer.from(token);
    // Compare byte length, not string length: timingSafeEqual throws on a size mismatch.
    ok = buf.length === EXPECTED_TOKEN.length && crypto.timingSafeEqual(buf, EXPECTED_TOKEN);
  }
  socket.isAdmin = ok;
  next();
});

// Socket.io Events
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id, socket.isAdmin ? '(admin)' : '');

  // Wraps an ADMIN_* handler so unauthenticated sockets are rejected, not served.
  const onAdmin = (event, handler) => socket.on(event, (...args) => {
    if (!socket.isAdmin) {
      console.warn(`[auth] rejected ${event} from non-admin socket ${socket.id}`);
      socket.emit('ADMIN_UNAUTHORIZED', { event });
      return;
    }
    return handler(...args);
  });

  socket.emit('AUTH_STATE', { isAdmin: socket.isAdmin });

  // B-4: `leaving` is the socket that is mid-disconnect. Socket.io emits
  // `disconnecting` BEFORE leaveAll(), so that socket is still counted in its
  // room and has to be subtracted by hand.
  const getPlayerCounts = (leaving = null) => {
    const sizeOf = (room) => {
      if (!room) return 0;
      let n = io.sockets.adapter.rooms.get(room)?.size || 0;
      if (leaving && leaving.schoolRoom === room) n -= 1;
      return Math.max(0, n);
    };
    return { kicker: sizeOf(currentMatch.schoolA), goalie: sizeOf(currentMatch.schoolB) };
  };

  // Send current state to new connections
  socket.emit('STATE_UPDATE', {
    state: currentGameState,
    match: currentMatch,
    activeMatchCode,
    playerCounts: getPlayerCounts()
  });

  socket.emit('MATCH_LISTS_UPDATE', {
    scheduledMatches,
    completedMatches
  });

  // The standings were only ever pushed once, at the OUTCOME->LEADERBOARD hop.
  // A client that connects later (refresh, deep link, the KLASEMEN button) never
  // saw that emit and rendered an empty board.
  fetchLeaderboard().then((leaderboard) => socket.emit('LEADERBOARD_DATA', { leaderboard }));

  // Replay the finished match so a reconnecting client renders the real score
  // and winner instead of defaulting to 0:0 with school B crowned.
  if (lastMatchResult && (currentGameState === STATES.OUTCOME || currentGameState === STATES.LEADERBOARD)) {
    socket.emit('MATCH_END', lastMatchResult);
  }

  // ==============================
  // USER EVENTS
  // ==============================
  
  socket.on('USER_VALIDATE_CODE', (payload, callback) => {
    // payload: { code: "123456" }
    if (!activeMatchCode || payload.code !== activeMatchCode) {
      if (typeof callback === 'function') callback({ success: false, message: 'Kode akses tidak valid atau match belum dimulai.' });
      return;
    }
    if (typeof callback === 'function') callback({ success: true, match: currentMatch });
  });
  socket.on('USER_JOIN_SESSION', (payload) => {
    // payload: { selectedSchoolCard, side }
    if (socket.schoolRoom) {
      socket.leave(socket.schoolRoom);
    }
    socket.schoolRoom = payload.selectedSchoolCard;
    socket.join(payload.selectedSchoolCard); // Join room for the school
    console.log(`User joined school ${payload.selectedSchoolCard}`);
    
    // Broadcast updated counts to everyone
    io.emit('PLAYER_COUNT_UPDATE', getPlayerCounts());
  });

  // B-1: clients send one batched count per CLIENT_BATCH_RATE_MS instead of
  // one event per tap. Counts land in an in-process buffer that a single timer
  // flushes to Redis, so Redis sees ~2 commands per tick regardless of crowd size.
  const acceptTapBatch = (payload) => {
    if (currentGameState !== STATES.TAP_BATTLE) return;
    if (!payload || (payload.matchId && payload.matchId !== currentMatch.id)) return;
    if (payload.team !== 'A' && payload.team !== 'B') return;

    const schoolCard = payload.team === 'A' ? currentMatch.schoolA : currentMatch.schoolB;
    if (!schoolCard) return;

    // Anti-cheat: clamp to a humanly reachable count per batch window.
    const raw = Number(payload.count);
    if (!Number.isFinite(raw) || raw <= 0) return;
    const count = Math.min(Math.floor(raw), gameSettings.MAX_TAPS_PER_BATCH);

    pendingTaps[payload.team] += count;
  };

  socket.on('TAP_BATCH', acceptTapBatch);
  // Legacy single-tap event: treat as a batch of 1 so old clients keep working.
  socket.on('TAP', (payload) => acceptTapBatch({ ...payload, count: 1 }));

  // ==============================
  // ADMIN EVENTS
  // ==============================
  
  onAdmin('ADMIN_SCHEDULE_MATCH', (payload) => {
    // payload: { schoolA, schoolB, seriesCity, scheduledTime }
    const newMatch = {
      id: Date.now().toString(),
      schoolA: payload.schoolA,
      schoolB: payload.schoolB,
      seriesCity: payload.seriesCity,
      scheduledTime: payload.scheduledTime,
      status: 'scheduled'
    };
    scheduledMatches.push(newMatch);
    publishMatchLists();
  });

  // MV-3: an operator who mis-schedules a match had no way to remove it; the
  // stale row sat in the list all event with a live START button under it.
  onAdmin('ADMIN_DELETE_SCHEDULED', (payload) => {
    if (!payload || !payload.id) return;
    const before = scheduledMatches.length;
    scheduledMatches = scheduledMatches.filter(m => m.id !== payload.id);
    if (scheduledMatches.length === before) return; // already gone
    publishMatchLists();
  });

  onAdmin('ADMIN_START_SCHEDULED', async (payload) => {
    // B-2: a new match must not inherit the previous match's pending transitions.
    clearPhaseTimers();
    // payload: { id }
    const matchIndex = scheduledMatches.findIndex(m => m.id === payload.id);
    if (matchIndex === -1) return;

    const sm = scheduledMatches[matchIndex];
    // Remove from scheduled list
    scheduledMatches.splice(matchIndex, 1);

    currentMatch = {
      id: sm.id,
      schoolA: sm.schoolA,
      schoolB: sm.schoolB,
      seriesCity: sm.seriesCity,
    };
    currentGameState = STATES.CARD_SELECT;
    
    // Generate 6-digit access code (e.g., 100000 - 999999)
    activeMatchCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Reset tap counts in Redis
    const keyA = `match:${currentMatch.id}:school:${currentMatch.schoolA}:taps`;
    const keyB = `match:${currentMatch.id}:school:${currentMatch.schoolB}:taps`;
    await redis.set(keyA, 0);
    await redis.set(keyB, 0);

    publishMatchLists();
    io.emit('STATE_UPDATE', {
      state: currentGameState,
      match: currentMatch,
      activeMatchCode,
      playerCounts: getPlayerCounts()
    });
  });

  // Keep legacy for safety, but admin will mostly use the new schedule flow
  onAdmin('ADMIN_SET_MATCH', async (payload) => {
    // B-2: a new match must not inherit the previous match's pending transitions.
    clearPhaseTimers();
    // payload: { schoolA, schoolB, seriesCity }
    currentMatch = {
      id: Date.now().toString(),
      schoolA: payload.schoolA,
      schoolB: payload.schoolB,
      seriesCity: payload.seriesCity,
    };
    currentGameState = STATES.CARD_SELECT;
    activeMatchCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Reset tap counts in Redis
    const keyA = `match:${currentMatch.id}:school:${currentMatch.schoolA}:taps`;
    const keyB = `match:${currentMatch.id}:school:${currentMatch.schoolB}:taps`;
    await redis.set(keyA, 0);
    await redis.set(keyB, 0);

    io.emit('STATE_UPDATE', {
      state: currentGameState,
      match: currentMatch,
      activeMatchCode,
      playerCounts: getPlayerCounts()
    });
  });

  onAdmin('ADMIN_START_COUNTDOWN', () => {
    // B-2: only a match sitting in CARD_SELECT can be counted down. A double
    // click used to reset a live battle back to CHARGING and queue a second
    // startBattle, so the battle silently restarted mid-play.
    if (currentGameState !== STATES.CARD_SELECT) {
      console.warn(`[state] ignored ADMIN_START_COUNTDOWN in ${currentGameState}`);
      socket.emit('ADMIN_REJECTED', { event: 'ADMIN_START_COUNTDOWN', state: currentGameState });
      return;
    }
    if (!currentMatch.id) return;

    currentGameState = STATES.CHARGING;
    io.emit('START_COUNTDOWN', { duration: gameSettings.COUNTDOWN_DURATION_MS });
    io.emit('STATE_UPDATE', { state: currentGameState, match: currentMatch, playerCounts: getPlayerCounts() });

    // Transition automatically to TAP_BATTLE after countdown
    if (countdownTimer) clearTimeout(countdownTimer);
    countdownTimer = setTimeout(() => {
      countdownTimer = null;
      startBattle();
    }, gameSettings.COUNTDOWN_DURATION_MS);
  });

  onAdmin('ADMIN_STOP_BATTLE', async () => {
    await endBattle();
  });

  onAdmin('ADMIN_RESET', () => {
    // B-3: kill pending transitions first. Resetting during the 5s outcome
    // animation used to leave that timer alive; it then fired and dragged the
    // freshly reset server into STATE_LEADERBOARD.
    clearPhaseTimers();
    if (broadcastInterval) { clearInterval(broadcastInterval); broadcastInterval = null; }
    if (tapFlushInterval) { clearInterval(tapFlushInterval); tapFlushInterval = null; }
    pendingTaps = { A: 0, B: 0 };
    lastTapTotals = { A: 0, B: 0 };

    // Make everyone leave their school rooms so the next match starts fresh
    io.sockets.sockets.forEach(s => {
      if (s.schoolRoom) {
        s.leave(s.schoolRoom);
        s.schoolRoom = null;
      }
    });

    currentGameState = STATES.SETUP;
    currentMatch = {
      id: null,
      schoolA: null,
      schoolB: null,
      seriesCity: null,
    };
    activeMatchCode = null;
    io.emit('STATE_UPDATE', { state: currentGameState, match: currentMatch, activeMatchCode, playerCounts: { kicker: 0, goalie: 0 } });
  });

  // B-4: fires while the socket is still in its rooms, so the count is exact and
  // needs no setTimeout. The old 100ms delay left the count stale, or permanently
  // wrong if the event loop stalled past it.
  socket.on('disconnecting', () => {
    if (socket.schoolRoom) {
      io.emit('PLAYER_COUNT_UPDATE', getPlayerCounts(socket));
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

function startBattle() {
  if (currentGameState === STATES.TAP_BATTLE) return;
  currentGameState = STATES.TAP_BATTLE;
  io.emit('START_BATTLE', { durationMs: gameSettings.BATTLE_DURATION_MS });
  // Since we don't have access to getPlayerCounts here easily, we just omit or rebuild it if needed.
  // Actually we can just let clients keep their previous count on START_BATTLE.
  io.emit('STATE_UPDATE', { state: currentGameState, match: currentMatch });

  // Fresh buffers for the new battle
  pendingTaps = { A: 0, B: 0 };
  lastTapTotals = { A: 0, B: 0 };

  // Drain the tap buffer into Redis on its own cadence
  if (tapFlushInterval) clearInterval(tapFlushInterval);
  tapFlushInterval = setInterval(() => { void flushTaps(); }, gameSettings.CLIENT_BATCH_RATE_MS);

  // Start broadcasting ratios
  if (broadcastInterval) clearInterval(broadcastInterval);
  broadcastInterval = setInterval(broadcastRatio, gameSettings.SERVER_BROADCAST_RATE_MS);

  // Auto end battle after duration. Tracked so an early ADMIN_STOP_BATTLE plus a
  // quick restart cannot let this stale timer cut the next battle short.
  if (battleEndTimer) clearTimeout(battleEndTimer);
  battleEndTimer = setTimeout(async () => {
    battleEndTimer = null;
    await endBattle();
  }, gameSettings.BATTLE_DURATION_MS);
}

async function endBattle() {
  if (currentGameState !== STATES.TAP_BATTLE) return;
  currentGameState = STATES.OUTCOME;
  
  if (broadcastInterval) {
    clearInterval(broadcastInterval);
    broadcastInterval = null;
  }

  if (battleEndTimer) {
    clearTimeout(battleEndTimer);
    battleEndTimer = null;
  }

  // Stop buffering and drain the tail so the final score includes the last window.
  if (tapFlushInterval) {
    clearInterval(tapFlushInterval);
    tapFlushInterval = null;
  }
  await flushTaps();

  // Get final tap counts from Redis
  const keyA = `match:${currentMatch.id}:school:${currentMatch.schoolA}:taps`;
  const keyB = `match:${currentMatch.id}:school:${currentMatch.schoolB}:taps`;
  
  const [tapsA, tapsB] = await Promise.all([
    redis.get(keyA).then(v => parseInt(v || 0, 10)),
    redis.get(keyB).then(v => parseInt(v || 0, 10))
  ]);

  let winnerSchool = 'DRAW';
  let winnerTeam = null;
  if (tapsA > tapsB) {
    winnerSchool = currentMatch.schoolA;
    winnerTeam = 'A';
  } else if (tapsB > tapsA) {
    winnerSchool = currentMatch.schoolB;
    winnerTeam = 'B';
  }

  // Award +1 to the winner in the overall series score
  try {
    if (winnerSchool !== 'DRAW') {
      await redis.hincrby(`series:school:${winnerSchool}:stats`, 'wins', 1);
      await redis.hincrby(`series:school:${winnerSchool}:stats`, 'points', 3);
      
      const loserSchool = winnerSchool === currentMatch.schoolA ? currentMatch.schoolB : currentMatch.schoolA;
      await redis.hincrby(`series:school:${loserSchool}:stats`, 'losses', 1);
    } else {
      await redis.hincrby(`series:school:${currentMatch.schoolA}:stats`, 'draws', 1);
      await redis.hincrby(`series:school:${currentMatch.schoolB}:stats`, 'draws', 1);
      await redis.hincrby(`series:school:${currentMatch.schoolA}:stats`, 'points', 1);
      await redis.hincrby(`series:school:${currentMatch.schoolB}:stats`, 'points', 1);
    }

    // Cumulative taps
    await redis.hincrby(`series:school:${currentMatch.schoolA}:stats`, 'taps', tapsA);
    await redis.hincrby(`series:school:${currentMatch.schoolB}:stats`, 'taps', tapsB);

    // B-5: record who is in the series so the leaderboard never needs KEYS.
    await redis.sadd(KEY_SERIES_SCHOOLS, currentMatch.schoolA, currentMatch.schoolB);
  } catch (err) {
    console.error('Failed to update series stats:', err);
  }

  const matchResult = {
    winner: winnerTeam,
    finalScoreA: tapsA,
    finalScoreB: tapsB,
    winnerSchool,
  };

  // Add to completed matches history
  completedMatches.push({
    id: currentMatch.id,
    schoolA: currentMatch.schoolA,
    schoolB: currentMatch.schoolB,
    seriesCity: currentMatch.seriesCity,
    finalScoreA: tapsA,
    finalScoreB: tapsB,
    winnerSchool: winnerSchool,
    timestamp: Date.now()
  });
  publishMatchLists();

  lastMatchResult = matchResult;
  io.emit('MATCH_END', matchResult);
  io.emit('STATE_UPDATE', { state: currentGameState, match: currentMatch, activeMatchCode });

  // Transition to Leaderboard automatically after outcome animation
  const outcomeMatchId = currentMatch.id;
  if (outcomeTimer) clearTimeout(outcomeTimer);
  outcomeTimer = setTimeout(async () => {
    outcomeTimer = null;
    // Re-check on arrival: an admin reset or a new match during the animation
    // means this hop is stale and must not touch the current state.
    if (currentGameState !== STATES.OUTCOME || currentMatch.id !== outcomeMatchId) return;
    currentGameState = STATES.LEADERBOARD;
    activeMatchCode = null; // Clear code so players can't join late
    
    const leaderboard = await fetchLeaderboard();

    io.emit('STATE_UPDATE', { state: currentGameState, match: currentMatch, activeMatchCode });
    io.emit('LEADERBOARD_DATA', { leaderboard });
  }, 5000); // 5 seconds outcome animation
}

// B-5: KEYS is an O(total-keyspace) blocking scan; running it on every match end
// stalls the whole Redis instance while thousands of taps are still in flight.
// The school roster is a SET now, and the stat hashes are read in one pipeline.
// Not a ZSET: ranking is points-then-taps, and a single score cannot hold both
// without duplicating state that the hashes already own.
async function fetchLeaderboard() {
  try {
    const schools = await redis.smembers(KEY_SERIES_SCHOOLS);
    if (schools.length === 0) return [];

    const pipeline = redis.pipeline();
    for (const school of schools) pipeline.hgetall(`series:school:${school}:stats`);
    const results = await pipeline.exec();

    const leaderboard = schools.map((school, i) => {
      const stats = results[i]?.[1] || {};
      return {
        school,
        points: parseInt(stats.points || 0, 10),
        wins: parseInt(stats.wins || 0, 10),
        losses: parseInt(stats.losses || 0, 10),
        draws: parseInt(stats.draws || 0, 10),
        taps: parseInt(stats.taps || 0, 10),
      };
    });

    leaderboard.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.taps - a.taps;
    });
    return leaderboard;
  } catch (err) {
    console.error('Failed to fetch leaderboard:', err);
    return [];
  }
}

function broadcastRatio() {
  if (!currentMatch.id) return;

  // No Redis read here: flushTaps() already captured the authoritative totals
  // from its INCRBY replies, so the broadcast tick is pure CPU.
  try {
    const tapsA = lastTapTotals.A;
    const tapsB = lastTapTotals.B;

    let ratioA = 50;
    let ratioB = 50;
    
    const total = tapsA + tapsB;
    if (total > 0) {
      ratioA = (tapsA / total) * 100;
      ratioB = (tapsB / total) * 100;
    }

    io.emit('RATIO_UPDATE', {
      schoolATaps: tapsA,
      schoolBTaps: tapsB,
      ratioA: ratioA,
      ratioB: ratioB
    });
  } catch (err) {
    console.error('Error broadcasting ratio:', err);
  }
}

const PORT = process.env.PORT || 3000;
// Restore before accepting connections so the first client to arrive already
// sees the real schedule instead of an empty list that fills in a moment later.
restoreMatchLists().finally(() => {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
