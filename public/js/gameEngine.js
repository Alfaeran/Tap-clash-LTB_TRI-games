const socket = io();

// UI Elements
const screenSetup = document.getElementById('screen-setup');
const screenCharging = document.getElementById('screen-charging');
const screenBattle = document.getElementById('screen-battle');
const screenOutcome = document.getElementById('screen-outcome');

const inputPhone = document.getElementById('input-phone');
const schoolSelection = document.getElementById('school-selection');
const btnSchoolA = document.getElementById('btn-school-a');
const btnSchoolB = document.getElementById('btn-school-b');
const labelSchoolA = document.getElementById('label-school-a');
const labelSchoolB = document.getElementById('label-school-b');
const waitingMsg = document.getElementById('waiting-msg');

const chargingTimer = document.getElementById('charging-timer');
const tapZone = document.getElementById('tap-zone');
const barA = document.getElementById('bar-a');
const barB = document.getElementById('bar-b');
const scoreA = document.getElementById('score-a');
const scoreB = document.getElementById('score-b');

const outcomeTitle = document.getElementById('outcome-title');
const outcomeDesc = document.getElementById('outcome-desc');
const statNameA = document.getElementById('stat-name-a');
const statScoreA = document.getElementById('stat-score-a');
const statNameB = document.getElementById('stat-name-b');
const statScoreB = document.getElementById('stat-score-b');

// Game State Variables
let currentMatch = null;
let selectedSchool = null;
let phoneNum = null;
let batchedTaps = 0;
let tapBatchInterval = null;
let ratioA = 50;

const STATES = {
  SETUP: 'STATE_ADMIN_SETUP',
  CARD_SELECT: 'STATE_CARD_SELECT',
  CHARGING: 'STATE_CHARGING',
  TAP_BATTLE: 'STATE_TAP_BATTLE',
  OUTCOME: 'STATE_OUTCOME_ANIMATION',
  LEADERBOARD: 'STATE_LEADERBOARD',
};

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
let reqAnimFrame = null;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ==============================
// SOCKET EVENTS
// ==============================
socket.on('STATE_UPDATE', (data) => {
  currentMatch = data.match;
  handleStateChange(data.state);
});

socket.on('START_COUNTDOWN', (data) => {
  const displayTimer = document.getElementById('charging-timer-display');
  let timeLeft = data.duration / 1000;
  displayTimer.innerText = timeLeft;
  
  const interval = setInterval(() => {
    timeLeft--;
    if (timeLeft > 0) {
      displayTimer.innerText = timeLeft;
    } else {
      clearInterval(interval);
    }
  }, 1000);
});

socket.on('START_BATTLE', () => {
  // Start tap batching
  batchedTaps = 0;
  if (tapBatchInterval) clearInterval(tapBatchInterval);
  tapBatchInterval = setInterval(() => {
    if (batchedTaps > 0 && selectedSchool) {
      socket.emit('SUBMIT_TAPS', {
        matchId: currentMatch.id,
        schoolCard: selectedSchool,
        tapBatchCount: batchedTaps
      });
      batchedTaps = 0; // reset
    }
  }, 100);
});

socket.on('RATIO_UPDATE', (data) => {
  scoreA.innerText = data.schoolATaps;
  scoreB.innerText = data.schoolBTaps;
  
  // Smooth ratio movement
  barA.style.width = `${data.ratioA}%`;
  barB.style.width = `${data.ratioB}%`;
  
  ratioA = data.ratioA; // for canvas rendering
});

socket.on('MATCH_OVER', (result) => {
  if (tapBatchInterval) clearInterval(tapBatchInterval);
  
  if (result.winnerSchool === currentMatch.schoolA) {
    outcomeTitle.innerText = "GOAL!";
    outcomeTitle.className = "text-5xl font-black italic transform -skew-x-12 mb-4 drop-shadow-[0_0_20px_#FF0066] text-[#FF0066]";
    outcomeDesc.innerText = `${currentMatch.schoolA} Won!`;
  } else if (result.winnerSchool === currentMatch.schoolB) {
    outcomeTitle.innerText = "GREAT SAVE!";
    outcomeTitle.className = "text-5xl font-black italic transform -skew-x-12 mb-4 drop-shadow-[0_0_20px_#00E5FF] text-[#00E5FF]";
    outcomeDesc.innerText = `${currentMatch.schoolB} Won!`;
  } else {
    outcomeTitle.innerText = "DRAW!";
    outcomeTitle.className = "text-5xl font-black italic transform -skew-x-12 mb-4 text-white";
    outcomeDesc.innerText = "It's a tie!";
  }

  statNameA.innerText = currentMatch.schoolA;
  statScoreA.innerText = result.totalTaps[currentMatch.schoolA];
  statNameB.innerText = currentMatch.schoolB;
  statScoreB.innerText = result.totalTaps[currentMatch.schoolB];
});

// ==============================
// STATE MACHINE HANDLER
// ==============================
function handleStateChange(state) {
  // Hide all screens first
  screenSetup.classList.add('hidden');
  screenCharging.classList.add('hidden');
  screenBattle.classList.add('hidden');
  screenOutcome.classList.add('hidden');

  if (state === STATES.SETUP) {
    screenSetup.classList.remove('hidden');
    waitingMsg.classList.remove('hidden');
    waitingMsg.innerText = "Admin is setting up the match...";
    schoolSelection.classList.add('hidden');
  } 
  else if (state === STATES.CARD_SELECT) {
    screenSetup.classList.remove('hidden');
    waitingMsg.classList.add('hidden');
    
    if (currentMatch) {
      document.getElementById('label-school-a-battle').innerText = currentMatch.schoolA;
      document.getElementById('label-school-b-battle').innerText = currentMatch.schoolB;
    }
    
    // If user hasn't selected yet, show selection
    if (!selectedSchool) {
      schoolSelection.classList.remove('hidden');
      inputPhone.classList.remove('hidden');
    } else {
      waitingMsg.classList.remove('hidden');
      waitingMsg.innerText = `Waiting for countdown... You joined ${selectedSchool}`;
    }
  }
  else if (state === STATES.CHARGING) {
    screenCharging.classList.remove('hidden');
    // We can also show the battle screen behind it
    screenBattle.classList.remove('hidden');
    tapZone.classList.add('hidden'); // Disable taps during charging
    
    // Start canvas render loop
    if (!reqAnimFrame) {
      renderCanvas();
    }
  }
  else if (state === STATES.TAP_BATTLE) {
    screenBattle.classList.remove('hidden');
    tapZone.classList.remove('hidden');
    
    // Reset visual bars
    barA.style.width = `50%`;
    barB.style.width = `50%`;
    scoreA.innerText = "0";
    scoreB.innerText = "0";
  }
  else if (state === STATES.OUTCOME || state === STATES.LEADERBOARD) {
    screenOutcome.classList.remove('hidden');
    screenBattle.classList.add('hidden'); // Optional: keep it behind for effects
  }
}

// ==============================
// USER INPUT HANDLERS
// ==============================
function joinSchool(schoolKey) {
  const phone = inputPhone.value.trim();
  if (!phone) return alert("Please enter your Tri number.");
  
  phoneNum = phone;
  selectedSchool = currentMatch[schoolKey];
  
  socket.emit('USER_JOIN_SESSION', { phoneNum, selectedSchoolCard: selectedSchool });
  
  inputPhone.classList.add('hidden');
  schoolSelection.classList.add('hidden');
  waitingMsg.classList.remove('hidden');
  waitingMsg.innerText = `You joined ${selectedSchool}. Waiting for battle...`;
}

btnSchoolA.addEventListener('click', () => joinSchool('schoolA'));
btnSchoolB.addEventListener('click', () => joinSchool('schoolB'));

// Tap Handler (Client-side batching)
tapZone.addEventListener('touchstart', (e) => {
  e.preventDefault(); // Prevent zoom/scroll
  handleTap(e.touches[0].clientX, e.touches[0].clientY);
});
tapZone.addEventListener('mousedown', (e) => {
  handleTap(e.clientX, e.clientY);
});

function handleTap(x, y) {
  batchedTaps++;
  
  // Visual Feedback
  const feedback = document.createElement('div');
  feedback.classList.add('tap-feedback');
  feedback.style.left = `${x}px`;
  feedback.style.top = `${y}px`;
  
  // Color based on selected school
  if (selectedSchool === currentMatch.schoolA) {
    feedback.innerText = "+1";
    feedback.style.color = '#FF0066';
  } else {
    feedback.innerText = "+1";
    feedback.style.color = '#00E5FF';
  }
  
  document.body.appendChild(feedback);
  
  setTimeout(() => {
    feedback.remove();
  }, 800);
}

// ==============================
// CANVAS 2D RENDER LOOP
// ==============================
let particles = [];
function renderCanvas() {
  reqAnimFrame = requestAnimationFrame(renderCanvas);
  
  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const midX = canvas.width / 2;
  const centerY = canvas.height / 2;
  
  // Draw Tug of War line position based on ratioA
  // 50% ratio = middle of screen
  const clashX = (ratioA / 100) * canvas.width;
  
  // Just particle system on canvas, no sprites.

  // Particle System
  if (Math.random() > 0.5) {
    particles.push({
      x: clashX + (Math.random() - 0.5) * 50,
      y: centerY + (Math.random() - 0.5) * 50,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      life: 1.0,
      color: Math.random() > 0.5 ? '#FF0066' : '#00E5FF'
    });
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.05;
    
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
    
    if (p.life <= 0) particles.splice(i, 1);
  }
}
