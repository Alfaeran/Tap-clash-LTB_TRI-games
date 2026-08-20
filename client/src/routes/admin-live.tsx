import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { formatClock, matchActions, useMatch } from '@/lib/matchStore';

export const Route = createFileRoute('/admin-live')({
  component: AdminLiveRoute,
});

const MAGENTA = '#FF0066';
const CYAN = '#00E5FF';

function AdminLiveRoute() {
  const match = useMatch();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [remaining, setRemaining] = useState(match.durationSec * 1000);

  // Live-updating timer
  useEffect(() => {
    if (match.status !== 'live') return;
    let frame = 0;
    const loop = () => {
      const left = Math.max(0, (match.endsAt ?? 0) - Date.now());
      setRemaining(left);
      if (left > 0) frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [match.status, match.endsAt]);

  const bothReady = Boolean(match.playerCounts.kicker > 0 && match.playerCounts.goalie > 0);
  const displayRemaining = match.status === 'live' 
    ? remaining 
    : match.status === 'finished' 
      ? 0 
      : match.durationSec * 1000;

  // Tug-of-war ratio for live score bar
  const total = match.taps.kicker + match.taps.goalie;
  const kickerPct = total === 0 ? 50 : Math.round((match.taps.kicker / total) * 100);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050510] p-4 font-sans selection:bg-tri-magenta/30">
      <div className="w-full max-w-sm space-y-4">
        {/* Header */}
        <header className="flex flex-col items-center gap-1 pb-4">
          <div
            className="mb-2 h-1 w-24 rounded-full"
            style={{
              background: `linear-gradient(90deg, ${MAGENTA}, ${CYAN})`,
              boxShadow: `0 0 12px ${MAGENTA}, 0 0 12px ${CYAN}`,
            }}
          />
          <h1 className="font-display text-xl font-black uppercase tracking-[0.25em] text-white">
            <span className="tri-text-magenta">TRI</span> <span className="text-white/90">LTB</span> 2026
          </h1>
          <p className="font-tech text-[10px] tracking-[0.4em] text-white">LIVE CONTROL</p>
        </header>

        <section className="tri-glass rounded-2xl border border-white/15 p-4">
          <div className="mb-2 text-center">
            <h2 className="font-display text-xs font-black tracking-[0.2em] text-white">{match.seriesLabel}</h2>
          </div>

          {/* Team cards with scores */}
          <div className="mt-3 grid grid-cols-2 gap-3 text-center">
            <div
              className="rounded-xl border-2 px-2 py-3 transition-colors"
              style={{ borderColor: match.playerCounts.kicker > 0 ? MAGENTA : `${MAGENTA}44` }}
            >
              <p className="tri-text-magenta font-display text-xs font-black tracking-[0.2em]">KICKER</p>
              <p className="truncate px-1 font-tech text-sm font-bold">
                {match.schools[0] || '—'}
              </p>
              <p className="font-tech text-[9px] tracking-widest text-white/90">
                {match.playerCounts.kicker} PEMAIN JOINED
              </p>
              <p
                className="font-display text-3xl font-black tabular-nums"
                style={{
                  color: '#fff',
                  textShadow: match.status === 'live' ? `0 0 12px ${MAGENTA}` : undefined,
                }}
              >
                {match.taps.kicker.toLocaleString()}
              </p>
            </div>
            <div
              className="rounded-xl border-2 px-2 py-3 transition-colors"
              style={{ borderColor: match.playerCounts.goalie > 0 ? CYAN : `${CYAN}44` }}
            >
              <p className="tri-text-cyan font-display text-xs font-black tracking-[0.2em]">GOALIE</p>
              <p className="truncate px-1 font-tech text-sm font-bold">
                {match.schools[1] || '—'}
              </p>
              <p className="font-tech text-[9px] tracking-widest text-white/90">
                {match.playerCounts.goalie} PEMAIN JOINED
              </p>
              <p
                className="font-display text-3xl font-black tabular-nums"
                style={{
                  color: '#fff',
                  textShadow: match.status === 'live' ? `0 0 12px ${CYAN}` : undefined,
                }}
              >
                {match.taps.goalie.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Live score ratio bar */}
          {(match.status === 'live' || match.status === 'finished') && total > 0 && (
            <div className="mt-3 overflow-hidden rounded-full border border-white/20 bg-black/60" style={{ height: '8px' }}>
              <div className="flex h-full">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${kickerPct}%`,
                    background: `linear-gradient(90deg, ${MAGENTA}, ${MAGENTA}cc)`,
                    boxShadow: `0 0 8px ${MAGENTA}`,
                  }}
                />
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${100 - kickerPct}%`,
                    background: `linear-gradient(90deg, ${CYAN}cc, ${CYAN})`,
                    boxShadow: `0 0 8px ${CYAN}`,
                  }}
                />
              </div>
            </div>
          )}

          <p className="mt-3 text-center font-tech text-[11px] tracking-[0.3em] text-white">
            STATUS: {match.status.toUpperCase()} &middot; {formatClock(displayRemaining)}
          </p>

          {/* Control buttons */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={!bothReady || match.status !== 'lobby'}
              onClick={() => matchActions.startCharging()}
              className="rounded-xl border-2 border-white/60 py-3 font-display text-xs font-black text-white tracking-[0.2em] transition-all disabled:opacity-40"
              style={{
                boxShadow: bothReady && match.status === 'lobby' ? `0 0 16px ${MAGENTA}` : 'none',
                animation: bothReady && match.status === 'lobby' ? 'tri-pulse-glow 2s ease-in-out infinite' : undefined,
                ['--glow-color' as string]: MAGENTA,
              }}
            >
              START
            </button>
            <button
              type="button"
              disabled={match.status !== 'live'}
              onClick={() => matchActions.stop()}
              className="rounded-xl border-2 border-white/60 py-3 font-display text-xs font-black text-white tracking-[0.2em] transition-all disabled:opacity-40"
              style={{ boxShadow: match.status === 'live' ? `0 0 16px ${CYAN}` : 'none' }}
            >
              STOP
            </button>
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="rounded-xl border-2 border-white/30 py-3 font-display text-xs font-black text-white tracking-[0.2em] transition-all active:scale-95"
            >
              RESET
            </button>
          </div>
        </section>

        <Link
          to="/admin"
          className="block w-full rounded-xl border border-white/40 py-3 text-center font-tech text-[11px] font-bold tracking-[0.3em] text-white hover:bg-white/10"
        >
          KEMBALI KE LOBBY MAKER
        </Link>

        {/* Reset confirmation dialog */}
        {showResetConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-xs rounded-2xl border border-white/15 bg-[#0a0a0a] p-6 text-center">
              <h3 className="font-display text-lg font-black tracking-[0.15em] text-white">
                RESET MATCH?
              </h3>
              <p className="mt-2 font-tech text-xs text-white/60">
                Semua skor dan data pemain akan dihapus. Aksi ini tidak bisa dibatalkan.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="rounded-xl border border-white/60 py-2.5 font-display text-xs font-black tracking-[0.15em] text-white transition-colors hover:bg-white/10"
                >
                  BATAL
                </button>
                <button
                  type="button"
                  onClick={() => {
                    matchActions.resetMatch();
                    setShowResetConfirm(false);
                  }}
                  className="rounded-xl border-2 py-2.5 font-display text-xs font-black tracking-[0.15em] transition-all active:scale-95"
                  style={{
                    borderColor: '#FF2D2D',
                    color: '#FF2D2D',
                    boxShadow: '0 0 15px rgba(255,45,45,0.4)',
                  }}
                >
                  YA, RESET
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
