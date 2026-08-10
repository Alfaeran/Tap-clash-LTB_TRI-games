/** Pure CSS/SVG neon effect primitives for the duel screen. */

export function ParticleField({
  color,
  intensity,
  direction = "up",
  count = 18,
  seed = 1,
}: {
  color: string;
  intensity: number;
  direction?: "up" | "down";
  count?: number;
  seed?: number;
}) {
  if (intensity <= 0.05) return null;
  const active = Math.round(count * intensity);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: active }).map((_, i) => {
        const r = pseudoRandom(i + seed * 97);
        const r2 = pseudoRandom(i * 3.7 + seed * 13);
        const dy = (direction === "up" ? -1 : 1) * (40 + r2 * 90);
        return (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${6 + r * 88}%`,
              [direction === "up" ? "bottom" : "top"]: `${r2 * 40}%`,
              width: `${2 + r2 * 3}px`,
              height: `${2 + r2 * 3}px`,
              background: color,
              boxShadow: `0 0 8px ${color}, 0 0 16px ${color}`,
              opacity: 0,
              ["--dx" as string]: `${(r - 0.5) * 60}px`,
              ["--dy" as string]: `${dy}px`,
              animation: `tri-spark ${0.6 + r * 0.7}s linear ${r2 * 0.9}s infinite`,
            }}
          />
        );
      })}
    </div>
  );
}

export function ElectricArcs({
  color,
  intensity,
  seed = 3,
}: {
  color: string;
  intensity: number;
  seed?: number;
}) {
  if (intensity <= 0.35) return null;
  const bolts = Math.round(4 * intensity);

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {Array.from({ length: bolts }).map((_, i) => {
        const r = pseudoRandom(i + seed * 31);
        const x = 12 + r * 76;
        return (
          <path
            key={i}
            d={`M ${x} 4 L ${x + 6 - r * 12} 34 L ${x - 3} 46 L ${x + 9 - r * 10} 96`}
            stroke={color}
            strokeWidth={0.7}
            fill="none"
            style={{
              filter: `drop-shadow(0 0 4px ${color})`,
              opacity: 0,
              animation: `tri-arc ${0.9 + r * 0.6}s linear ${r * 0.5}s infinite`,
            }}
          />
        );
      })}
    </svg>
  );
}

export function Shockwaves({ color, rings = 3 }: { color: string; rings?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      {Array.from({ length: rings }).map((_, i) => (
        <span
          key={i}
          className="absolute aspect-square w-[60%] rounded-full"
          style={{
            border: `2px solid ${color}`,
            boxShadow: `0 0 30px ${color}, inset 0 0 30px ${color}`,
            animation: `tri-shockwave 1.4s cubic-bezier(0.2, 0.7, 0.3, 1) ${i * 0.28}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

export function BoltIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13 2 3 14h8l-1 8 10-12h-8l1-8Z" />
    </svg>
  );
}

export function ShieldIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2.6 4 6v6c0 5 3.4 8.6 8 9.4 4.6-.8 8-4.4 8-9.4V6l-8-3.4Z" />
      <path d="m8.7 12.1 2.3 2.3 4.4-4.5" />
    </svg>
  );
}

function pseudoRandom(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
