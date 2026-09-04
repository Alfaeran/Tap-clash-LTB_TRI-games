import { useEffect, useSyncExternalStore } from "react";
import { z } from "zod";
import { io } from "socket.io-client";

export type DuelSide = "kicker" | "goalie";
export type MatchStatus = "lobby" | "charging" | "live" | "finished" | "leaderboard";

export interface PlayerInfo {
  name: string;
  school: string;
}

export type MatchState = {
  isConnected: boolean;
  status: MatchStatus;
  schools: string[];
  seriesLabel: string;
  matchId: string | null;
  activeMatchCode: string | null; // 6-digit code for active match
  taps: { kicker: number; goalie: number };
  playerCounts: { kicker: number; goalie: number };
  winner: DuelSide | "draw" | null;
  endsAt: number | null; // For countdown timers
  chargingEndsAt: number | null;
  durationSec: number;
  playerSide: DuelSide | null; // which side this client is playing
  leaderboard: Array<{ school: string, points: number, wins: number, losses: number, draws: number, taps: number }>;
  isAdmin: boolean; // server-confirmed: this socket may emit ADMIN_* events
  
  scheduledMatches: Array<{ id: string, schoolA: string, schoolB: string, seriesCity: string, scheduledTime: string, status: string, durationMin?: number }>;
  completedMatches: Array<{ id: string, schoolA: string, schoolB: string, seriesCity: string, finalScoreA: number, finalScoreB: number, winnerSchool: string, timestamp: number }>;
};

export const CHARGING_MS = 3200;

// B-1: mirrors CLIENT_BATCH_RATE_MS in config/gameSettings.js. Taps accumulate
// locally and ship as one counted event per window instead of one event per tap.
const TAP_BATCH_MS = 100;
const ADMIN_TOKEN_KEY = "ltb.adminToken";

const DEFAULT_STATE: MatchState = {
  schools: [],
  seriesLabel: "LIGA TENDANG BOLA",
  matchId: null,
  activeMatchCode: null,
  taps: { kicker: 0, goalie: 0 },
  playerCounts: { kicker: 0, goalie: 0 },
  status: "lobby",
  winner: null,
  endsAt: null,
  chargingEndsAt: null,
  durationSec: 10,
  playerSide: null,
  isConnected: false,
  leaderboard: [],
  isAdmin: false,
  scheduledMatches: [],
  completedMatches: [],
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

function readAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    // ?adminToken=... lets an operator bookmark an authenticated admin URL once.
    const fromUrl = new URLSearchParams(window.location.search).get("adminToken");
    if (fromUrl) {
      window.localStorage.setItem(ADMIN_TOKEN_KEY, fromUrl);
      return fromUrl;
    }
    return window.localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null; // private mode / storage disabled
  }
}

// --- B-1: client-side tap batching ---
let tapBuffer: Record<DuelSide, number> = { kicker: 0, goalie: 0 };
let tapFlushTimer: ReturnType<typeof setInterval> | null = null;

function flushTapBuffer() {
  const matchId = state.matchId;
  for (const side of ["kicker", "goalie"] as DuelSide[]) {
    const count = tapBuffer[side];
    if (count <= 0) continue;
    tapBuffer[side] = 0;
    socket?.emit("TAP_BATCH", {
      matchId,
      team: side === "kicker" ? "A" : "B",
      count,
    });
  }
}

function startTapFlush() {
  if (tapFlushTimer) return;
  tapFlushTimer = setInterval(flushTapBuffer, TAP_BATCH_MS);
}

function stopTapFlush() {
  if (!tapFlushTimer) return;
  clearInterval(tapFlushTimer);
  tapFlushTimer = null;
  flushTapBuffer(); // ship whatever is left before going idle
}

function initSocket() {
  if (socketInitialized || typeof window === "undefined") return;
  socketInitialized = true;
  
  const adminToken = readAdminToken();
  socket = io(adminToken ? { auth: { adminToken } } : undefined);

  socket.on('connect', () => set({ isConnected: true }));
  socket.on('disconnect', () => {
    set({ isConnected: false });
    stopTapFlush();
  });

  socket.on('AUTH_STATE', (data: { isAdmin: boolean }) => {
    set({ isAdmin: Boolean(data?.isAdmin) });
  });

  socket.on('ADMIN_UNAUTHORIZED', (data: { event: string }) => {
    console.warn('Admin action rejected by server:', data?.event);
    set({ isAdmin: false });
  });

  socket.on('STATE_UPDATE', (data: any) => {
    // Map backend states to frontend MatchStatus
    let nextStatus: MatchStatus = 'lobby';
    if (data.state === 'STATE_CARD_SELECT') nextStatus = 'lobby'; // Card select is still lobby phase for players
    if (data.state === 'STATE_CHARGING') nextStatus = 'charging';
    if (data.state === 'STATE_TAP_BATTLE') nextStatus = 'live';
    if (data.state === 'STATE_OUTCOME_ANIMATION') nextStatus = 'finished';
    if (data.state === 'STATE_LEADERBOARD') nextStatus = 'leaderboard';

    const isSetup = data.state === 'STATE_ADMIN_SETUP';

    set({ 
      status: nextStatus,
      schools: isSetup ? [] : (data.match && data.match.schoolA ? [data.match.schoolA, data.match.schoolB] : state.schools),
      seriesLabel: data.match && data.match.seriesCity ? data.match.seriesCity : state.seriesLabel,
      playerCounts: data.playerCounts || state.playerCounts,
      matchId: isSetup ? null : (data.match && data.match.id ? data.match.id : state.matchId),
      activeMatchCode: data.activeMatchCode || null,
      // If the match was reset by the admin, force the player to clear their side and rejoin
      playerSide: isSetup ? null : state.playerSide
    });
  });

  socket.on('MATCH_LISTS_UPDATE', (data: any) => {
    set({
      scheduledMatches: data.scheduledMatches || [],
      completedMatches: data.completedMatches || [],
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
    tapBuffer = { kicker: 0, goalie: 0 };
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
    stopTapFlush();
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
  leave() {
    set({ playerSide: null });
    if (socket) {
      socket.emit('USER_LEAVE_SESSION');
    }
  },
  setupMatch(schoolA: string, schoolB: string, seriesCity: string) {
    if (socket) socket.emit('ADMIN_SET_MATCH', { schoolA, schoolB, seriesCity });
  },
  scheduleMatch(schoolA: string, schoolB: string, seriesCity: string, scheduledTime: string, durationSec?: number) {
    if (socket) socket.emit('ADMIN_SCHEDULE_MATCH', { schoolA, schoolB, seriesCity, scheduledTime, durationSec });
  },
  startScheduled(id: string) {
    if (socket) socket.emit('ADMIN_START_SCHEDULED', { id });
  },
  deleteScheduled(id: string) {
    if (socket) socket.emit('ADMIN_DELETE_SCHEDULED', { id });
  },
  validateCode(code: string): Promise<{ success: boolean; match?: any; message?: string }> {
    return new Promise((resolve) => {
      if (!socket || !socket.connected) {
        return resolve({ success: false, message: 'Terputus dari server. Memuat ulang koneksi...' });
      }
      
      let isResolved = false;
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          resolve({ success: false, message: 'Server tidak merespons (Timeout).' });
        }
      }, 5000);

      socket.emit('USER_VALIDATE_CODE', { code }, (response: any) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          resolve(response);
        }
      });
    });
  },
  startCharging(durationSec?: number) {
    if (socket) {
      socket.emit('ADMIN_START_COUNTDOWN', { durationSec });
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

    // B-1: buffer locally; the flush timer emits one counted event per window.
    tapBuffer[side] += 1;
    startTapFlush();
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
    stopTapFlush();
    set({ ...DEFAULT_STATE, isConnected: state.isConnected, isAdmin: state.isAdmin });
  },
  resetAll() {
    stopTapFlush();
    set({
      ...DEFAULT_STATE,
      schools: state.schools,
      seriesLabel: state.seriesLabel,
      isConnected: state.isConnected,
      isAdmin: state.isAdmin,
    });
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
