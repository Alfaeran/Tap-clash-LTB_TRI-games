import { useEffect, useSyncExternalStore } from "react";
import { z } from "zod";
import { io } from "socket.io-client";

export type DuelSide = "kicker" | "goalie";
export type MatchStatus = "lobby" | "charging" | "live" | "finished" | "leaderboard";

export interface PlayerInfo {
  name: string;
  school: string;
}

export interface MatchState {
  schools: string[];
  seriesLabel: string;
  durationSec: number;
  status: MatchStatus;
  playerCounts: { kicker: number; goalie: number };
  taps: { kicker: number; goalie: number };
  chargingEndsAt: number | null;
  endsAt: number | null;
  winner: DuelSide | "draw" | null;
  /** Which side the local player chose (for team-locked tapping) */
  playerSide: DuelSide | null;
  isConnected: boolean;
  matchId: string | null;
  leaderboard: Array<{
    school: string;
    points: number;
    wins: number;
    losses: number;
    draws: number;
    taps: number;
  }>;
}

export const CHARGING_MS = 3200;

const DEFAULT_STATE: MatchState = {
  schools: [],
  seriesLabel: "SERI SURABAYA · MATCH DAY 1",
  durationSec: 60,
  status: "lobby",
  playerCounts: { kicker: 0, goalie: 0 },
  taps: { kicker: 0, goalie: 0 },
  chargingEndsAt: null,
  endsAt: null,
  winner: null,
  playerSide: null,
  isConnected: false,
  matchId: null,
  leaderboard: [],
};

export const playerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Nama minimal 2 karakter" })
    .max(24, { message: "Nama maksimal 24 karakter" }),
  school: z.string().trim().min(1, { message: "Pilih sekolah" }).max(60),
});

let state: MatchState = DEFAULT_STATE;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function set(patch: Partial<MatchState>) {
  state = { ...state, ...patch };
  emit();
}

// --- Socket.IO Integration ---
let socketInitialized = false;
let socket: any = null;

function initSocket() {
  if (socketInitialized || typeof window === "undefined") return;
  socketInitialized = true;
  
  socket = io();

  socket.on('connect', () => set({ isConnected: true }));
  socket.on('disconnect', () => set({ isConnected: false }));

  socket.on('STATE_UPDATE', (data: any) => {
    // Map backend states to frontend MatchStatus
    let nextStatus: MatchStatus = 'lobby';
    if (data.state === 'STATE_CARD_SELECT') nextStatus = 'lobby'; // Card select is still lobby phase for players
    if (data.state === 'STATE_CHARGING') nextStatus = 'charging';
    if (data.state === 'STATE_TAP_BATTLE') nextStatus = 'live';
    if (data.state === 'STATE_OUTCOME_ANIMATION') nextStatus = 'finished';
    if (data.state === 'STATE_LEADERBOARD') nextStatus = 'leaderboard';

    set({ 
      status: nextStatus,
      schools: data.match && data.match.schoolA ? [data.match.schoolA, data.match.schoolB] : state.schools,
      seriesLabel: data.match && data.match.seriesCity ? data.match.seriesCity : state.seriesLabel,
      playerCounts: data.playerCounts || state.playerCounts,
      matchId: data.match && data.match.id ? data.match.id : state.matchId
    });
  });

  socket.on('PLAYER_COUNT_UPDATE', (counts: { kicker: number, goalie: number }) => {
    set({ playerCounts: counts });
  });

  socket.on('PLAYER_JOINED', (data: any) => {
    // Kept for backward compatibility but counts are preferred
  });

  socket.on('START_COUNTDOWN', (data: any) => {
    set({
      status: "charging",
      taps: { kicker: 0, goalie: 0 },
      winner: null,
      endsAt: null,
      chargingEndsAt: Date.now() + data.duration,
    });
  });

  socket.on('START_BATTLE', (data: any) => {
    const durationMs = data?.durationMs ?? state.durationSec * 1000;
    set({
      status: "live",
      chargingEndsAt: null,
      durationSec: Math.round(durationMs / 1000),
      endsAt: Date.now() + durationMs,
    });
  });

  socket.on('RATIO_UPDATE', (data: any) => {
    set({
      taps: { kicker: data.schoolATaps, goalie: data.schoolBTaps }
    });
  });

  socket.on('MATCH_END', (data: any) => {
    let winner: DuelSide | "draw" | null = null;
    if (data.winner === 'A') winner = 'kicker';
    else if (data.winner === 'B') winner = 'goalie';
    else winner = 'draw';
    
    set({
      status: "finished",
      endsAt: null,
      winner,
      taps: { kicker: data.finalScoreA, goalie: data.finalScoreB }
    });
  });

  socket.on('LEADERBOARD_DATA', (data: any) => {
    set({ leaderboard: data.leaderboard });
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const matchActions = {
  setSchools(schools: string[]) {
    set({ schools: schools.map((s) => s.trim().toUpperCase()).filter(Boolean) });
  },
  setSeriesLabel(seriesLabel: string) {
    set({ seriesLabel: seriesLabel.slice(0, 60).toUpperCase() });
  },
  setDuration(durationSec: number) {
    set({ durationSec: Math.min(300, Math.max(10, Math.round(durationSec))) });
  },
  join(side: DuelSide, info: PlayerInfo) {
    set({ playerSide: side });
    if (socket) {
      socket.emit('USER_JOIN_SESSION', { 
        selectedSchoolCard: info.school,
        side: side
      });
    }
  },
  leave(side: DuelSide) {
    set({ playerSide: null });
  },
  setupMatch(schoolA: string, schoolB: string, seriesCity: string) {
    set({ schools: [schoolA, schoolB], seriesLabel: seriesCity });
    if (socket) {
      socket.emit('ADMIN_SET_MATCH', {
        schoolA,
        schoolB,
        seriesCity,
      });
    }
  },
  startCharging() {
    if (socket) {
      socket.emit('ADMIN_START_COUNTDOWN');
    }
  },
  goLive() {
    // No-op: transition is driven by server START_BATTLE event.
    // Do NOT call set() here — the server event handler already does it.
  },
  addTap(side: DuelSide) {
    if (state.status !== "live") return;
    // Only allow tapping for the player's chosen side
    if (state.playerSide && side !== state.playerSide) return;
    
    // Optimistic UI update
    set({ taps: { ...state.taps, [side]: state.taps[side] + 1 } });
    
    // Emit to server
    if (socket) {
      socket.emit('TAP', { matchId: state.matchId, team: side === 'kicker' ? 'A' : 'B' });
    }
  },
  finish() {
    // Safety fallback: force client to 'finished' if server MATCH_END was missed.
    // If the server event arrives later, it will overwrite with correct data.
    if (state.status === 'live') {
      const kickerTaps = state.taps.kicker;
      const goalieTaps = state.taps.goalie;
      let winner: DuelSide | "draw" | null = "draw";
      if (kickerTaps > goalieTaps) winner = "kicker";
      else if (goalieTaps > kickerTaps) winner = "goalie";
      set({
        status: "finished",
        endsAt: null,
        winner,
      });
    }
  },
  stop() {
    if (socket) socket.emit('ADMIN_STOP_BATTLE');
  },
  resetMatch() {
    if (socket) socket.emit('ADMIN_RESET');
    set({
      ...DEFAULT_STATE,
    });
  },
  resetAll() {
    set({ ...DEFAULT_STATE, schools: state.schools, seriesLabel: state.seriesLabel });
  },
};

export function useMatch(): MatchState {
  useEffect(() => {
    initSocket();
  }, []);
  
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => DEFAULT_STATE,
  );
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
