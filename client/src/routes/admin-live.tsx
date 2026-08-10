import { createFileRoute, Link } from '@tanstack/react-router';
import { formatClock, matchActions, useMatch } from '@/lib/matchStore';

export const Route = createFileRoute('/admin-live')({
  component: AdminLiveRoute,
});

const MAGENTA = '#FF0066';
const CYAN = '#00E5FF';

function AdminLiveRoute() {
  const match = useMatch();

  const bothReady = Boolean(match.players.kicker && match.players.goalie);
  const remaining = match.endsAt ? Math.max(0, match.endsAt - Date.now()) : match.durationSec * 1000;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] p-4 font-sans selection:bg-tri-magenta/30">
      <div className="w-full max-w-sm space-y-4">
        {/* Header */}
        <header className="flex flex-col items-center gap-1 pb-4">
          <h1 className="font-display text-xl font-black uppercase tracking-[0.25em] text-white">
            <span className="tri-text-magenta">TRI</span> <span className="text-white/40">LTB</span> 2026
          </h1>
          <p className="font-tech text-[10px] tracking-[0.4em] text-white/50">LIVE CONTROL</p>
        </header>

        <section className="tri-glass rounded-2xl border border-white/15 p-4">
          <div className="mb-2 text-center">
            <h2 className="font-display text-xs font-black tracking-[0.2em] text-white/80">{match.seriesLabel}</h2>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-center">
            <div
              className="rounded-xl border-2 px-2 py-3 transition-colors"
              style={{ borderColor: match.players.kicker ? MAGENTA : `${MAGENTA}44` }}
            >
              <p className="tri-text-magenta font-display text-xs font-black tracking-[0.2em]">KICKER</p>
              <p className="font-tech text-sm font-bold truncate px-1">
                {match.players.kicker?.school || '—'}
              </p>
              <p className="font-tech text-[9px] tracking-widest text-white/45">
                {match.players.kicker?.name || 'belum join'}
              </p>
              <p className="font-display text-2xl font-black tabular-nums">{match.taps.kicker}</p>
            </div>
            <div
              className="rounded-xl border-2 px-2 py-3 transition-colors"
              style={{ borderColor: match.players.goalie ? CYAN : `${CYAN}44` }}
            >
              <p className="tri-text-cyan font-display text-xs font-black tracking-[0.2em]">GOALIE</p>
              <p className="font-tech text-sm font-bold truncate px-1">
                {match.players.goalie?.school || '—'}
              </p>
              <p className="font-tech text-[9px] tracking-widest text-white/45">
                {match.players.goalie?.name || 'belum join'}
              </p>
              <p className="font-display text-2xl font-black tabular-nums">{match.taps.goalie}</p>
            </div>
          </div>

          <p className="mt-3 text-center font-tech text-[11px] tracking-[0.3em] text-white/55">
            STATUS: {match.state} &middot; {formatClock(remaining)}
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={!bothReady || match.state !== 'LOBBY'}
              onClick={() => matchActions.startCharging()}
              className="rounded-xl border-2 border-white/60 py-3 font-display text-xs font-black tracking-[0.2em] transition-all disabled:opacity-40"
              style={{ boxShadow: bothReady && match.state === 'LOBBY' ? `0 0 16px ${MAGENTA}` : 'none' }}
            >
              START
            </button>
            <button
              type="button"
              disabled={match.state !== 'BATTLE'}
              onClick={() => matchActions.stop()}
              className="rounded-xl border-2 border-white/60 py-3 font-display text-xs font-black tracking-[0.2em] transition-all disabled:opacity-40"
              style={{ boxShadow: match.state === 'BATTLE' ? `0 0 16px ${CYAN}` : 'none' }}
            >
              STOP
            </button>
            <button
              type="button"
              onClick={() => matchActions.reset()}
              className="rounded-xl border-2 border-white/30 py-3 font-display text-xs font-black tracking-[0.2em] transition-all active:scale-95"
            >
              RESET
            </button>
          </div>
        </section>

        <Link
          to="/admin"
          className="block w-full rounded-xl border border-white/25 py-3 text-center font-tech text-[11px] font-bold tracking-[0.3em] text-white/70 hover:bg-white/5"
        >
          KEMBALI KE LOBBY MAKER
        </Link>
      </div>
    </div>
  );
}
