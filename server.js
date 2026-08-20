const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Redis = require('ioredis');
const path = require('path');
const gameSettings = require('./config/gameSettings');

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

let broadcastInterval = null;

// Socket.io Events
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  const getPlayerCounts = () => {
    const countA = currentMatch.schoolA ? (io.sockets.adapter.rooms.get(currentMatch.schoolA)?.size || 0) : 0;
    const countB = currentMatch.schoolB ? (io.sockets.adapter.rooms.get(currentMatch.schoolB)?.size || 0) : 0;
    return { kicker: countA, goalie: countB };
  };

  // Send current state to new connections
  socket.emit('STATE_UPDATE', {
    state: currentGameState,
    match: currentMatch,
    playerCounts: getPlayerCounts()
  });

  // ==============================
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

  socket.on('TAP', async (payload) => {
    // payload: { matchId, team }
    if (currentGameState !== STATES.TAP_BATTLE) return;
    
    // BUG-10 fix: Ensure tap is for the current match
    if (payload.matchId && payload.matchId !== currentMatch.id) return;

    const schoolCard = payload.team === 'A' ? currentMatch.schoolA : currentMatch.schoolB;
    if (!schoolCard) return;

    // Atomic increment in Redis
    try {
      const key = `match:${currentMatch.id}:school:${schoolCard}:taps`;
      await redis.incr(key);
    } catch (err) {
      console.error('Redis INCR error:', err);
    }
  });

  // ==============================
  // ADMIN EVENTS
  // ==============================
  socket.on('ADMIN_SET_MATCH', async (payload) => {
    // payload: { schoolA, schoolB, seriesCity }
    currentMatch = {
      id: Date.now().toString(),
      schoolA: payload.schoolA,
      schoolB: payload.schoolB,
      seriesCity: payload.seriesCity,
    };
    currentGameState = STATES.CARD_SELECT;
    
    // Reset tap counts in Redis
    const keyA = `match:${currentMatch.id}:school:${currentMatch.schoolA}:taps`;
    const keyB = `match:${currentMatch.id}:school:${currentMatch.schoolB}:taps`;
    await redis.set(keyA, 0);
    await redis.set(keyB, 0);

    io.emit('STATE_UPDATE', {
      state: currentGameState,
      match: currentMatch,
      playerCounts: getPlayerCounts()
    });
  });

  socket.on('ADMIN_START_COUNTDOWN', () => {
    currentGameState = STATES.CHARGING;
    io.emit('START_COUNTDOWN', { duration: gameSettings.COUNTDOWN_DURATION_MS });
    io.emit('STATE_UPDATE', { state: currentGameState, match: currentMatch, playerCounts: getPlayerCounts() });

    // Transition automatically to TAP_BATTLE after countdown
    setTimeout(() => {
      startBattle();
    }, gameSettings.COUNTDOWN_DURATION_MS);
  });

  socket.on('ADMIN_STOP_BATTLE', async () => {
    await endBattle();
  });

  socket.on('ADMIN_RESET', () => {
    currentGameState = STATES.SETUP;
    currentMatch = {
      id: null,
      schoolA: null,
      schoolB: null,
      seriesCity: null,
    };
    io.emit('STATE_UPDATE', { state: currentGameState, match: currentMatch, playerCounts: { kicker: 0, goalie: 0 } });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (socket.schoolRoom) {
      // Delay slightly to let the socket actually leave the room in Socket.io adapter
      setTimeout(() => {
        io.emit('PLAYER_COUNT_UPDATE', getPlayerCounts());
      }, 100);
    }
  });
});

function startBattle() {
  if (currentGameState === STATES.TAP_BATTLE) return;
  currentGameState = STATES.TAP_BATTLE;
  io.emit('START_BATTLE', { durationMs: gameSettings.BATTLE_DURATION_MS });
  // Since we don't have access to getPlayerCounts here easily, we just omit or rebuild it if needed.
  // Actually we can just let clients keep their previous count on START_BATTLE.
  io.emit('STATE_UPDATE', { state: currentGameState, match: currentMatch });

  // Start broadcasting ratios
  if (broadcastInterval) clearInterval(broadcastInterval);
  broadcastInterval = setInterval(async () => {
    await broadcastRatio();
  }, gameSettings.SERVER_BROADCAST_RATE_MS);

  // Auto end battle after duration
  setTimeout(async () => {
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
  } catch (err) {
    console.error('Failed to update series stats:', err);
  }

  const matchResult = {
    winner: winnerTeam,
    finalScoreA: tapsA,
    finalScoreB: tapsB,
    winnerSchool,
  };

  io.emit('MATCH_END', matchResult);
  io.emit('STATE_UPDATE', { state: currentGameState, match: currentMatch });

  // Transition to Leaderboard automatically after outcome animation
  setTimeout(async () => {
    currentGameState = STATES.LEADERBOARD;
    
    // Fetch leaderboard
    let leaderboard = [];
    try {
      const keys = await redis.keys('series:school:*:stats');
      for (const key of keys) {
        // key format: series:school:SCHOOL_NAME:stats
        // using a regex or split to extract school name
        const schoolName = key.split(':')[2];
        const stats = await redis.hgetall(key);
        leaderboard.push({
          school: schoolName,
          points: parseInt(stats.points || 0, 10),
          wins: parseInt(stats.wins || 0, 10),
          losses: parseInt(stats.losses || 0, 10),
          draws: parseInt(stats.draws || 0, 10),
          taps: parseInt(stats.taps || 0, 10),
        });
      }
      leaderboard.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.taps - a.taps;
      });
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    }

    io.emit('STATE_UPDATE', { state: currentGameState, match: currentMatch });
    io.emit('LEADERBOARD_DATA', { leaderboard });
  }, 5000); // 5 seconds outcome animation
}

async function broadcastRatio() {
  if (!currentMatch.id) return;
  const keyA = `match:${currentMatch.id}:school:${currentMatch.schoolA}:taps`;
  const keyB = `match:${currentMatch.id}:school:${currentMatch.schoolB}:taps`;
  
  try {
    const [tapsAStr, tapsBStr] = await Promise.all([
      redis.get(keyA),
      redis.get(keyB)
    ]);
    
    const tapsA = parseInt(tapsAStr || 0, 10);
    const tapsB = parseInt(tapsBStr || 0, 10);
    
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
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
