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

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

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

  // Send current state to new connections
  socket.emit('STATE_UPDATE', {
    state: currentGameState,
    match: currentMatch
  });

  // ==============================
  // USER EVENTS
  // ==============================
  socket.on('USER_JOIN_SESSION', (payload) => {
    // payload: { phoneNum, selectedSchoolCard }
    socket.join(payload.selectedSchoolCard); // Join room for the school
    console.log(`User ${payload.phoneNum} joined school ${payload.selectedSchoolCard}`);
  });

  socket.on('SUBMIT_TAPS', async (payload) => {
    // payload: { matchId, schoolCard, tapBatchCount }
    if (currentGameState !== STATES.TAP_BATTLE) return;
    if (payload.matchId !== currentMatch.id) return;
    if (payload.tapBatchCount <= 0) return;

    // Atomic increment in Redis
    try {
      const key = `match:${payload.matchId}:school:${payload.schoolCard}:taps`;
      await redis.incrby(key, payload.tapBatchCount);
    } catch (err) {
      console.error('Redis INCRBY error:', err);
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
      match: currentMatch
    });
  });

  socket.on('ADMIN_START_COUNTDOWN', () => {
    currentGameState = STATES.CHARGING;
    io.emit('START_COUNTDOWN', { duration: gameSettings.COUNTDOWN_DURATION_MS });
    io.emit('STATE_UPDATE', { state: currentGameState, match: currentMatch });

    // Transition automatically to TAP_BATTLE after countdown
    setTimeout(() => {
      startBattle();
    }, gameSettings.COUNTDOWN_DURATION_MS);
  });

  socket.on('ADMIN_STOP_BATTLE', async () => {
    await endBattle();
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

function startBattle() {
  if (currentGameState === STATES.TAP_BATTLE) return;
  currentGameState = STATES.TAP_BATTLE;
  io.emit('START_BATTLE');
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
  if (tapsA > tapsB) winnerSchool = currentMatch.schoolA;
  else if (tapsB > tapsA) winnerSchool = currentMatch.schoolB;

  const matchResult = {
    winnerSchool,
    totalTaps: {
      [currentMatch.schoolA]: tapsA,
      [currentMatch.schoolB]: tapsB
    },
    topMVPUsers: [] // Real implementation would track users, but for scope we mock
  };

  io.emit('MATCH_OVER', matchResult);
  io.emit('STATE_UPDATE', { state: currentGameState, match: currentMatch });

  // Transition to Leaderboard automatically after outcome animation
  setTimeout(() => {
    currentGameState = STATES.LEADERBOARD;
    io.emit('STATE_UPDATE', { state: currentGameState, match: currentMatch });
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
