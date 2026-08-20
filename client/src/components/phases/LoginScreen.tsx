import { useState } from "react";
import { BoltIcon, ShieldIcon } from "@/components/duel/effects";
import DuelFrame from "@/components/duel/DuelFrame";
import { matchActions, playerSchema, useMatch, type DuelSide } from "@/lib/matchStore";

const MAGENTA = "#FF0066";
const CYAN = "#00E5FF";

export default function LoginScreen() {
  const match = useMatch();
  const [school, setSchool] = useState("");
  const [error, setError] = useState<string | null>(null);

  const side: DuelSide | null = school === match.schools[0] ? "kicker" : school === match.schools[1] ? "goalie" : null;
  const color = side === "kicker" ? MAGENTA : side === "goalie" ? CYAN : "#FFFFFF";
  const joined = side ? match.playerSide === side : false;
  const bothReady = match.playerCounts.kicker > 0 && match.playerCounts.goalie > 0;

  const submit = () => {
    if (!side) {
      setError("Silakan pilih sekolah");
      return;
    }
    setError(null);
    // Since name is not inputted here, we pass an empty string or default name
    matchActions.join(side, { name: "", school });
  };

  return (
    <DuelFrame>
      <div className="relative z-10 flex h-full flex-col gap-4 px-5 py-6">
        <header className="text-center">
          <p className="font-tech text-[10px] tracking-[0.4em] text-white/45">
            {match.seriesLabel}
          </p>
          <h1 className="font-display text-2xl font-black tracking-tight text-white italic">
            TRI LTB <span className="tri-text-magenta">1v1</span> DUEL
          </h1>
          <p className="font-tech text-[11px] tracking-[0.3em] text-white/50">
            {match.isConnected ? "REGISTRASI PEMAIN" : "MENGHUBUNGKAN..."}
          </p>
        </header>

        {/* role picker removed */}
        <div className="tri-glass flex flex-col gap-3 rounded-2xl border border-white/15 p-4">
          {/* NAMA PEMAIN input removed */}

          <div className="flex flex-col gap-1">
            <span className="font-tech text-[10px] tracking-[0.3em] text-white/55">
              SEKOLAH (DISET ADMIN)
            </span>
            <div className="flex flex-col gap-2">
              {match.schools.map((s, idx) => {
                const isKicker = idx === 0;
                const c = isKicker ? MAGENTA : CYAN;
                const roleLabel = isKicker ? "KICKER" : "GOALIE";
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSchool(s)}
                    className="rounded-xl border-2 px-3 py-2.5 text-left font-tech text-sm font-bold tracking-wider text-white transition-transform active:scale-[0.98]"
                    style={{
                      borderColor: school === s ? c : "rgba(255,255,255,0.12)",
                      background: school === s ? `${c}22` : "rgba(0,0,0,0.45)",
                      boxShadow: school === s ? `0 0 18px ${c}55` : undefined,
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span>{s}</span>
                      <span className="text-[10px] tracking-[0.2em] opacity-70" style={{ color: c }}>{roleLabel}</span>
                    </div>
                  </button>
                );
              })}
              {match.schools.length === 0 && (
                <div className="flex flex-col items-center justify-center p-6 text-center animate-pulse">
                  <p className="font-tech text-xs text-white/60 mb-2 font-bold tracking-[0.1em]">
                    MENUNGGU LOBBY...
                  </p>
                  <p className="font-tech text-[9px] text-white/40 tracking-[0.05em]">
                    Admin belum menambahkan sekolah untuk match ini.
                  </p>
                </div>
              )}
            </div>
          </div>

          {error && (
            <p className="font-tech text-xs font-semibold tracking-wide text-tri-danger">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            className="rounded-xl border-2 border-white/60 bg-black/60 py-3 font-display text-sm font-black tracking-[0.25em] text-white transition-transform active:scale-95"
            style={{ boxShadow: `0 0 22px ${color}` }}
          >
            {joined ? "GANTI TEAM" : "MASUK ARENA"}
          </button>
        </div>

        <div className="mt-auto text-center">
          <p
            className="font-tech text-[11px] tracking-[0.3em]"
            style={{ color: bothReady ? CYAN : "rgba(255,255,255,0.45)" }}
          >
            {bothReady
              ? "KEDUA PEMAIN SIAP · MENUNGGU ADMIN START"
              : "MENUNGGU KICKER & GOALIE SIAP"}
          </p>
          <p className="mt-2 font-tech text-[10px] tracking-[0.25em] text-white/30">
            PANEL ADMIN: /admin
          </p>
        </div>
      </div>
    </DuelFrame>
  );
}
