import { Link } from "@tanstack/react-router";
import { useMatch } from "@/lib/matchStore";
import { formatScoreK } from "@/lib/utils";
import DuelFrame from "@/components/duel/DuelFrame";
import { useEffect, useRef } from "react";
import anime from "animejs";

const MAGENTA = "#FF0066";
const CYAN = "#00E5FF";
const GOLD = "#EAB308";

export default function LeaderboardScreen() {
  const match = useMatch();
  const leaderboard = match.leaderboard || [];
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Container pop-up animation
    if (containerRef.current) {
      anime({
        targets: containerRef.current,
        scale: [0.8, 1],
        opacity: [0, 1],
        duration: 600,
        easing: "easeOutBack", // Gives that bouncy "pop" effect
      });
    }

    // 2. List item stagger animation
    if (listRef.current && leaderboard.length > 0) {
      anime({
        targets: listRef.current.children,
        translateX: [-40, 0],
        opacity: [0, 1],
        delay: anime.stagger(100, { start: 200 }), // Wait a bit for container to pop first
        duration: 600,
        easing: "easeOutExpo",
      });
    }
  }, [leaderboard]);

  return (
    <DuelFrame>
      <div ref={containerRef} className="relative z-10 flex h-full flex-col gap-4 overflow-y-auto px-5 py-6 opacity-0">
        <header className="text-center">
          <p className="font-tech text-[10px] tracking-[0.4em] text-white/45">
            {match.seriesLabel}
          </p>
          <h1 className="font-display text-2xl font-black tracking-tight text-white italic">
            KLASEMEN SEMENTARA
          </h1>
        </header>

        <div className="flex flex-col gap-3 mt-4">
          <div className="grid grid-cols-12 gap-2 px-3 py-1 font-tech text-[9px] font-bold tracking-widest text-white/50 text-center">
            <div className="col-span-1">#</div>
            <div className="col-span-5 text-left">SEKOLAH</div>
            <div className="col-span-2">PTS</div>
            <div className="col-span-2">W-D-L</div>
            <div className="col-span-2">TAPS</div>
          </div>

          <div ref={listRef} className="flex flex-col gap-2">
            {leaderboard.length === 0 && (
              <div className="py-8 text-center font-tech text-xs text-white/40">
                BELUM ADA DATA
              </div>
            )}
            
            {leaderboard.map((row, i) => {
              const isFirst = i === 0;
              const color = isFirst ? GOLD : i === 1 ? CYAN : i === 2 ? MAGENTA : "rgba(255,255,255,0.4)";
              
              return (
                <div
                  key={row.school}
                  className={`grid grid-cols-12 items-center gap-2 rounded-xl border px-3 py-3 font-display tabular-nums shadow-lg backdrop-blur-sm opacity-0 ${
                    isFirst ? "bg-black/80" : "bg-black/40"
                  }`}
                  style={{
                    borderColor: isFirst ? GOLD : "rgba(255,255,255,0.1)",
                    boxShadow: isFirst ? `0 0 20px ${GOLD}33` : "none"
                  }}
                >
                  <div 
                    className="col-span-1 text-center text-lg font-black italic"
                    style={{ color }}
                  >
                    {i + 1}
                  </div>
                  
                  <div className="col-span-5 text-left flex flex-col justify-center overflow-hidden">
                    <span 
                      className={`truncate text-sm font-black italic ${isFirst ? "text-white" : "text-white/80"}`}
                      style={{ textShadow: isFirst ? `0 0 10px ${GOLD}88` : "none" }}
                    >
                      {row.school}
                    </span>
                  </div>
                  
                  <div className="col-span-2 text-center text-base font-black text-white">
                    {row.points}
                  </div>
                  
                  <div className="col-span-2 text-center font-tech text-[10px] font-bold text-white/60">
                    {row.wins}-{row.draws}-{row.losses}
                  </div>
                  
                  <div className="col-span-2 text-center font-tech text-[11px] font-bold text-white/80">
                    {formatScoreK(row.taps)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Link
          to="/twibbon"
          className="mt-auto rounded-xl border-2 border-white/60 bg-black/60 py-4 text-center font-display text-sm font-black tracking-[0.25em] text-white transition-transform active:scale-95"
          style={{ boxShadow: `0 0 20px ${MAGENTA}` }}
        >
          LANJUT KE TWIBBON
        </Link>
      </div>
    </DuelFrame>
  );
}
