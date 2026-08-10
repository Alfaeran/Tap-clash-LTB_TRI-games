import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ParticleField, ShieldIcon, Shockwaves } from "@/components/duel/effects";
import DuelFrame from "@/components/duel/DuelFrame";
import { useMatch } from "@/lib/matchStore";

const MAGENTA = "#FF0066";
const CYAN = "#00E5FF";

/** GOAL! / BLOCKED! burst, then redirect to the twibbon generator. */
export default function ResultScreen() {
  const match = useMatch();
  const navigate = useNavigate();
  const win = match.winner === "kicker";
  const color = win ? MAGENTA : CYAN;
  const loseColor = win ? CYAN : MAGENTA;

  useEffect(() => {
    const t = setTimeout(() => navigate({ to: "/twibbon" }), 3600);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <DuelFrame>
      <div className="absolute inset-0 z-50 grid place-items-center px-6">
        <div
          className="absolute inset-0 backdrop-blur-md"
          style={{ background: `radial-gradient(circle, ${color}33, rgba(0,0,0,0.9) 68%)` }}
        />
        <Shockwaves color={color} />
        <ParticleField color={color} intensity={1} count={34} direction={win ? "down" : "up"} seed={11} />
        <ParticleField color={loseColor} intensity={0.5} count={18} direction={win ? "up" : "down"} seed={19} />

        <div
          className="relative z-10 flex flex-col items-center gap-3 text-center"
          style={{ animation: "tri-burst-in 0.6s cubic-bezier(0.2,0.9,0.25,1) both" }}
        >
          {!win && (
            <ShieldIcon className="h-24 w-24" style={{ color, filter: `drop-shadow(0 0 26px ${color})` }} />
          )}
          <h2
            className="font-display text-6xl font-black tracking-tighter italic"
            style={{ color, textShadow: `0 0 18px ${color}, 0 0 60px ${color}` }}
          >
            {win ? "GOAL!" : "BLOCKED!"}
          </h2>
          <p className="font-tech text-sm tracking-[0.3em] text-white/70">
            {match.taps.kicker.toLocaleString()} — {match.taps.goalie.toLocaleString()}
          </p>
          <p className="font-tech text-xs tracking-[0.25em] text-white/50">
            {(win ? match.players.kicker : match.players.goalie)?.name?.toUpperCase() ?? "—"} ·{" "}
            {(win ? match.players.kicker : match.players.goalie)?.school ?? ""}
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: "/twibbon" })}
            className="mt-3 rounded-full border-2 border-white/70 bg-black/60 px-8 py-3 font-display text-sm font-black tracking-[0.25em] text-white backdrop-blur-md transition-transform active:scale-95"
            style={{ boxShadow: `0 0 24px ${color}` }}
          >
            BUAT TWIBBON
          </button>
        </div>
      </div>
    </DuelFrame>
  );
}
