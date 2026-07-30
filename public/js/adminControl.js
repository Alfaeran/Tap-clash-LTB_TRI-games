const socket = io();

// UI Elements
const serverStateTxt = document.getElementById('server-state');
const panelSetup = document.getElementById('panel-setup');
const panelLive = document.getElementById('panel-live');

const selectCategory = document.getElementById('match-category');
const inputSchoolA = document.getElementById('school-a');
const inputSchoolB = document.getElementById('school-b');
const inputCity = document.getElementById('series-city');
const btnPublish = document.getElementById('btn-publish');
const btnStartCountdown = document.getElementById('btn-start-countdown');
const btnStopBattle = document.getElementById('btn-stop-battle');

const liveSchoolA = document.getElementById('live-school-a');
const liveSchoolB = document.getElementById('live-school-b');
const liveTapsA = document.getElementById('live-taps-a');
const liveTapsB = document.getElementById('live-taps-b');

let currentState = 'STATE_ADMIN_SETUP';

socket.on('STATE_UPDATE', (data) => {
  currentState = data.state;
  serverStateTxt.innerText = currentState;

  if (currentState === 'STATE_ADMIN_SETUP') {
    panelSetup.classList.remove('hidden');
    panelLive.classList.add('hidden');
  } 
  else {
    panelSetup.classList.add('hidden');
    panelLive.classList.remove('hidden');
    
    if (data.match) {
      liveSchoolA.innerText = data.match.schoolA;
      liveSchoolB.innerText = data.match.schoolB;
    }

    if (currentState === 'STATE_CARD_SELECT') {
      btnStartCountdown.classList.remove('hidden');
      btnStopBattle.classList.add('hidden');
      btnStartCountdown.disabled = false;
      btnStartCountdown.innerText = "Start Countdown (3s)";
    }
    else if (currentState === 'STATE_CHARGING') {
      btnStartCountdown.disabled = true;
      btnStartCountdown.innerText = "Charging...";
    }
    else if (currentState === 'STATE_TAP_BATTLE') {
      btnStartCountdown.classList.add('hidden');
      btnStopBattle.classList.remove('hidden');
    }
    else if (currentState === 'STATE_OUTCOME' || currentState === 'STATE_LEADERBOARD') {
      btnStopBattle.classList.add('hidden');
    }
  }
});

socket.on('RATIO_UPDATE', (data) => {
  liveTapsA.innerText = data.schoolATaps;
  liveTapsB.innerText = data.schoolBTaps;
});

// Admin Actions
btnPublish.addEventListener('click', () => {
  const schoolA = inputSchoolA.value.trim();
  const schoolB = inputSchoolB.value.trim();
  const city = inputCity.value.trim();

  if (!schoolA || !schoolB || !city) return alert('Fill all fields');

  socket.emit('ADMIN_SET_MATCH', { schoolA, schoolB, seriesCity: city });
});

btnStartCountdown.addEventListener('click', () => {
  socket.emit('ADMIN_START_COUNTDOWN');
});

btnStopBattle.addEventListener('click', () => {
  socket.emit('ADMIN_STOP_BATTLE');
});

// Data Schools
const schoolsData = {
  SMA: [
    "MAN 2 YOGYAKARTA", "SMAN 1 SEYEGAN", "SMAN 4 YOGYAKARTA", "SMKN 2 KLATEN", 
    "SMKN 2 YOGYAKARTA", "SMA ISLAM AL AZHAR 9", "SMAN 8 YOGYAKARTA", 
    "SMAN 10 YOGYAKARTA", "SMAN 3 KLATEN", "SMAN 7 YOGYAKARTA", 
    "SMKN 2 DEPOK SLEMAN", "SMKN 4 YOGYAKARTA", "SMA BOPKRI 1 YOGYAKARTA", 
    "SMAM 3 YOGYAKARTA", "SMAN 1 GODEAN", "SMKN 1 YOGYAKARTA", "SMAN 6 YOGYAKARTA", 
    "SMAN 1 GAMPING SLEMAN", "SMAN 1 WATES", "SMAN 1 TANJUNGSARI", 
    "SMK SMTI YOGYAKARTA", "SMKN 3 YOGYAKARTA", "SMK PENERBANGAN AAG", "SMA ALI MAKSUM BANTUL"
  ],
  SMP: [
    "SMPN 7 YOGYAKARTA", "SMPN 16 YOGYAKARTA", "SMP IT ALAM NURUL ISLAM", 
    "SMPN 13 YOGYAKARTA", "SMP JOANNES BOSCO YOGYAKARTA", "SMPN 5 YOGYAKARTA", 
    "SMPN 8 YOGYAKARTA", "SMPM 8 YOGYAKARTA"
  ]
};

// Initialize Tom Select
let tsCategory, tsSchoolA, tsSchoolB;

document.addEventListener('DOMContentLoaded', () => {
  tsCategory = new TomSelect('#match-category', {
    onChange: function(value) {
      tsSchoolA.clearOptions();
      tsSchoolB.clearOptions();
      tsSchoolA.clear();
      tsSchoolB.clear();
      
      if(value) {
        tsSchoolA.enable();
        tsSchoolB.enable();
        const options = schoolsData[value].map(s => ({value: s, text: s}));
        tsSchoolA.addOptions(options);
        tsSchoolB.addOptions(options);
      } else {
        tsSchoolA.disable();
        tsSchoolB.disable();
      }
    }
  });

  tsSchoolA = new TomSelect('#school-a', {
    valueField: 'value',
    labelField: 'text',
    searchField: 'text',
    placeholder: 'Pilih Sekolah A...'
  });

  tsSchoolB = new TomSelect('#school-b', {
    valueField: 'value',
    labelField: 'text',
    searchField: 'text',
    placeholder: 'Pilih Sekolah B...'
  });
});
