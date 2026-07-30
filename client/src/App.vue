<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { io, Socket } from 'socket.io-client';
import type { GameState, Match, PlayerStats } from './types/game';

const socket: Socket = io('http://localhost:3000');

// State
const currentState = ref<GameState>('STATE_SETUP');
const currentMatch = ref<Match | null>(null);
const stats = reactive<PlayerStats>({ scoreA: 0, scoreB: 0 });
const winner = ref<'A' | 'B' | null>(null);
const timer = ref<number>(0);
let timerInterval: ReturnType<typeof setInterval> | null = null;

// User Data
const phone = ref('');
const selectedTeam = ref<'A' | 'B' | null>(null);

// Computed
const ratioA = computed(() => {
  const total = stats.scoreA + stats.scoreB;
  if (total === 0) return 50;
  return (stats.scoreA / total) * 100;
});
const ratioB = computed(() => 100 - ratioA.value);

// Particles
const canvasRef = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;
let reqAnimFrame = null;
const particles: any[] = [];

// Socket Listeners
onMounted(() => {
  socket.on('STATE_UPDATE', (data: { state: GameState, currentMatch: Match | null }) => {
    currentState.value = data.state;
    if (data.currentMatch) {
      currentMatch.value = data.currentMatch;
    }
    if (data.state === 'STATE_SETUP') {
      selectedTeam.value = null;
    }
  });

  socket.on('SCORE_UPDATE', (data: { scores: Record<string, number>, teamScoreA: number, teamScoreB: number }) => {
    stats.scoreA = data.teamScoreA;
    stats.scoreB = data.teamScoreB;
  });

  socket.on('START_COUNTDOWN', (data: { duration: number }) => {
    timer.value = data.duration / 1000;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timer.value--;
      if (timer.value <= 0) {
        clearInterval(timerInterval as ReturnType<typeof setInterval>);
      }
    }, 1000);
  });

  socket.on('MATCH_END', (data: { winner: 'A'|'B', finalScoreA: number, finalScoreB: number }) => {
    winner.value = data.winner;
    stats.scoreA = data.finalScoreA;
    stats.scoreB = data.finalScoreB;
    currentState.value = 'STATE_OUTCOME';
  });

  // Init Canvas
  if (canvasRef.value) {
    ctx = canvasRef.value.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    renderCanvas();
  }
});

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
  window.removeEventListener('resize', resizeCanvas);
  if (reqAnimFrame) cancelAnimationFrame(reqAnimFrame);
});

// Methods
const selectTeam = (team: 'A' | 'B') => {
  if (!phone.value || phone.value.length < 10) {
    alert('Please enter a valid Tri Number first!');
    return;
  }
  selectedTeam.value = team;
  socket.emit('REGISTER_PLAYER', { phone: phone.value, team });
};

const handleTap = () => {
  if (currentState.value !== 'STATE_BATTLE' || !selectedTeam.value) return;
  socket.emit('TAP', { phone: phone.value, team: selectedTeam.value });
  
  // Create particle
  if (canvasRef.value) {
    particles.push({
      x: Math.random() * canvasRef.value.width,
      y: canvasRef.value.height,
      vx: (Math.random() - 0.5) * 4,
      vy: -5 - Math.random() * 5,
      life: 1.0,
      color: selectedTeam.value === 'A' ? '#FF0066' : '#00E5FF'
    });
  }
};

const resizeCanvas = () => {
  if (canvasRef.value) {
    canvasRef.value.width = window.innerWidth;
    canvasRef.value.height = window.innerHeight;
  }
};

const renderCanvas = () => {
  if (!ctx || !canvasRef.value) return;
  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
  
  if (currentState.value === 'STATE_BATTLE') {
    // Draw Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      let p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
      
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Glow
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1.0;
  }
  
  reqAnimFrame = requestAnimationFrame(renderCanvas);
};
</script>

<template>
  <div id="game-container" class="mx-auto w-full h-full max-w-md flex flex-col justify-between" @click="handleTap">
    <div class="overlay-dark"></div>
    
    <!-- State: Setup -->
    <div v-if="currentState === 'STATE_WAITING' || currentState === 'STATE_SETUP' || !currentMatch" class="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-50 p-6">
      <img src="/assets/tri-logo.png" alt="Tri Logo" class="w-24 mb-6">
      <h1 class="font-display text-4xl mb-2 text-center text-white glow-cyan italic">REFLEX DUEL</h1>
      <p class="text-sm text-gray-300 mb-8 text-center">Enter your Tri number to join the clash!</p>
      
      <template v-if="currentMatch">
        <input v-model="phone" type="tel" placeholder="0896..." class="w-full max-w-xs px-4 py-4 bg-transparent border-b-2 border-[#00E5FF] text-white text-center focus:outline-none focus:border-[#FF0066] mb-8 transition-colors" :disabled="selectedTeam !== null">
        
        <div v-if="!selectedTeam" class="w-full max-w-xs flex justify-between gap-4">
          <button @click="selectTeam('A')" class="flex-1 battle-card card-kicker p-4 cursor-pointer hover:bg-white/5 transition-all">
            <span class="text-gray-400 text-xs mb-2">TEAM A</span>
            <span class="font-bold text-lg text-center text-magenta glow-magenta">KICKER</span>
          </button>
          <button @click="selectTeam('B')" class="flex-1 battle-card card-goalie p-4 cursor-pointer hover:bg-white/5 transition-all">
            <span class="text-gray-400 text-xs mb-2">TEAM B</span>
            <span class="font-bold text-lg text-center text-cyan glow-cyan">GOALIE</span>
          </button>
        </div>
        <div v-else class="mt-8 font-bold text-[#FF0066] animate-pulse">WAITING FOR HOST...</div>
      </template>
      <div v-else class="mt-8 font-bold text-gray-400 animate-pulse">WAITING FOR NEXT MATCH...</div>
    </div>

    <!-- State: Charging -->
    <div v-if="currentState === 'STATE_CHARGING'" class="absolute inset-0 flex items-center justify-center z-40" style="background: rgba(0,0,0,0.8); backdrop-filter: blur(8px);">
      <div class="text-center">
        <div class="text-9xl font-black italic text-transparent bg-clip-text bg-gradient-to-br from-[#FF0066] to-[#00E5FF] animate-pulse glow-cyan">{{ timer }}</div>
        <p class="text-white mt-6 tracking-widest font-bold text-xl">GET READY</p>
      </div>
    </div>

    <!-- State: Battle -->
    <div v-if="currentState === 'STATE_BATTLE' || currentState === 'STATE_OUTCOME'" class="absolute inset-0 w-full h-full z-10 flex flex-col justify-between pb-10 pt-4">
      
      <!-- Top Section -->
      <div class="px-4">
        <div class="bg-gradient-header p-4 shadow-lg flex flex-col items-center">
          <div class="text-4xl font-black text-magenta glow-magenta tracking-widest mb-1">{{ currentState === 'STATE_BATTLE' ? timer : '00:00' }}</div>
          <div class="text-[10px] text-white/80 tracking-widest mb-4 uppercase font-bold">SERI SURABAYA | MATCH DAY 1</div>
          
          <div class="w-full flex gap-2">
            <div class="inner-card flex-1 p-2 flex items-center justify-between">
              <svg class="w-8 h-8 text-white/50 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
              <div class="flex-1 text-right ml-2">
                <div class="text-[11px] font-bold leading-tight truncate">{{ currentMatch?.schoolA || 'TEAM A' }}</div>
                <div class="text-[10px] text-magenta font-black">KICKER</div>
              </div>
            </div>
            
            <div class="inner-card flex-1 p-2 flex items-center justify-between flex-row-reverse">
              <svg class="w-8 h-8 text-white/50 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
              <div class="flex-1 text-left mr-2">
                <div class="text-[11px] font-bold leading-tight truncate">{{ currentMatch?.schoolB || 'TEAM B' }}</div>
                <div class="text-[10px] text-cyan font-black">GOALIE</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tug of War Section -->
      <div class="px-4 mt-6">
        <div class="flex justify-between text-xs font-black mb-2">
          <span class="text-magenta glow-magenta">KICKER: <span>{{ stats.scoreA.toLocaleString() }}</span> TAP</span>
          <span class="text-cyan glow-cyan">GOALIE: <span>{{ stats.scoreB.toLocaleString() }}</span> TAP</span>
        </div>
        <div class="tug-bar-wrapper flex">
          <div class="bar-magenta-fill" :style="`width:${ratioA}%`"></div>
          <div class="bar-cyan-fill" :style="`width:${ratioB}%`"></div>
          <div class="tug-icon" :style="`left:${ratioA}%`">
            <svg class="w-6 h-6 text-white drop-shadow-[0_0_5px_#fff]" viewBox="0 0 24 24" fill="currentColor"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </div>
        </div>
      </div>

      <!-- Center Cards Section -->
      <div class="flex-1 relative flex justify-between items-center px-4 my-6">
        <div class="battle-card card-kicker">
          <div class="card-icon icon-magenta">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </div>
          <div class="text-magenta font-black text-2xl glow-magenta tracking-wide">KICKER</div>
          <div class="text-[10px] text-white/70 mt-2 font-bold">{{ selectedTeam === 'A' ? 'YOUR TEAM' : 'PLAYER 1' }}</div>
        </div>
        
        <div class="vs-text">VS</div>

        <div class="battle-card card-goalie">
          <div class="card-icon icon-cyan">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div class="text-cyan font-black text-2xl glow-cyan tracking-wide">GOALIE</div>
          <div class="text-[10px] text-white/70 mt-2 font-bold">{{ selectedTeam === 'B' ? 'YOUR TEAM' : 'PLAYER 2' }}</div>
        </div>
      </div>

      <!-- Bottom Tap Zone -->
      <div v-if="currentState === 'STATE_BATTLE'" class="w-full relative z-30 tap-zone-active pointer-events-none">
        <div class="tap-btn animate-tap pointer-events-none">TAP NOW!</div>
      </div>
      
    </div>

    <!-- State: Outcome Overlay -->
    <div v-if="currentState === 'STATE_OUTCOME'" class="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-50 p-6">
      <h2 class="text-6xl font-black italic -skew-x-12 mb-2 text-magenta glow-magenta">GOAL!</h2>
      <p class="text-xl font-bold text-gray-300 mb-8 text-center">{{ winner === 'A' ? 'KICKER WINS' : (winner === 'B' ? 'GOALIE WINS' : 'DRAW') }}</p>
      
      <div class="bg-gray-900 border-2 border-white/20 w-full rounded-2xl p-6 mb-8">
        <h3 class="text-sm font-bold text-center border-b border-white/20 pb-4 mb-4 tracking-widest">MATCH STATS</h3>
        <div class="flex justify-between items-center mb-4">
          <span class="font-bold text-magenta">{{ currentMatch?.schoolA || 'School A' }}</span>
          <span class="text-2xl font-black">{{ stats.scoreA.toLocaleString() }}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="font-bold text-cyan">{{ currentMatch?.schoolB || 'School B' }}</span>
          <span class="text-2xl font-black">{{ stats.scoreB.toLocaleString() }}</span>
        </div>
      </div>

      <button @click="() => {}" class="w-full bg-gradient-header text-white font-black text-xl py-4 rounded-full shadow-[0_0_15px_#FF0066] hover:scale-105 transition-transform z-50 relative pointer-events-auto">
        SHARE RESULT
      </button>
    </div>
    
    <!-- Canvas for Tap Particles -->
    <canvas ref="canvasRef" id="game-canvas" class="absolute inset-0 z-0 pointer-events-none"></canvas>
  </div>
</template>
