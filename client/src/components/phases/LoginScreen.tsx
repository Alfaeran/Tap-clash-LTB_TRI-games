import { useState } from "react";
import { Link } from "@tanstack/react-router";
import DuelFrame from "@/components/duel/DuelFrame";
import { matchActions, useMatch, type DuelSide } from "@/lib/matchStore";

const MAGENTA = "#FF0066";
const CYAN = "#00E5FF";
const GOLD = "#EAB308";

export default function LoginScreen() {
  const match = useMatch();
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validatedMatch, setValidatedMatch] = useState<any>(null); // { id, schoolA, schoolB, seriesCity }
  const [selectedSchool, setSelectedSchool] = useState("");

  const handleValidateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (accessCode.length !== 6) {
      setError("Kode akses harus 6 digit");
      return;
    }
    setError(null);
    setValidating(true);
    const res = await matchActions.validateCode(accessCode);
    setValidating(false);
    
    if (res.success && res.match) {
      setValidatedMatch(res.match);
      // Auto update store to listen to this match events
      // Though store is updated globally by STATE_UPDATE when active.
    } else {
      setError(res.message || "Kode akses tidak valid");
    }
  };

  const handleJoin = () => {
    if (!selectedSchool) {
      setError("Silakan pilih sekolah Anda");
      return;
    }
    const side: DuelSide = selectedSchool === validatedMatch.schoolA ? "kicker" : "goalie";
    setError(null);
    matchActions.join(side, { name: "", school: selectedSchool });
  };

  // If player joined, show waiting state
  if (match.playerSide && match.status === 'lobby') {
    const bothReady = match.playerCounts.kicker > 0 && match.playerCounts.goalie > 0;
    return (
      <DuelFrame>
        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-6 px-5 py-8 text-center">
          <div className="h-1 w-24 rounded-full" style={{ background: `linear-gradient(90deg, ${MAGENTA}, ${CYAN})` }} />
          <div>
            <h2 className="font-display text-xl font-black text-white tracking-widest">
              MENUNGGU ADMIN
            </h2>
            <p className="mt-2 font-tech text-[10px] tracking-[0.3em] text-white/50">
              MOHON TUNGGU INSTRUKSI PANITIA
            </p>
          </div>
          <div className="mt-8 rounded-2xl border-2 border-white/20 bg-black/40 p-6 shadow-[0_0_30px_rgba(255,255,255,0.05)]">
             <p className="font-tech text-xs tracking-[0.2em] text-white/70">
               KAMU BERMAIN SEBAGAI
             </p>
             <p 
              className="mt-2 font-display text-3xl font-black tracking-widest"
              style={{ color: match.playerSide === 'kicker' ? MAGENTA : CYAN, textShadow: `0 0 20px ${match.playerSide === 'kicker' ? MAGENTA : CYAN}` }}
             >
               {match.playerSide.toUpperCase()}
             </p>
          </div>
          <p className="mt-12 font-tech text-[11px] font-bold tracking-[0.2em]" style={{ color: bothReady ? CYAN : MAGENTA }}>
            {bothReady ? "KEDUA PEMAIN SIAP · MATCH AKAN DIMULAI" : "MENUNGGU LAWAN BERGABUNG..."}
          </p>
        </div>
      </DuelFrame>
    );
  }

  // School Selection Phase
  if (validatedMatch && !match.playerSide) {
    return (
      <DuelFrame>
        <div className="relative z-10 flex h-full flex-col gap-6 px-5 py-8">
          <header className="text-center">
            <h1 className="font-display text-2xl font-black tracking-tight text-white italic">
              PILIH SEKOLAH
            </h1>
            <p className="font-tech text-[10px] tracking-[0.4em] text-white/50 mt-1">
              {validatedMatch.seriesCity}
            </p>
          </header>

          <div className="flex flex-col gap-4 mt-4">
            {[validatedMatch.schoolA, validatedMatch.schoolB].map((s, idx) => {
              if (!s) return null;
              const isKicker = idx === 0;
              const c = isKicker ? MAGENTA : CYAN;
              const roleLabel = isKicker ? "KICKER" : "GOALIE";
              return (
                <button
                  key={s}
                  onClick={() => setSelectedSchool(s)}
                  className="rounded-xl border-2 px-4 py-6 text-left transition-all active:scale-[0.98]"
                  style={{
                    borderColor: selectedSchool === s ? c : "rgba(255,255,255,0.15)",
                    background: selectedSchool === s ? `${c}22` : "rgba(0,0,0,0.45)",
                    boxShadow: selectedSchool === s ? `0 0 20px ${c}44` : undefined,
                  }}
                >
                  <p className="font-tech text-[10px] tracking-[0.3em] opacity-80" style={{ color: c }}>
                    {roleLabel}
                  </p>
                  <p className="mt-1 font-display text-lg font-bold text-white tracking-wide">
                    {s}
                  </p>
                </button>
              );
            })}
          </div>

          {error && <p className="text-center font-tech text-xs font-semibold tracking-wide text-[#FF2D2D]">{error}</p>}

          <button
            onClick={handleJoin}
            disabled={!selectedSchool}
            className="mt-auto rounded-xl border-2 py-4 font-display text-sm font-black tracking-[0.25em] transition-all disabled:opacity-40 disabled:border-white/20"
            style={{ 
              borderColor: selectedSchool === validatedMatch.schoolA ? MAGENTA : selectedSchool === validatedMatch.schoolB ? CYAN : "white",
              color: selectedSchool ? "#fff" : "rgba(255,255,255,0.5)",
              boxShadow: selectedSchool ? `0 0 25px ${selectedSchool === validatedMatch.schoolA ? MAGENTA : CYAN}66` : "none"
            }}
          >
            GABUNG SEKARANG
          </button>
        </div>
      </DuelFrame>
    );
  }

  // Main Landing Portal
  return (
    <DuelFrame>
      <div className="relative z-10 flex h-full flex-col px-4 py-6 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {/* Header & Leaderboard Button */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-xl font-black uppercase tracking-[0.25em] text-white">
              <span className="tri-text-magenta">TRI</span> <span className="text-white/90">LTB</span> 2026
            </h1>
            <p className="font-tech text-[9px] tracking-[0.4em] text-white/50">REFLEX DUEL CLASH</p>
          </div>
          <Link
            to="/leaderboard"
            className="rounded-full border border-white/20 bg-white/5 px-4 py-2 font-display text-[10px] font-black tracking-widest text-white shadow-lg backdrop-blur-sm transition-all active:scale-95"
            style={{ boxShadow: `0 0 15px ${GOLD}33`, borderColor: `${GOLD}66` }}
          >
            KLASEMEN
          </Link>
        </header>

        {/* Access Code Input */}
        <div className="tri-glass rounded-2xl border border-white/15 p-5 mb-8">
          <h2 className="text-center font-display text-sm font-black tracking-[0.2em] text-cyan-400 mb-4">
            MASUK KE PERTANDINGAN
          </h2>
          <form onSubmit={handleValidateCode} className="flex flex-col gap-3">
            <input
              type="text"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6 DIGIT KODE AKSES"
              className="w-full rounded-xl border border-white/20 bg-black/60 px-4 py-4 text-center font-display text-2xl font-black tracking-[0.5em] text-white outline-none placeholder:text-white/20 focus:border-tri-magenta transition-colors"
            />
            {error && <p className="text-center font-tech text-[10px] text-[#FF2D2D] font-bold tracking-widest">{error}</p>}
            <button
              type="submit"
              disabled={validating || accessCode.length !== 6}
              className="w-full rounded-xl bg-tri-magenta py-3 font-display text-sm font-black tracking-[0.25em] text-white shadow-[0_0_20px_rgba(255,0,102,0.4)] transition-all disabled:opacity-40 disabled:shadow-none active:scale-[0.98]"
            >
              {validating ? "MEMERIKSA..." : "VALIDASI KODE"}
            </button>
          </form>
        </div>

        {/* Scheduled Matches Carousel */}
        <section className="mb-8">
          <h3 className="font-tech text-[10px] font-bold tracking-[0.3em] text-white/50 mb-3 ml-1">JADWAL PERTANDINGAN</h3>
          {match.scheduledMatches.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/30 py-6 text-center">
              <p className="font-tech text-[10px] tracking-widest text-white/30">TIDAK ADA JADWAL</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory hide-scrollbar">
              {match.scheduledMatches.map((m) => (
                <div key={m.id} className="snap-center shrink-0 w-[260px] rounded-xl border border-white/15 bg-gradient-to-br from-white/5 to-transparent p-4 backdrop-blur-sm">
                  <div className="flex justify-between items-center mb-3">
                    <span className="rounded bg-white/10 px-2 py-0.5 font-tech text-[9px] font-bold tracking-widest text-white">
                      {m.scheduledTime || "TBD"}
                    </span>
                    <span className="font-tech text-[8px] tracking-[0.2em] text-cyan-400">{m.seriesCity}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-tri-magenta" />
                      <p className="truncate font-display text-xs font-bold text-white">{m.schoolA}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-tri-cyan" />
                      <p className="truncate font-display text-xs font-bold text-white">{m.schoolB}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Completed Matches History */}
        <section className="pb-8">
          <h3 className="font-tech text-[10px] font-bold tracking-[0.3em] text-white/50 mb-3 ml-1">HASIL PERTANDINGAN</h3>
          <div className="flex flex-col gap-3">
            {match.completedMatches.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/30 py-6 text-center">
                <p className="font-tech text-[10px] tracking-widest text-white/30">BELUM ADA HASIL</p>
              </div>
            ) : (
              match.completedMatches.map((m) => {
                const draw = m.winnerSchool === 'DRAW';
                return (
                  <div key={m.id} className="rounded-xl border border-white/10 bg-black/40 p-3">
                    <p className="mb-2 text-center font-tech text-[8px] tracking-[0.3em] text-white/40">{m.seriesCity}</p>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 text-right">
                        <p className={`font-display text-xs font-bold truncate ${m.winnerSchool === m.schoolA ? 'text-tri-magenta' : 'text-white/60'}`}>
                          {m.schoolA}
                        </p>
                        <p className="font-display text-lg font-black text-white tabular-nums">
                          {m.finalScoreA}
                        </p>
                      </div>
                      
                      <div className="flex flex-col items-center justify-center w-12 shrink-0">
                        <span className="font-tech text-[10px] font-bold tracking-widest text-white/30 mb-1">VS</span>
                        {draw ? (
                          <span className="rounded bg-yellow-500/20 px-2 py-0.5 font-tech text-[8px] font-bold text-yellow-500">DRAW</span>
                        ) : (
                          <span className="rounded bg-white/10 px-2 py-0.5 font-tech text-[8px] font-bold text-white">FT</span>
                        )}
                      </div>

                      <div className="flex-1 text-left">
                        <p className={`font-display text-xs font-bold truncate ${m.winnerSchool === m.schoolB ? 'text-tri-cyan' : 'text-white/60'}`}>
                          {m.schoolB}
                        </p>
                        <p className="font-display text-lg font-black text-white tabular-nums">
                          {m.finalScoreB}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </DuelFrame>
  );
}
