// Env override for the timing knobs: lets an operator retune phase lengths on
// site, and lets the regression checks run a full match in seconds.
const num = (name, fallback) => {
  const v = parseInt(process.env[name], 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

module.exports = {
  // Game parameters
  BATTLE_DURATION_MS: num('BATTLE_DURATION_MS', 60000), // 60 seconds active phase
  COUNTDOWN_DURATION_MS: num('COUNTDOWN_DURATION_MS', 3000), // 3 seconds charging phase
  
  // Client-server batching rate
  CLIENT_BATCH_RATE_MS: 100, // Clients send taps every 100ms
  SERVER_BROADCAST_RATE_MS: 200, // Server broadcasts ratio updates every 200ms
  
  // Anti-cheat ceiling: max taps accepted from one client batch.
  // A human tops out around 20 taps/sec, so 25 per 100ms window is generous.
  MAX_TAPS_PER_BATCH: 25,

  // Admin auth: required to accept any ADMIN_* socket event.
  // Leave unset in dev and the server generates one per run and logs it.
  // Note: You can set this via a .env file (e.g., ADMIN_TOKEN=your_secure_token)
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || '',

  // Redis configuration
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // Quality of Control parameters
  // To avoid wild swings, we can apply balance smoothing
  BALANCE_SMOOTHING: 0.1, 
};
