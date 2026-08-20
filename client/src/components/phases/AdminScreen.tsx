import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { matchActions, useMatch } from "@/lib/matchStore";
import { SCHOOL_LIST } from "@/lib/schoolsData";

const MAGENTA = "#FF0066";
const CYAN = "#00E5FF";

/** Maps school IDs to known logo filenames in /school-logo/ */
const SCHOOL_LOGO_MAP: Record<string, string> = {
  "SMA-1": "/school-logo/MAN 2 Yogyakarta.png",
  "SMA-2": "/school-logo/SMAN 1 Sayegan.jpg",
  "SMA-3": "/school-logo/SMAN 4 Yogyakarta.png",
  "SMA-4": "/school-logo/SMK Negeri 2 Klaten.png",
};

function SchoolInitials({ name, color }: { name: string; color: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div
      className="flex h-12 w-12 items-center justify-center rounded-full font-display text-sm font-black"
      style={{
        background: `${color}22`,
        border: `2px solid ${color}55`,
        color,
        textShadow: `0 0 8px ${color}`,
      }}
    >
      {initials}
    </div>
  );
}

export default function AdminScreen() {
  const match = useMatch();
  const [series, setSeries] = useState(match.seriesLabel);
  const [category, setCategory] = useState<"SMA" | "SMP">("SMA");
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);
  const [lobbyCreated, setLobbyCreated] = useState(false);

  const handleSchoolClick = (schoolId: string) => {
    if (lobbyCreated) return;

    if (selectedSchools.includes(schoolId)) {
      setSelectedSchools(selectedSchools.filter((x) => x !== schoolId));
    } else {
      if (selectedSchools.length < 2) {
        setSelectedSchools([...selectedSchools, schoolId]);
      }
    }
  };

  const createLobby = () => {
    if (selectedSchools.length !== 2) return;
    const school1 = SCHOOL_LIST.find((s) => s.id === selectedSchools[0]);
    const school2 = SCHOOL_LIST.find((s) => s.id === selectedSchools[1]);
    // Send full name + detail to avoid ambiguity (e.g. "SMKN 2 KLATEN" vs "SMKN 2 YOGYAKARTA")
    const name1 = school1 ? `${school1.name} ${school1.detail}` : "A";
    const name2 = school2 ? `${school2.name} ${school2.detail}` : "B";
    matchActions.setupMatch(name1, name2, series);
    setLobbyCreated(true);
  };

  // URL for players to join
  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}`
      : "";
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}&bgcolor=0a0a0a&color=00e5ff&margin=10`;

  const twoSelected = selectedSchools.length === 2;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050510] p-4 font-sans selection:bg-tri-magenta/30">
      <div className="w-full max-w-sm space-y-4">
        {/* Header */}
        <header className="flex flex-col items-center gap-1 pb-4">
          <div
            className="mb-2 h-1 w-24 rounded-full"
            style={{
              background: `linear-gradient(90deg, ${MAGENTA}, ${CYAN})`,
              boxShadow: `0 0 12px ${MAGENTA}, 0 0 12px ${CYAN}`,
            }}
          />
          <h1 className="font-display text-xl font-black uppercase tracking-[0.25em] text-white">
            <span className="tri-text-magenta">TRI</span>{" "}
            <span className="text-white/40">LTB</span> 2026
          </h1>
          <p className="font-tech text-[10px] tracking-[0.4em] text-white/50">
            ADMIN DASHBOARD
          </p>
        </header>

        {!lobbyCreated ? (
          <section className="tri-glass rounded-2xl border border-white/15 p-4">
            <h2 className="font-display text-sm font-black tracking-[0.25em] text-white/80">
              PENGATURAN MATCH
            </h2>

            <label className="mt-4 flex flex-col gap-1">
              <span className="font-tech text-[10px] tracking-[0.3em] text-white/50">
                SERIES LABEL
              </span>
              <input
                type="text"
                value={series}
                maxLength={40}
                onChange={(e) => setSeries(e.target.value)}
                className="rounded-lg border border-white/20 bg-black/50 px-3 py-2 font-tech text-sm text-white outline-none transition-colors focus:border-tri-cyan"
                placeholder="Contoh: SERI YOGYAKARTA · MATCH DAY 1"
              />
            </label>

            <div className="mt-6 border-t border-white/15 pt-4">
              <h3 className="text-center font-display text-xs font-black tracking-[0.2em] text-cyan-400">
                PILIH KATEGORI
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCategory("SMA");
                    setSelectedSchools([]);
                  }}
                  className="rounded-2xl border-2 px-3 py-4 text-center transition-all"
                  style={{
                    borderColor:
                      category === "SMA" ? CYAN : "rgba(255,255,255,0.15)",
                    backgroundColor:
                      category === "SMA"
                        ? "rgba(0,229,255,0.1)"
                        : "transparent",
                    boxShadow:
                      category === "SMA" ? `0 0 20px ${CYAN}33` : undefined,
                  }}
                >
                  <p className="font-display font-black text-white">SMA/SMK</p>
                  <p className="font-tech text-xs text-white/50">24 Tim</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCategory("SMP");
                    setSelectedSchools([]);
                  }}
                  className="rounded-2xl border-2 px-3 py-4 text-center transition-all"
                  style={{
                    borderColor:
                      category === "SMP"
                        ? MAGENTA
                        : "rgba(255,255,255,0.15)",
                    backgroundColor:
                      category === "SMP"
                        ? "rgba(255,0,102,0.1)"
                        : "transparent",
                    boxShadow:
                      category === "SMP" ? `0 0 20px ${MAGENTA}33` : undefined,
                  }}
                >
                  <p className="font-display font-black text-white">SMP</p>
                  <p className="font-tech text-xs text-white/50">8 Tim</p>
                </button>
              </div>

              <p className="mt-4 text-center font-tech text-[10px] tracking-[0.3em] text-white/50">
                PILIH 2 SEKOLAH (1: KICKER, 2: GOALIE)
              </p>

              <div className="custom-scrollbar mt-3 grid max-h-[280px] grid-cols-2 gap-3 overflow-y-auto pr-2">
                {SCHOOL_LIST.filter((s) => s.category === category).map(
                  (school) => {
                    const idx = selectedSchools.indexOf(school.id);
                    const isActive = idx !== -1;
                    const activeColor = isActive
                      ? idx === 0
                        ? MAGENTA
                        : CYAN
                      : "transparent";
                    const roleLabel = isActive
                      ? idx === 0
                        ? "KICKER"
                        : "GOALIE"
                      : "";
                    const logoSrc = SCHOOL_LOGO_MAP[school.id];

                    return (
                      <button
                        key={school.id}
                        type="button"
                        onClick={() => handleSchoolClick(school.id)}
                        className="flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all active:scale-95"
                        style={{
                          borderColor: isActive
                            ? activeColor
                            : "rgba(255,255,255,0.1)",
                          backgroundColor: isActive
                            ? `${activeColor}15`
                            : "rgba(0,0,0,0.5)",
                          boxShadow: isActive
                            ? `0 0 20px ${activeColor}44`
                            : undefined,
                          opacity:
                            !isActive && selectedSchools.length === 2
                              ? 0.25
                              : 1,
                        }}
                      >
                        <div className="relative">
                          {logoSrc ? (
                            <img
                              src={logoSrc}
                              alt={school.name}
                              className="h-12 w-12 rounded-full bg-white/10 object-cover"
                            />
                          ) : (
                            <SchoolInitials
                              name={school.name}
                              color={
                                isActive
                                  ? activeColor
                                  : "rgba(255,255,255,0.5)"
                              }
                            />
                          )}
                          {isActive && (
                            <div
                              className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border bg-black text-[9px] font-bold"
                              style={{
                                color: activeColor,
                                borderColor: activeColor,
                                boxShadow: `0 0 8px ${activeColor}`,
                              }}
                            >
                              {idx + 1}
                            </div>
                          )}
                        </div>
                        <div className="w-full overflow-hidden text-center">
                          <p className="truncate font-display text-xs font-bold text-white">
                            {school.name}
                          </p>
                          <p className="truncate font-tech text-[9px] tracking-wider text-white/50">
                            {school.detail}
                          </p>
                          {roleLabel && (
                            <p
                              className="mt-1 font-display text-[8px] font-black tracking-[0.2em]"
                              style={{ color: activeColor }}
                            >
                              {roleLabel}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={createLobby}
                disabled={!twoSelected}
                className="w-full rounded-xl border-2 py-3 font-display text-sm font-black tracking-[0.2em] transition-all disabled:border-white/20 disabled:opacity-30"
                style={{
                  borderColor: twoSelected ? CYAN : undefined,
                  boxShadow: twoSelected
                    ? `0 0 20px ${CYAN}66`
                    : undefined,
                  color: twoSelected ? CYAN : "white",
                  animation: twoSelected
                    ? "tri-pulse-glow 2s ease-in-out infinite"
                    : undefined,
                  ["--glow-color" as string]: CYAN,
                }}
              >
                BUAT LOBBY SEKARANG
              </button>
            </div>
          </section>
        ) : (
          <section className="tri-glass flex animate-in fade-in zoom-in flex-col items-center rounded-2xl border border-white/15 p-6 duration-300">
            <div
              className="mb-3 h-1 w-16 rounded-full"
              style={{
                background: `linear-gradient(90deg, ${MAGENTA}, ${CYAN})`,
                boxShadow: `0 0 12px ${MAGENTA}`,
              }}
            />
            <h2 className="text-center font-display text-lg font-black tracking-[0.2em] text-cyan-400">
              LOBBY TERBUKA!
            </h2>
            <p className="mt-2 text-center font-tech text-xs text-white/60">
              Pemain sekarang dapat scan QR atau akses link di bawah untuk
              registrasi.
            </p>

            <div
              className="mt-6 rounded-xl p-3"
              style={{
                border: `2px solid ${CYAN}55`,
                boxShadow: `0 0 30px ${CYAN}33, inset 0 0 20px ${CYAN}11`,
                background: "rgba(255,255,255,0.95)",
              }}
            >
              <img
                src={qrCodeUrl}
                alt="Join QR Code"
                className="h-[200px] w-[200px]"
              />
            </div>

            <div className="mt-4 w-full rounded-lg border border-white/10 bg-black/40 p-3 text-center">
              <p className="mb-1 font-tech text-xs text-white/40">
                LINK AKSES
              </p>
              <a
                href={joinUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all font-display text-sm font-bold text-tri-magenta"
              >
                {joinUrl}
              </a>
            </div>

            <div className="mt-8 w-full">
              <Link
                to="/admin-live"
                className="block w-full rounded-xl bg-tri-magenta py-3 text-center font-display text-sm font-black tracking-[0.2em] text-white shadow-[0_0_20px_rgba(255,0,102,0.4)] transition-transform hover:scale-[1.02] active:scale-95"
              >
                MASUK KE LIVE CONTROL
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
