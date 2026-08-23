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
  const currentMatch = useMatch();
  // Freeze the match state when this component mounts so stats don't change if the server resets or reconnects
  const [match] = useState(currentMatch);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selfie, setSelfie] = useState<HTMLImageElement | null>(null);
  const [frame, setFrame] = useState<HTMLImageElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewerName, setViewerName] = useState("");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [flash, setFlash] = useState(false);

  const isDraw = match.winner === "draw";
  const win = match.winner === "kicker";
  const winnerSchool = isDraw ? null : win ? match.schools[0] : match.schools[1];
  const accent = isDraw ? "#EAB308" : win ? MAGENTA : CYAN;

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
    ctx.font = "600 34px Ooredoo, sans-serif";
    ctx.fillText(match.seriesLabel, W / 2, 170);

    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = MAGENTA;
    ctx.shadowBlur = 34;
    ctx.font = "900 84px Ooredoo, sans-serif";
    ctx.fillText("TRI LTB 1v1", W / 2, 265);
    ctx.shadowBlur = 0;
    ctx.fillStyle = CYAN;
    ctx.font = "700 40px Ooredoo, sans-serif";
    ctx.fillText("REFLEX DUEL CLASH", W / 2, 320);

    // result badge
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 48;
    ctx.font = "900 112px Ooredoo, Orbitron, sans-serif";
    ctx.fillText(isDraw ? "DRAW!" : win ? "GOAL!" : "BLOCKED!", W / 2, H - 560);
    ctx.shadowBlur = 0;

    // score
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 130px Ooredoo, sans-serif";
    ctx.shadowColor = "rgba(255,255,255,0.55)";
    ctx.shadowBlur = 26;
    ctx.fillText(`${match.taps.kicker} : ${match.taps.goalie}`, W / 2, H - 410);
    ctx.shadowBlur = 0;

    // Viewer Name display instead of player names
    ctx.textAlign = "center";
    ctx.font = "700 65px Ooredoo, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 10;
    ctx.fillText(viewerName ? viewerName.toUpperCase() : "PENONTON LTB", W / 2, H - 280);
    ctx.shadowBlur = 0;

    // winner strip
    ctx.textAlign = "center";
    ctx.fillStyle = accent;
    ctx.font = "900 46px Ooredoo, sans-serif";
    ctx.shadowColor = accent;
    ctx.shadowBlur = 30;
    if (winnerSchool) {
      ctx.fillText(
        `WINNER · ${winnerSchool.toUpperCase()}`,
        W / 2,
        H - 180,
      );
    } else {
      ctx.fillText("KEDUA TIM SEIMBANG!", W / 2, H - 180);
    }
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "600 32px Ooredoo, sans-serif";
    ctx.fillText("#TriLTB2026  #ReflexDuelClash", W / 2, H - 120);

    // optional official frame on top
    if (frame) drawCover(ctx, frame);
  }, [accent, frame, match, selfie, win, isDraw, winnerSchool, viewerName]);

  const [fontsReady, setFontsReady] = useState(false);

  // Wait for custom fonts to load before drawing canvas
  useEffect(() => {
    if (typeof document === "undefined") return;
    Promise.all([
      document.fonts.load("900 84px Ooredoo"),
    ]).then(() => setFontsReady(true))
     .catch(() => setFontsReady(true)); // Draw anyway on error
  }, []);

  useEffect(() => {
    if (fontsReady) draw();
  }, [draw, fontsReady]);

  const pick = async (file: File | undefined, kind: "selfie" | "frame") => {
    if (!file) return;
    const img = await loadImage(file);
    if (kind === "selfie") setSelfie(img);
    else setFrame(img);
  };

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      setCameraStream(stream);
      // Attach stream to video tag after it renders
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 50);
    } catch (err) {
      alert("Gagal mengakses kamera. Pastikan browser Anda memiliki izin kamera.");
    }
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
    setCameraStream(null);
  };

  const takePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setFlash(true);
    setTimeout(() => setFlash(false), 300);

    // Flip context horizontally if it's a front camera so the photo isn't mirrored incorrectly
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/png");
    const img = new Image();
    img.onload = () => {
      setSelfie(img);
      closeCamera();
    };
    img.src = dataUrl;
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

        <div className="flex flex-col gap-1">
          <label className="font-tech text-[10px] tracking-[0.2em] text-white/50">NAMA DI TWIBBON:</label>
          <input
            value={viewerName}
            onChange={(e) => setViewerName(e.target.value)}
            maxLength={30}
            placeholder="Ketik namamu di sini..."
            className="rounded-xl border-2 bg-black/50 px-3 py-2.5 font-tech text-base font-semibold tracking-wide text-white outline-none placeholder:text-white/40 focus:border-white/50"
            style={{ borderColor: "rgba(255,255,255,0.2)" }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={openCamera}
            className="tri-glass cursor-pointer rounded-xl border-2 border-white/20 px-3 py-3 text-center font-tech text-[11px] font-bold tracking-[0.2em] text-white transition-transform active:scale-95"
          >
            BUKA KAMERA
          </button>
          <label className="tri-glass cursor-pointer rounded-xl border-2 border-white/20 px-3 py-3 text-center font-tech text-[11px] font-bold tracking-[0.2em] text-white transition-transform active:scale-95">
            UPLOAD FOTO
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void pick(e.target.files?.[0], "selfie")}
            />
          </label>
        </div>
        <div className="mt-1 grid grid-cols-1">
          <label className="tri-glass cursor-pointer rounded-xl border-2 border-white/10 bg-black/40 px-3 py-2 text-center font-tech text-[10px] font-bold tracking-[0.2em] text-white/70 transition-colors hover:text-white">
            + UPLOAD FRAME (OPSIONAL)
            <input
              type="file"
              accept="image/png"
              className="hidden"
              onChange={(e) => void pick(e.target.files?.[0], "frame")}
            />
          </label>
        </div>


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
          onClick={() => matchActions.resetAll()}
          className="mt-auto rounded-xl border border-white/25 py-3 text-center font-tech text-[11px] font-bold tracking-[0.3em] text-white/70"
        >
          KEMBALI KE LOBBY
        </Link>
      </div>

      {cameraStream && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="h-full w-full object-cover"
            style={{ transform: "scaleX(-1)" }} // Mirror the preview
          />
          <div className={`pointer-events-none absolute inset-0 z-[101] bg-white transition-opacity duration-300 ${flash ? "opacity-100" : "opacity-0"}`} />
          <div className="absolute inset-x-0 bottom-12 flex flex-col items-center gap-6 z-[102]">
            <button
              onClick={takePhoto}
              className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/30 backdrop-blur-md transition-transform active:scale-90"
              aria-label="Ambil Foto"
            >
              <div className="h-16 w-16 rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.8)]" />
            </button>
            <button
              onClick={closeCamera}
              className="rounded-full bg-black/60 px-6 py-2 font-tech text-xs font-bold tracking-[0.2em] text-white backdrop-blur-md transition-colors hover:bg-white/20"
            >
              BATAL
            </button>
          </div>
        </div>
      )}
    </DuelFrame>
  );
}
