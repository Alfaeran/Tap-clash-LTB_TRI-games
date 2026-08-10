<!--
  Tri LTB — 1v1 Reflex Duel Clash
  Vue 3 (<script setup>) + Tailwind reference port of the React implementation.

  Requires the keyframes/utilities from `src/styles.css` (tri-breathe, tri-vibrate,
  tri-spark, tri-arc, tri-shockwave, tri-flare, tri-flicker, tri-danger-pulse,
  tri-burst-in, tri-scanline, .tri-glass, --color-tri-*).
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

const MAGENTA = "#FF0066";
const CYAN = "#00E5FF";
const DANGER = "#FF2D2D";
const MATCH_DURATION_MS = 60_000;
const FRENZY_RATE = 9;
const DECAY_PER_SECOND = 2.6;

const STADIUM_BG =
  "https://lh3.googleusercontent.com/aida/AP1WRLsIpY1Ygipq_o-1gYbWR1djiJ37zcdqDp4doInIYMnnldxEILYVbDuMPBsqSfFIfHeX_QFJZaXA-97bHYakwwP6RpkXVGgcZp_RTdV-bRgyhLDMDBZoEVD_r9Soi6QX2vJDHnR9lW7EXE98ccxON5gilr6hA9Hua8pinN9cKOkR2_IpDwejQDTwmRjMZnF7E9zAt1fefHZzMKfjOlxC6wFXkwRQniQeep7a4h5gTEhHKHBZKcCH7uFD-UA";

type Phase = "idle" | "live" | "goal" | "blocked";
type Side = "kicker" | "goalie";

const phase = ref<Phase>("idle");
const remainingMs = ref(MATCH_DURATION_MS);
const kickerTaps = ref(0);
const goalieTaps = ref(0);
const kickerIntensity = ref(0);
const goalieIntensity = ref(0);

const rates = { kicker: 0, goalie: 0 };
let endsAt: number | null = null;
let frame = 0;

function tap(side: Side) {
  if (phase.value === "goal" || phase.value === "blocked") return;
  if (phase.value === "idle") {
    endsAt = performance.now() + MATCH_DURATION_MS;
    phase.value = "live";
  }
  rates[side] = Math.min(FRENZY_RATE * 1.4, rates[side] + 1.9);
  if (side === "kicker") kickerTaps.value++;
  else goalieTaps.value++;
}

function reset() {
  rates.kicker = 0;
  rates.goalie = 0;
  endsAt = null;
  phase.value = "idle";
  remainingMs.value = MATCH_DURATION_MS;
  kickerTaps.value = 0;
  goalieTaps.value = 0;
  kickerIntensity.value = 0;
  goalieIntensity.value = 0;
}

onMounted(() => {
  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const decay = Math.exp(-DECAY_PER_SECOND * dt);
    rates.kicker *= decay;
    rates.goalie *= decay;
    kickerIntensity.value = Math.min(1, rates.kicker / FRENZY_RATE);
    goalieIntensity.value = Math.min(1, rates.goalie / FRENZY_RATE);

    if (endsAt !== null) {
      const left = Math.max(0, endsAt - now);
      remainingMs.value = left;
      if (left === 0) {
        endsAt = null;
        phase.value = kickerTaps.value > goalieTaps.value ? "goal" : "blocked";
      }
    }
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);
});
onUnmounted(() => cancelAnimationFrame(frame));

const finished = computed(() => phase.value === "goal" || phase.value === "blocked");
const urgent = computed(() => phase.value === "live" && remainingMs.value <= 10_000);
const total = computed(() => kickerTaps.value + goalieTaps.value);
const kickerShare = computed(() =>
  Math.min(0.92, Math.max(0.08, total.value === 0 ? 0.5 : kickerTaps.value / total.value)),
);
const magentaPct = computed(() => kickerShare.value * 100);
const dominant = computed(() => kickerShare.value >= 0.8);
const crushed = computed(() => kickerShare.value <= 0.2);

const clock = computed(() => {
  const s = Math.ceil(remainingMs.value / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
});

function alpha(color: string, a: number) {
  return color + Math.round(a * 255).toString(16).padStart(2, "0");
}

function cardStyle(side: Side) {
  const color = side === "kicker" ? MAGENTA : CYAN;
  const intensity = side === "kicker" ? kickerIntensity.value : goalieIntensity.value;
  const other = side === "kicker" ? goalieIntensity.value : kickerIntensity.value;
  const dimmed = !finished.value && other > 0.45 && intensity < other * 0.5;
  const flex =
    phase.value === "goal"
      ? side === "kicker"
        ? 2.6
        : 0.45
      : phase.value === "blocked"
        ? side === "goalie"
          ? 2.6
          : 0.45
        : 1;
  const glow = 0.18 + intensity * 0.8;
  return {
    flex,
    borderColor: alpha(color, dimmed ? 0.2 : 0.35 + intensity * 0.6),
    background: `linear-gradient(${side === "kicker" ? "160deg" : "-20deg"}, ${alpha(color, 0.16 + intensity * 0.22)}, rgba(26,26,26,0.75))`,
    boxShadow: dimmed
      ? `0 0 10px ${alpha(color, 0.12)}`
      : `0 0 ${14 + intensity * 46}px ${alpha(color, glow)}, inset 0 0 ${20 + intensity * 60}px ${alpha(color, glow * 0.5)}`,
    opacity: dimmed ? 0.4 : 1,
    animation: intensity > 0.55 ? "tri-vibrate 0.12s linear infinite" : undefined,
    transition: "flex 0.6s cubic-bezier(0.2,0.8,0.2,1), opacity 0.35s linear",
  } as Record<string, unknown>;
}

function particles(color: string, intensity: number, dir: "up" | "down", seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  const count = Math.round(18 * intensity);
  return Array.from({ length: count }, (_, i) => {
    const r = rand(i + seed * 97);
    const r2 = rand(i * 3.7 + seed * 13);
    return {
      key: i,
      style: {
        left: `${6 + r * 88}%`,
        [dir === "up" ? "bottom" : "top"]: `${r2 * 40}%`,
        width: `${2 + r2 * 3}px`,
        height: `${2 + r2 * 3}px`,
        background: color,
        boxShadow: `0 0 8px ${color}, 0 0 16px ${color}`,
        opacity: 0,
        "--dx": `${(r - 0.5) * 60}px`,
        "--dy": `${(dir === "up" ? -1 : 1) * (40 + r2 * 90)}px`,
        animation: `tri-spark ${0.6 + r * 0.7}s linear ${r2 * 0.9}s infinite`,
      } as Record<string, string | number>,
    };
  });
}
</script>

<template>
  <div class="grid min-h-[100dvh] w-full place-items-center bg-black">
    <div
      class="relative aspect-[9/16] h-[100dvh] w-full max-w-[min(100vw,calc(100dvh*9/16))] overflow-hidden bg-black select-none"
    >
      <img
        :src="STADIUM_BG"
        alt=""
        class="absolute inset-0 h-full w-full scale-110 object-cover opacity-55 blur-[14px]"
      />
      <div class="absolute inset-0 bg-black/45" />

      <!-- final-10s danger vignette -->
      <div
        v-if="urgent"
        class="pointer-events-none absolute inset-0 z-40"
        :style="{
          boxShadow: `inset 0 0 90px 24px ${DANGER}`,
          animation: 'tri-danger-pulse 0.7s ease-in-out infinite',
        }"
      />

      <!-- vertical tug-of-war bar -->
      <div class="absolute top-24 bottom-24 left-2 z-30 w-3">
        <div class="relative h-full w-full overflow-hidden rounded-full border border-white/20 bg-black/70">
          <div
            class="absolute inset-x-0 top-0"
            :style="{
              height: magentaPct + '%',
              background: `linear-gradient(180deg, ${MAGENTA}, ${MAGENTA}cc)`,
              boxShadow: crushed ? `0 0 6px ${MAGENTA}` : `0 0 ${dominant ? 26 : 12}px ${MAGENTA}, inset 0 0 10px ${MAGENTA}`,
              transition: 'height 0.25s ease-out',
              animation: crushed ? 'tri-flicker 1.6s linear infinite' : undefined,
            }"
          />
          <div
            class="absolute inset-x-0 bottom-0"
            :style="{
              height: 100 - magentaPct + '%',
              background: `linear-gradient(0deg, ${CYAN}, ${CYAN}cc)`,
              boxShadow: dominant ? `0 0 6px ${CYAN}` : `0 0 ${crushed ? 26 : 12}px ${CYAN}, inset 0 0 10px ${CYAN}`,
              transition: 'height 0.25s ease-out',
              animation: dominant ? 'tri-flicker 1.6s linear infinite' : undefined,
            }"
          />
        </div>
        <span
          class="pointer-events-none absolute -left-2 h-5 w-7 -translate-y-1/2 rounded-full bg-white"
          :style="{
            top: magentaPct + '%',
            boxShadow: `0 0 18px #fff, 0 0 34px ${kickerShare >= 0.5 ? MAGENTA : CYAN}`,
            animation: 'tri-flare 0.9s ease-in-out infinite',
            transition: 'top 0.25s ease-out',
          }"
        />
      </div>

      <div class="relative z-20 flex h-full flex-col gap-2 py-4 pr-3 pl-9">
        <header class="tri-glass shrink-0 rounded-2xl border border-white/15 px-3 py-2">
          <div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
            <div class="min-w-0">
              <p class="truncate font-tech text-[11px] font-bold tracking-widest text-white/90">SMK YASMU MANYAR</p>
              <p class="tri-text-magenta font-tech text-[9px] font-bold tracking-[0.2em]">KICKER</p>
            </div>
            <p class="font-display text-[9px] tracking-[0.25em] text-white/50">VS</p>
            <div class="min-w-0 text-right">
              <p class="truncate font-tech text-[11px] font-bold tracking-widest text-white/90">SMA DARUTTAWABIN</p>
              <p class="tri-text-cyan font-tech text-[9px] font-bold tracking-[0.2em]">GOALKEEPER</p>
            </div>
          </div>
          <p class="mt-1 text-center font-tech text-[9px] tracking-[0.3em] text-white/40">SERI SURABAYA · MATCH DAY 1</p>
        </header>

        <!-- Kicker card -->
        <button
          type="button"
          class="relative min-h-0 w-full overflow-hidden rounded-3xl border-2 backdrop-blur-md"
          :style="cardStyle('kicker')"
          :disabled="finished"
          @pointerdown="tap('kicker')"
        >
          <span
            v-if="kickerIntensity <= 0.08"
            class="pointer-events-none absolute inset-6 rounded-full"
            :style="{
              background: `radial-gradient(circle, ${alpha(MAGENTA, 0.45)}, transparent 68%)`,
              filter: 'blur(26px)',
              animation: 'tri-breathe 4.2s ease-in-out infinite',
            }"
          />
          <span
            v-for="p in particles(MAGENTA, kickerIntensity, 'up', 1)"
            :key="p.key"
            class="absolute rounded-full"
            :style="p.style"
          />
          <div class="relative z-10 flex h-full flex-col items-center justify-center gap-1 px-4">
            <span
              class="font-display text-lg font-black tracking-[0.3em]"
              :style="{ color: MAGENTA, textShadow: `0 0 ${8 + kickerIntensity * 22}px ${MAGENTA}` }"
              >KICKER</span
            >
            <span
              class="font-display text-4xl font-black tabular-nums text-white"
              :style="{ textShadow: `0 0 ${10 + kickerIntensity * 30}px ${MAGENTA}` }"
              >{{ kickerTaps.toLocaleString() }}</span
            >
          </div>
        </button>

        <!-- Center VS + timer -->
        <div class="relative z-30 flex shrink-0 items-center justify-center gap-3">
          <span class="font-display text-2xl font-black text-white/90 italic drop-shadow-[0_0_14px_rgba(255,255,255,0.8)]">VS</span>
          <span
            class="font-display font-black tabular-nums transition-all duration-300"
            :style="
              urgent
                ? {
                    fontSize: '2.6rem',
                    color: DANGER,
                    textShadow: `0 0 10px ${DANGER}, 0 0 34px ${DANGER}`,
                    animation: 'tri-vibrate 0.14s linear infinite',
                  }
                : { fontSize: '1.6rem', color: '#fff', textShadow: '0 0 12px rgba(255,255,255,0.6)' }
            "
            >{{ clock }}</span
          >
        </div>

        <!-- Goalie card -->
        <button
          type="button"
          class="relative min-h-0 w-full overflow-hidden rounded-3xl border-2 backdrop-blur-md"
          :style="cardStyle('goalie')"
          :disabled="finished"
          @pointerdown="tap('goalie')"
        >
          <span
            v-if="goalieIntensity <= 0.08"
            class="pointer-events-none absolute inset-6 rounded-full"
            :style="{
              background: `radial-gradient(circle, ${alpha(CYAN, 0.45)}, transparent 68%)`,
              filter: 'blur(26px)',
              animation: 'tri-breathe 4.2s ease-in-out infinite',
            }"
          />
          <span
            v-for="p in particles(CYAN, goalieIntensity, 'down', 5)"
            :key="p.key"
            class="absolute rounded-full"
            :style="p.style"
          />
          <div class="relative z-10 flex h-full flex-col items-center justify-center gap-1 px-4">
            <span
              class="font-display text-lg font-black tracking-[0.3em]"
              :style="{ color: CYAN, textShadow: `0 0 ${8 + goalieIntensity * 22}px ${CYAN}` }"
              >GOALIE</span
            >
            <span
              class="font-display text-4xl font-black tabular-nums text-white"
              :style="{ textShadow: `0 0 ${10 + goalieIntensity * 30}px ${CYAN}` }"
              >{{ goalieTaps.toLocaleString() }}</span
            >
          </div>
        </button>
      </div>

      <!-- Result overlay -->
      <div v-if="finished" class="absolute inset-0 z-50 grid place-items-center px-6">
        <div
          class="absolute inset-0"
          :style="{
            background: `radial-gradient(circle, ${phase === 'goal' ? MAGENTA : CYAN}33, rgba(0,0,0,0.82) 70%)`,
          }"
        />
        <span
          v-for="i in 3"
          :key="i"
          class="absolute aspect-square w-[60%] rounded-full"
          :style="{
            border: `2px solid ${phase === 'goal' ? MAGENTA : CYAN}`,
            boxShadow: `0 0 30px ${phase === 'goal' ? MAGENTA : CYAN}`,
            animation: `tri-shockwave 1.4s cubic-bezier(0.2,0.7,0.3,1) ${(i - 1) * 0.28}s infinite`,
          }"
        />
        <div
          class="relative z-10 flex flex-col items-center gap-3 text-center"
          style="animation: tri-burst-in 0.6s cubic-bezier(0.2, 0.9, 0.25, 1) both"
        >
          <svg
            v-if="phase === 'blocked'"
            class="h-28 w-28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            :style="{ color: CYAN, filter: `drop-shadow(0 0 26px ${CYAN})` }"
          >
            <path d="M12 2.6 4 6v6c0 5 3.4 8.6 8 9.4 4.6-.8 8-4.4 8-9.4V6l-8-3.4Z" />
            <path d="m8.7 12.1 2.3 2.3 4.4-4.5" />
          </svg>
          <h2
            class="font-display text-6xl font-black tracking-tighter italic"
            :style="{
              color: phase === 'goal' ? MAGENTA : CYAN,
              textShadow: `0 0 18px ${phase === 'goal' ? MAGENTA : CYAN}, 0 0 60px ${phase === 'goal' ? MAGENTA : CYAN}`,
            }"
          >
            {{ phase === "goal" ? "GOAL!" : "BLOCKED!" }}
          </h2>
          <p class="font-tech text-sm tracking-[0.3em] text-white/70">
            {{ kickerTaps.toLocaleString() }} — {{ goalieTaps.toLocaleString() }}
          </p>
          <button
            type="button"
            class="mt-2 rounded-full border-2 border-white/70 bg-black/60 px-8 py-3 font-display text-sm font-black tracking-[0.25em] text-white backdrop-blur-md active:scale-95"
            @click="reset"
          >
            REMATCH
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
