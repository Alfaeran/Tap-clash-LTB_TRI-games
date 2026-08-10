import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import DuelFrame from "@/components/duel/DuelFrame";
import { matchActions, useMatch } from "@/lib/matchStore";

const MAGENTA = "#FF0066";
const CYAN = "#00E5FF";
const W = 1080;
const H = 1920;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gagal memuat gambar"));
    };
    img.src = url;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const scale = Math.max(W / img.width, H / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

export default function TwibbonScreen() {
  const match = useMatch();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selfie, setSelfie] = useState<HTMLImageElement | null>(null);
  const [frame, setFrame] = useState<HTMLImageElement | null>(null);
  const [busy, setBusy] = useState(false);

  const win = match.winner === "kicker";
  const winnerPlayer = win ? match.players.kicker : match.players.goalie;
  const accent = win ? MAGENTA : CYAN;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, W, H);

    // base
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#12001f");
    bg.addColorStop(1, "#050510");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    if (selfie) drawCover(ctx, selfie);

    // dark scrims top + bottom for legibility
    const top = ctx.createLinearGradient(0, 0, 0, 520);
    top.addColorStop(0, "rgba(5,5,16,0.92)");
    top.addColorStop(1, "rgba(5,5,16,0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, 520);

    const bottom = ctx.createLinearGradient(0, H - 900, 0, H);
    bottom.addColorStop(0, "rgba(5,5,16,0)");
    bottom.addColorStop(0.55, "rgba(5,5,16,0.85)");
    bottom.addColorStop(1, "rgba(5,5,16,0.97)");
    ctx.fillStyle = bottom;
    ctx.fillRect(0, H - 900, W, 900);

    // neon border
    ctx.lineWidth = 14;
    ctx.strokeStyle = MAGENTA;
    ctx.shadowColor = MAGENTA;
    ctx.shadowBlur = 42;
    ctx.strokeRect(28, 28, W - 56, H - 56);
    ctx.strokeStyle = CYAN;
    ctx.shadowColor = CYAN;
    ctx.lineWidth = 5;
    ctx.strokeRect(56, 56, W - 112, H - 112);
    ctx.shadowBlur = 0;

    ctx.textAlign = "center";

    // header
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "600 34px Rajdhani, sans-serif";
    ctx.fillText(match.seriesLabel, W / 2, 170);

    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = MAGENTA;
    ctx.shadowBlur = 34;
    ctx.font = "900 84px Orbitron, sans-serif";
    ctx.fillText("TRI LTB 1v1", W / 2, 265);
    ctx.shadowBlur = 0;
    ctx.fillStyle = CYAN;
    ctx.font = "700 40px Rajdhani, sans-serif";
    ctx.fillText("REFLEX DUEL CLASH", W / 2, 320);

    // result badge
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 48;
    ctx.font = "900 112px Orbitron, sans-serif";
    ctx.fillText(win ? "GOAL!" : "BLOCKED!", W / 2, H - 560);
    ctx.shadowBlur = 0;

    // score
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 130px Orbitron, sans-serif";
    ctx.shadowColor = "rgba(255,255,255,0.55)";
    ctx.shadowBlur = 26;
    ctx.fillText(`${match.taps.kicker} : ${match.taps.goalie}`, W / 2, H - 410);
    ctx.shadowBlur = 0;

    // teams
    ctx.font = "700 40px Rajdhani, sans-serif";
    ctx.fillStyle = MAGENTA;
    ctx.textAlign = "left";
    ctx.fillText(match.players.kicker?.school ?? "KICKER", 110, H - 320);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "600 34px Rajdhani, sans-serif";
    ctx.fillText(match.players.kicker?.name?.toUpperCase() ?? "-", 110, H - 275);

    ctx.textAlign = "right";
    ctx.font = "700 40px Rajdhani, sans-serif";
    ctx.fillStyle = CYAN;
    ctx.fillText(match.players.goalie?.school ?? "GOALIE", W - 110, H - 320);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "600 34px Rajdhani, sans-serif";
    ctx.fillText(match.players.goalie?.name?.toUpperCase() ?? "-", W - 110, H - 275);

    // winner strip
    ctx.textAlign = "center";
    ctx.fillStyle = accent;
    ctx.font = "900 46px Orbitron, sans-serif";
    ctx.shadowColor = accent;
    ctx.shadowBlur = 30;
    ctx.fillText(
      `WINNER · ${(winnerPlayer?.name ?? "-").toUpperCase()}`,
      W / 2,
      H - 180,
    );
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "600 32px Rajdhani, sans-serif";
    ctx.fillText("#TriLTB2026  #ReflexDuelClash", W / 2, H - 120);

    // optional official frame on top
    if (frame) drawCover(ctx, frame);
  }, [accent, frame, match, selfie, win, winnerPlayer]);

  useEffect(() => {
    draw();
  }, [draw]);

  const pick = async (file: File | undefined, kind: "selfie" | "frame") => {
    if (!file) return;
    const img = await loadImage(file);
    if (kind === "selfie") setSelfie(img);
    else setFrame(img);
  };

  const toBlob = () =>
    new Promise<Blob | null>((resolve) =>
      canvasRef.current?.toBlob((b) => resolve(b), "image/png", 0.95),
    );

  const download = async () => {
    setBusy(true);
    const blob = await toBlob();
    setBusy(false);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tri-ltb-twibbon-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const share = async () => {
    setBusy(true);
    const blob = await toBlob();
    setBusy(false);
    if (!blob) return;
    const file = new File([blob], "tri-ltb-twibbon.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Tri LTB 1v1 Reflex Duel Clash" });
        return;
      } catch {
        /* user cancelled */
      }
    }
    await download();
    window.open("https://www.instagram.com/", "_blank", "noopener");
  };

  return (
    <DuelFrame>
      <div className="relative z-10 flex h-full flex-col gap-3 overflow-y-auto px-5 py-5">
        <header className="text-center">
          <p className="font-tech text-[10px] tracking-[0.4em] text-white/45">TWIBBON GENERATOR</p>
          <h1 className="font-display text-xl font-black tracking-tight text-white italic">
            BAGIKAN HASIL DUEL
          </h1>
        </header>

        <div
          className="relative mx-auto w-full max-w-[240px] overflow-hidden rounded-2xl border-2"
          style={{ borderColor: accent, boxShadow: `0 0 26px ${accent}66` }}
        >
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="block h-auto w-full"
            aria-label="Pratinjau twibbon"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="tri-glass cursor-pointer rounded-xl border-2 border-white/20 px-3 py-3 text-center font-tech text-[11px] font-bold tracking-[0.2em] text-white">
            UPLOAD SELFIE
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void pick(e.target.files?.[0], "selfie")}
            />
          </label>
          <label className="tri-glass cursor-pointer rounded-xl border-2 border-white/20 px-3 py-3 text-center font-tech text-[11px] font-bold tracking-[0.2em] text-white">
            UPLOAD FRAME
            <input
              type="file"
              accept="image/png"
              className="hidden"
              onChange={(e) => void pick(e.target.files?.[0], "frame")}
            />
          </label>
        </div>
        <p className="text-center font-tech text-[10px] tracking-[0.2em] text-white/35">
          FRAME RESMI (PNG TRANSPARAN 1080×1920) OPSIONAL
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void download()}
            disabled={busy}
            className="rounded-xl border-2 border-white/60 bg-black/60 py-3 font-display text-xs font-black tracking-[0.2em] text-white transition-transform active:scale-95 disabled:opacity-50"
            style={{ boxShadow: `0 0 18px ${MAGENTA}` }}
          >
            DOWNLOAD
          </button>
          <button
            type="button"
            onClick={() => void share()}
            disabled={busy}
            className="rounded-xl border-2 border-white/60 bg-black/60 py-3 font-display text-xs font-black tracking-[0.2em] text-white transition-transform active:scale-95 disabled:opacity-50"
            style={{ boxShadow: `0 0 18px ${CYAN}` }}
          >
            SHARE IG
          </button>
        </div>

        <Link
          to="/"
          onClick={() => matchActions.resetMatch()}
          className="mt-auto rounded-xl border border-white/25 py-3 text-center font-tech text-[11px] font-bold tracking-[0.3em] text-white/70"
        >
          KEMBALI KE LOBBY
        </Link>
      </div>
    </DuelFrame>
  );
}
