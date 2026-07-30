export interface Match {
  schoolA: string;
  schoolB: string;
}

export interface PlayerStats {
  scoreA: number;
  scoreB: number;
}

export type GameState = 'STATE_WAITING' | 'STATE_SETUP' | 'STATE_CHARGING' | 'STATE_BATTLE' | 'STATE_OUTCOME' | 'STATE_LEADERBOARD';
