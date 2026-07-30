module.exports = {
  // Game parameters
  BATTLE_DURATION_MS: 15000, // 15 seconds active phase
  COUNTDOWN_DURATION_MS: 3000, // 3 seconds charging phase
  
  // Client-server batching rate
  CLIENT_BATCH_RATE_MS: 100, // Clients send taps every 100ms
  SERVER_BROADCAST_RATE_MS: 200, // Server broadcasts ratio updates every 200ms
  
  // Redis configuration
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // Quality of Control parameters
  // To avoid wild swings, we can apply balance smoothing
  BALANCE_SMOOTHING: 0.1, 
};
