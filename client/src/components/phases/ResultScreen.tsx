import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import anime from "animejs";
import { ParticleField, ShieldIcon, BoltIcon, Shockwaves } from "@/components/duel/effects";
import DuelFrame from "@/components/duel/DuelFrame";
import { useMatch } from "@/lib/matchStore";

const MAGENTA = "#FF0066";
const CYAN = "#00E5FF";
const GOLD = "#EAB308";

/** GOAL! / BLOCKED! / DRAW! burst, then redirect to the twibbon generator. */
export default function ResultScreen() {
  const match = useMatch();
  const navigate = useNavigate();

  const isDraw = match.winner === "draw";
  const win = match.winner === "kicker";
  const color = isDraw ? GOLD : win ? MAGENTA : CYAN;
  const loseColor = isDraw ? GOLD : win ? CYAN : MAGENTA;

  const scoreKickerRef = useRef<HTMLSpanElement>(null);
  const scoreGoalieRef = useRef<HTMLSpanElement>(null);

  // Auto-redirect to leaderboard when backend transitions
  useEffect(() => {
    if (match.status === 'leaderboard') {
      navigate({ to: "/leaderboard" });
    }
  }, [match.status, navigate]);

  // Animate score counting up
  useEffect(() => {
    if (scoreKickerRef.current) {
      anime({
        targets: { val: 0 },
        val: match.taps.kicker,
        round: 1,
        duration: 1200,
        easing: "easeOutExpo",
        update(anim) {
          const obj = anim.animations[0];
          if (scoreKickerRef.current && obj) {
            scoreKickerRef.current.textContent = Math.round(
              Number(obj.currentValue),
            ).toLocaleString();
          }
        },
      });
    }
    if (scoreGoalieRef.current) {
      anime({
        targets: { val: 0 },
        val: match.taps.goalie,
        round: 1,
        duration: 1200,
        easing: "easeOutExpo",
        update(anim) {
          const obj = anim.animations[0];
          if (scoreGoalieRef.current && obj) {
            scoreGoalieRef.current.textContent = Math.round(
              Number(obj.currentValue),
            ).toLocaleString();
          }
        },
      });
    }
  }, [match.taps.kicker, match.taps.goalie]);

  const title = isDraw ? "DRAW!" : win ? "GOAL!" : "BLOCKED!";
  const winnerSchool = isDraw
    ? null
    : win
      ? match.schools[0]
      : match.schools[1];

  return (
    <DuelFrame>
      <div className="absolute inset-0 z-50 grid place-items-center px-6">
        <div
          className="absolute inset-0 backdrop-blur-md"
          style={{
            background: `radial-gradient(circle, ${color}33, rgba(0,0,0,0.9) 68%)`,
          }}
        />
        <Shockwaves color={color} />
        <ParticleField
          color={color}
          intensity={1}
          count={34}
          direction={win ? "down" : "up"}
          seed={11}
        />
        <ParticleField
          color={loseColor}
          intensity={0.5}
          count={18}
          direction={win ? "up" : "down"}
          seed={19}
        />

        <div
          className="relative z-10 flex flex-col items-center gap-4 text-center"
          style={{
            animation: "tri-burst-in 0.6s cubic-bezier(0.2,0.9,0.25,1) both",
          }}
        >
          {/* Winner icon */}
          {isDraw ? null : !win ? (
            <ShieldIcon
              className="h-20 w-20"
              style={{
                color,
                filter: `drop-shadow(0 0 26px ${color})`,
              }}
            />
          ) : (
            <BoltIcon
              className="h-20 w-20"
              style={{
                color,
                filter: `drop-shadow(0 0 26px ${color})`,
              }}
            />
          )}

          {/* Title */}
          <h2
            className="font-display text-6xl font-black tracking-tighter italic"
            style={{
              color,
              textShadow: `0 0 18px ${color}, 0 0 60px ${color}`,
            }}
          >
            {title}
          </h2>

          {/* Score display with count-up animation */}
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p
                className="font-tech text-[10px] font-bold tracking-[0.2em]"
                style={{ color: MAGENTA }}
              >
                KICKER
              </p>
              <span
                ref={scoreKickerRef}
                className="font-display text-3xl font-black tabular-nums text-white"
                style={{ textShadow: `0 0 12px ${MAGENTA}` }}
              >
                0
              </span>
            </div>
            <span className="font-tech text-lg text-white/40">—</span>
            <div className="text-center">
              <p
                className="font-tech text-[10px] font-bold tracking-[0.2em]"
                style={{ color: CYAN }}
              >
                GOALIE
              </p>
              <span
                ref={scoreGoalieRef}
                className="font-display text-3xl font-black tabular-nums text-white"
                style={{ textShadow: `0 0 12px ${CYAN}` }}
              >
                0
              </span>
            </div>
          </div>

          {/* Winner info */}
          {winnerSchool ? (
            <p className="font-tech text-xs tracking-[0.25em] text-white/60">
              WINNER · {winnerSchool}
            </p>
          ) : (
            <p className="font-tech text-xs tracking-[0.25em] text-white/60">
              KEDUA TIM SEIMBANG!
            </p>
          )}

          <button
            type="button"
            onClick={() => navigate({ to: "/twibbon" })}
            className="mt-2 rounded-full border-2 border-white/70 bg-black/60 px-8 py-3 font-display text-sm font-black tracking-[0.25em] text-white backdrop-blur-md transition-transform active:scale-95"
            style={{ boxShadow: `0 0 24px ${color}` }}
          >
            BUAT TWIBBON
          </button>
        </div>
      </div>
    </DuelFrame>
  );
}
