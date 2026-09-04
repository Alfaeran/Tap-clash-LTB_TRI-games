import { useEffect, useRef, useState } from "react";
import anime from "animejs";
import { BoltIcon, ElectricArcs, ParticleField, ShieldIcon } from "@/components/duel/effects";
import DuelFrame from "@/components/duel/DuelFrame";
import { formatClock, matchActions, useMatch, type DuelSide } from "@/lib/matchStore";

const MAGENTA = "#FF0066";
const CYAN = "#00E5FF";
const DANGER = "#FF2D2D";

const FRENZY_RATE = 9;
const DECAY_PER_SECOND = 2.6;

export default function BattleScreen() {
  const match = useMatch();
  const [remainingMs, setRemainingMs] = useState(match.durationSec * 1000);
  const [intensity, setIntensity] = useState({ kicker: 0, goalie: 0 });
  const rates = useRef({ kicker: 0, goalie: 0 });

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let safetyTimeout: ReturnType<typeof setTimeout> | null = null;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const decay = Math.exp(-DECAY_PER_SECOND * dt);
      rates.current.kicker *= decay;
      rates.current.goalie *= decay;
      setIntensity({
        kicker: Math.min(1, rates.current.kicker / FRENZY_RATE),
        goalie: Math.min(1, rates.current.goalie / FRENZY_RATE),
      });

      const left = Math.max(0, (match.endsAt ?? 0) - Date.now());
      setRemainingMs(left);
      if (left === 0) {
        // BUG-3 safety: if server MATCH_END is delayed, force transition after 2s
        if (!safetyTimeout) {
          safetyTimeout = setTimeout(() => {
            // Only force if still stuck on 'live'
            if (match.status === 'live') {
              matchActions.finish();
            }
          }, 2000);
        }
      } else {
        frame = requestAnimationFrame(loop);
      }
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      if (safetyTimeout) clearTimeout(safetyTimeout);
    };
  }, [match.endsAt, match.status]);

  const tap = (side: DuelSide) => {
    rates.current[side] = Math.min(FRENZY_RATE * 1.4, rates.current[side] + 1.9);
    matchActions.addTap(side);
    // Haptic feedback on mobile
    if (navigator.vibrate) {
      navigator.vibrate(12);
    }
  };

  const total = match.taps.kicker + match.taps.goalie;
  const rawShare = total === 0 ? 0.5 : match.taps.kicker / total;
  const kickerShare = Math.min(0.92, Math.max(0.08, rawShare));
  const kickerPct = Math.round(kickerShare * 100);
  const urgent = remainingMs <= 10_000;

  const dim = (side: DuelSide) => {
    const own = side === "kicker" ? intensity.kicker : intensity.goalie;
    const other = side === "kicker" ? intensity.goalie : intensity.kicker;
    return other > 0.45 && own < other * 0.5;
  };

  return (
    <DuelFrame>
      {urgent && (
        <div
          className="pointer-events-none absolute inset-0 z-40"
          style={{
            boxShadow: `inset 0 0 90px 24px ${DANGER}`,
            animation: "tri-danger-pulse 0.7s ease-in-out infinite",
          }}
        />
      )}

      <TugBar share={kickerShare} />

      <div className="absolute top-4 left-4 z-50">
        <button
          onClick={() => matchActions.leave()}
          className="rounded-full border border-white/20 bg-black/40 px-4 py-2 font-display text-[10px] font-black tracking-widest text-white backdrop-blur-sm transition-all hover:bg-white/20 active:scale-95"
        >
          KELUAR
        </button>
      </div>

      <div className="relative z-20 flex h-full flex-col gap-2 py-4 pr-3 pl-9">
        <header className="tri-glass shrink-0 rounded-2xl border border-white/15 px-3 py-2 mt-8">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
            <div className="min-w-0">
              <p className="truncate font-tech text-[11px] font-bold tracking-widest text-white/90">
                {match.schools[0] ?? "KICKER TEAM"}
              </p>
              <p className="tri-text-magenta truncate font-tech text-[9px] font-bold tracking-[0.2em]">
                {match.playerCounts.kicker} PEMAIN
              </p>
            </div>
            <p className="font-display text-[9px] tracking-[0.25em] text-white/50">VS</p>
            <div className="min-w-0 text-right">
              <p className="truncate font-tech text-[11px] font-bold tracking-widest text-white/90">
                {match.schools[1] ?? "GOALIE TEAM"}
              </p>
              <p className="tri-text-cyan truncate font-tech text-[9px] font-bold tracking-[0.2em]">
                {match.playerCounts.goalie} PEMAIN
              </p>
            </div>
          </div>
          <p className="mt-1 text-center font-tech text-[9px] tracking-[0.3em] text-white/40">
            {match.seriesLabel}
          </p>
        </header>

        <SideCard
          side="kicker"
          color={MAGENTA}
          label="KICKER"
          taps={match.taps.kicker}
          intensity={intensity.kicker}
          dimmed={dim("kicker")}
          locked={match.playerSide !== null && match.playerSide !== "kicker"}
          onTap={() => tap("kicker")}
        />

        <div className="relative z-30 flex shrink-0 items-center justify-center gap-3">
          <span className="font-display text-2xl font-black text-white/90 italic drop-shadow-[0_0_14px_rgba(255,255,255,0.8)]">
            VS
          </span>
          <span
            className="font-display font-black tabular-nums transition-all duration-300"
            style={
              urgent
                ? {
                    fontSize: "2.6rem",
                    color: DANGER,
                    textShadow: `0 0 10px ${DANGER}, 0 0 34px ${DANGER}`,
                    animation: "tri-vibrate 0.14s linear infinite",
                  }
                : {
                    fontSize: "1.6rem",
                    color: "#fff",
                    textShadow: "0 0 12px rgba(255,255,255,0.6)",
                  }
            }
          >
            {formatClock(remainingMs)}
          </span>
        </div>

        <SideCard
          side="goalie"
          color={CYAN}
          label="GOALIE"
          taps={match.taps.goalie}
          intensity={intensity.goalie}
          dimmed={dim("goalie")}
          locked={match.playerSide !== null && match.playerSide !== "goalie"}
          onTap={() => tap("goalie")}
        />

        <p className="shrink-0 text-center font-tech text-[10px] tracking-[0.25em] text-white/45">
          {kickerPct}% / {100 - kickerPct}%
        </p>
      </div>
    </DuelFrame>
  );
}

/* ============================================================ */

function SideCard({
  side,
  color,
  label,
  taps,
  intensity,
  dimmed,
  locked,
  onTap,
}: {
  side: DuelSide;
  color: string;
  label: string;
  taps: number;
  intensity: number;
  dimmed: boolean;
  locked: boolean;
  onTap: () => void;
}) {
  const tapsRef = useRef<HTMLSpanElement>(null);
  const [pops, setPops] = useState<{ id: number; x: number; y: number }[]>([]);
  const tapId = useRef(0);

  useEffect(() => {
    if (tapsRef.current) {
      anime.remove(tapsRef.current);
      anime({
        targets: tapsRef.current,
        scale: [1.3, 1],
        duration: 300,
        easing: 'easeOutQuad'
      });
    }
  }, [taps]);

  const idle = intensity <= 0.08;
  const glow = 0.18 + intensity * 0.8;
  const alpha = (a: number) => `${color}${Math.round(a * 255).toString(16).padStart(2, "0")}`;

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault(); // BUG-9: prevent text selection, zoom, context menus on mobile
    if (locked) return; // BUG-8: don't register taps on locked (opponent's) card
    onTap();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = tapId.current++;
    setPops((prev) => [...prev, { id, x, y }]);
    setTimeout(() => {
      setPops((prev) => prev.filter((p) => p.id !== id));
    }, 500);
  };

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      className="relative min-h-0 w-full overflow-hidden rounded-3xl border-2 backdrop-blur-md"
      style={{
        flex: 1,
        touchAction: 'manipulation', // BUG-9: prevent browser zoom/scroll on rapid taps
        borderColor: alpha(dimmed || locked ? 0.2 : 0.35 + intensity * 0.6),
        background: `linear-gradient(${side === "kicker" ? "160deg" : "-20deg"}, ${alpha(
          0.16 + intensity * 0.22,
        )}, rgba(26,26,26,0.75))`,
        boxShadow: dimmed || locked
          ? `0 0 10px ${alpha(0.12)}`
          : `0 0 ${14 + intensity * 46}px ${alpha(glow)}, inset 0 0 ${
              20 + intensity * 60
            }px ${alpha(glow * 0.5)}`,
        opacity: locked ? 0.25 : dimmed ? 0.4 : 1,
        animation: intensity > 0.55 && !locked ? "tri-vibrate 0.12s linear infinite" : undefined,
        transition: "opacity 0.35s linear",
        pointerEvents: locked ? 'none' : undefined, // BUG-8: disable pointer events on locked card
      }}
      aria-label={locked ? `${label} (terkunci)` : `Tap untuk ${label}`}
      aria-disabled={locked}
    >
      {idle && (
        <span
          className="pointer-events-none absolute inset-6 rounded-full"
          style={{
            background: `radial-gradient(circle, ${alpha(0.45)}, transparent 68%)`,
            filter: "blur(26px)",
            animation: "tri-breathe 4.2s ease-in-out infinite",
          }}
        />
      )}

      <ElectricArcs color={color} intensity={intensity} seed={side === "kicker" ? 3 : 8} />
      <ParticleField
        color={color}
        intensity={intensity}
        direction={side === "kicker" ? "up" : "down"}
        seed={side === "kicker" ? 1 : 5}
      />

      <span
        className="pointer-events-none absolute inset-x-0 h-8 opacity-25"
        style={{
          background: `linear-gradient(180deg, transparent, ${color}, transparent)`,
          animation: "tri-scanline 5s linear infinite",
        }}
      />

      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-1 px-4">
        {side === "kicker" ? (
          <BoltIcon
            className="h-10 w-10"
            style={{ color, filter: `drop-shadow(0 0 ${6 + intensity * 18}px ${color})` }}
          />
        ) : (
          <ShieldIcon
            className="h-10 w-10"
            style={{ color, filter: `drop-shadow(0 0 ${6 + intensity * 18}px ${color})` }}
          />
        )}
        <span
          className="font-display text-lg font-black tracking-[0.3em]"
          style={{ color, textShadow: `0 0 ${8 + intensity * 22}px ${color}` }}
        >
          {label}
        </span>
        <span
          ref={tapsRef}
          className="font-display text-4xl font-black tabular-nums origin-center inline-block"
          style={{ color: "#fff", textShadow: `0 0 ${10 + intensity * 30}px ${color}` }}
        >
          {taps.toLocaleString()}
        </span>
        <span className="font-tech text-[10px] tracking-[0.3em] text-white/50">
          {idle ? "DORMANT" : intensity > 0.6 ? "OVERDRIVE" : "TAPS"}
        </span>
      </div>
      
      {/* Comic TAP! effect overlay */}
      {pops.map((pop) => (
        <span
          key={pop.id}
          className="absolute z-50 pointer-events-none font-display font-black italic"
          style={{
            left: pop.x,
            top: pop.y,
            transform: "translate(-50%, -50%)",
            fontSize: "2.5rem",
            color: color,
            WebkitTextStroke: "1.5px #fff",
            textShadow: `0 0 10px ${color}, 3px 3px 0px #fff`,
            animation: "tri-burst-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards",
          }}
        >
          TAP!
        </span>
      ))}
    </button>
  );
}

/* ============================================================ */

function TugBar({ share }: { share: number }) {
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLSpanElement>(null);

  const magentaPct = share * 100;
  const dominant = share >= 0.8;
  const crushed = share <= 0.2;

  useEffect(() => {
    anime({
      targets: topRef.current,
      height: `${magentaPct}%`,
      duration: 250,
      easing: 'easeOutElastic(1, .8)'
    });
    anime({
      targets: bottomRef.current,
      height: `${100 - magentaPct}%`,
      duration: 250,
      easing: 'easeOutElastic(1, .8)'
    });
    anime({
      targets: sliderRef.current,
      top: `${magentaPct}%`,
      duration: 250,
      easing: 'easeOutElastic(1, .8)'
    });
  }, [magentaPct]);

  return (
    <div className="absolute top-24 bottom-24 left-2 z-30 w-3">
      <div className="relative h-full w-full overflow-hidden rounded-full border border-white/20 bg-black/70">
        <div
          ref={topRef}
          className="absolute inset-x-0 top-0"
          style={{
            height: `${magentaPct}%`,
            background: `linear-gradient(180deg, ${MAGENTA}, ${MAGENTA}cc)`,
            boxShadow: crushed
              ? `0 0 6px ${MAGENTA}`
              : `0 0 ${dominant ? 26 : 12}px ${MAGENTA}, inset 0 0 10px ${MAGENTA}`,
            animation: crushed ? "tri-flicker 1.6s linear infinite" : undefined,
          }}
        />
        <div
          ref={bottomRef}
          className="absolute inset-x-0 bottom-0"
          style={{
            height: `${100 - magentaPct}%`,
            background: `linear-gradient(0deg, ${CYAN}, ${CYAN}cc)`,
            boxShadow: dominant
              ? `0 0 6px ${CYAN}`
              : `0 0 ${crushed ? 26 : 12}px ${CYAN}, inset 0 0 10px ${CYAN}`,
            animation: dominant ? "tri-flicker 1.6s linear infinite" : undefined,
          }}
        />
      </div>

      <span
        ref={sliderRef}
        className="pointer-events-none absolute -left-2 h-5 w-7 -translate-y-1/2 rounded-full bg-white"
        style={{
          top: `${magentaPct}%`,
          boxShadow: `0 0 18px #fff, 0 0 34px ${share >= 0.5 ? MAGENTA : CYAN}`,
          animation: "tri-flare 0.9s ease-in-out infinite",
        }}
      />

      <span
        className="pointer-events-none absolute top-0 -left-3 h-full w-24"
        style={{
          background: `linear-gradient(90deg, ${share >= 0.5 ? `${MAGENTA}55` : `${CYAN}55`}, transparent)`,
          filter: "blur(22px)",
          opacity: dominant || crushed ? 0.8 : 0.25,
          transition: "opacity 0.4s linear",
        }}
      />
    </div>
  );
}
