import { useEffect, useState, useRef } from "react";
import anime from "animejs";
import DuelFrame from "@/components/duel/DuelFrame";
import { matchActions, useMatch } from "@/lib/matchStore";

const MAGENTA = "#FF0066";
const CYAN = "#00E5FF";

/** Giant countdown before the match goes live. */
export default function ChargingScreen() {
  const match = useMatch();
  const [remaining, setRemaining] = useState(3200);

  useEffect(() => {
    let frame = 0;
    const loop = () => {
      const left = Math.max(0, (match.chargingEndsAt ?? 0) - Date.now());
      setRemaining(left);
      if (left === 0) matchActions.goLive();
      else frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [match.chargingEndsAt]);

  const labelRef = useRef<HTMLSpanElement>(null);
  const count = Math.max(1, Math.ceil(remaining / 1000));
  const label = remaining <= 250 ? "GO!" : String(count);

  useEffect(() => {
    if (labelRef.current) {
      anime.remove(labelRef.current);
      anime({
        targets: labelRef.current,
        scale: [0.2, 1],
        opacity: [0, 1],
        duration: 500,
        easing: 'easeOutElastic(1, .8)'
      });
    }
  }, [label]);

  return (
    <DuelFrame>
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-6 px-6">
        <p className="font-tech text-[11px] tracking-[0.4em] text-white/50">CHARGING…</p>

        <div className="relative grid place-items-center">
          <span
            className="absolute h-56 w-56 rounded-full"
            style={{
              background: `radial-gradient(circle, ${MAGENTA}55, transparent 65%)`,
              filter: "blur(28px)",
              animation: "tri-breathe 1s ease-in-out infinite",
            }}
          />
          <span
            ref={labelRef}
            key={label}
            className="relative font-display font-black tabular-nums text-white"
            style={{
              fontSize: label === "GO!" ? "5rem" : "9rem",
              lineHeight: 1,
              textShadow: `0 0 20px ${MAGENTA}, 0 0 60px ${CYAN}`,
            }}
          >
            {label}
          </span>
        </div>

        <div className="grid w-full grid-cols-2 gap-3 text-center">
          <div className="tri-glass rounded-2xl border-2 px-3 py-3" style={{ borderColor: `${MAGENTA}88` }}>
            <p className="tri-text-magenta font-display text-xs font-black tracking-[0.25em]">KICKER</p>
            <p className="font-tech text-sm font-bold text-white">
              {match.players.kicker?.name ?? "—"}
            </p>
            <p className="font-tech text-[9px] tracking-[0.2em] text-white/45">
              {match.players.kicker?.school ?? ""}
            </p>
          </div>
          <div className="tri-glass rounded-2xl border-2 px-3 py-3" style={{ borderColor: `${CYAN}88` }}>
            <p className="tri-text-cyan font-display text-xs font-black tracking-[0.25em]">GOALIE</p>
            <p className="font-tech text-sm font-bold text-white">
              {match.players.goalie?.name ?? "—"}
            </p>
            <p className="font-tech text-[9px] tracking-[0.2em] text-white/45">
              {match.players.goalie?.school ?? ""}
            </p>
          </div>
        </div>

        <p className="font-tech text-[10px] tracking-[0.3em] text-white/40">
          SIAPKAN JEMPOL · {match.durationSec} DETIK
        </p>
      </div>
    </DuelFrame>
  );
}
