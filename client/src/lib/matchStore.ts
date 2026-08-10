import { useCallback, useEffect, useSyncExternalStore } from "react";
import { z } from "zod";
import { io } from "socket.io-client";

export type DuelSide = "kicker" | "goalie";
export type MatchStatus = "lobby" | "charging" | "live" | "finished";

export interface PlayerInfo {
  name: string;
  school: string;
}

export interface MatchState {
  schools: string[];
  seriesLabel: string;
  durationSec: number;
  status: MatchStatus;
  players: { kicker: PlayerInfo | null; goalie: PlayerInfo | null };
  taps: { kicker: number; goalie: number };
  chargingEndsAt: number | null;
  endsAt: number | null;
  winner: DuelSide | null;
}

export const CHARGING_MS = 3200;

const DEFAULT_STATE: MatchState = {
  schools: [],
  seriesLabel: "SERI SURABAYA · MATCH DAY 1",
  durationSec: 60,
  status: "lobby",
  players: { kicker: null, goalie: null },
  taps: { kicker: 0, goalie: 0 },
  chargingEndsAt: null,
  endsAt: null,
  winner: null,
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

  socket.on('STATE_UPDATE', (data: any) => {
    // Map backend states to frontend MatchStatus
    let nextStatus: MatchStatus = 'lobby';
    if (data.state === 'STATE_CHARGING') nextStatus = 'charging';
    if (data.state === 'STATE_TAP_BATTLE') nextStatus = 'live';
    if (data.state === 'STATE_OUTCOME' || data.state === 'STATE_LEADERBOARD') nextStatus = 'finished';

    set({ 
      status: nextStatus,
      schools: data.match && data.match.schoolA ? [data.match.schoolA, data.match.schoolB] : state.schools,
      seriesLabel: data.match && data.match.seriesCity ? `${data.match.seriesCity} · MATCH DAY 1` : state.seriesLabel
    });
  });

  socket.on('PLAYER_JOINED', (data: any) => {
    set({
      players: {
        ...state.players,
        [data.side]: { name: data.phoneNum, school: data.selectedSchoolCard }
      }
    });
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

  socket.on('START_BATTLE', () => {
    set({
      status: "live",
      chargingEndsAt: null,
      endsAt: Date.now() + state.durationSec * 1000, // Wait, maybe server defines this, we default to 60s
    });
  });

  socket.on('RATIO_UPDATE', (data: any) => {
    set({
      taps: { kicker: data.schoolATaps, goalie: data.schoolBTaps }
    });
  });

  socket.on('MATCH_END', (data: any) => {
    set({
      status: "finished",
      endsAt: null,
      winner: data.winner === 'A' ? 'kicker' : (data.winner === 'B' ? 'goalie' : null),
      taps: { kicker: data.finalScoreA, goalie: data.finalScoreB }
    });
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
    set({ players: { ...state.players, [side]: info } });
    if (socket) {
      socket.emit('USER_JOIN_SESSION', { 
        phoneNum: info.name, 
        selectedSchoolCard: info.school,
        side: side
      });
    }
  },
  leave(side: DuelSide) {
    set({ players: { ...state.players, [side]: null } });
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
    // Driven by server START_BATTLE
  },
  addTap(side: DuelSide) {
    if (state.status !== "live") return;
    
    // Optimistic UI update
    set({ taps: { ...state.taps, [side]: state.taps[side] + 1 } });
    
    // Emit to server
    if (socket) {
      const matchId = "current"; // Since server doesn't send matchId until ADMIN_SET_MATCH, actually we can just pass the currentMatch id if we had it, but server uses state internally. Let's just pass matchId: "current" (server check is relaxed if we update server.js)
      socket.emit('TAP', { team: side === 'kicker' ? 'A' : 'B', matchId: socket.id });
    }
  },
  finish() {
    // Driven by server MATCH_END
  },
  stop() {
    if (socket) socket.emit('ADMIN_STOP_BATTLE');
  },
  resetMatch() {
    if (socket) socket.emit('ADMIN_RESET');
    set({
      status: "lobby",
      taps: { kicker: 0, goalie: 0 },
      winner: null,
      endsAt: null,
      chargingEndsAt: null,
      players: { kicker: null, goalie: null } // reset players as well
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
    useCallback(() => state, []),
    useCallback(() => DEFAULT_STATE, []),
  );
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
