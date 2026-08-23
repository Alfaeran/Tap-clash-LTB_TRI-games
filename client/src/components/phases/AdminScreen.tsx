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
  const [scheduledTime, setScheduledTime] = useState("");
  const [category, setCategory] = useState<"SMA" | "SMP">("SMA");
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);
  
  // Local state to show the modal when a match is started
  const [showCodeModal, setShowCodeModal] = useState(false);

  const handleSchoolClick = (schoolId: string) => {
    if (selectedSchools.includes(schoolId)) {
      setSelectedSchools(selectedSchools.filter((x) => x !== schoolId));
    } else {
      if (selectedSchools.length < 2) {
        setSelectedSchools([...selectedSchools, schoolId]);
      }
    }
  };

  const scheduleNewMatch = () => {
    if (selectedSchools.length !== 2) return;
    const school1 = SCHOOL_LIST.find((s) => s.id === selectedSchools[0]);
    const school2 = SCHOOL_LIST.find((s) => s.id === selectedSchools[1]);
    const name1 = school1 ? `${school1.name} ${school1.detail}` : "A";
    const name2 = school2 ? `${school2.name} ${school2.detail}` : "B";
    
    const timeToUse = scheduledTime.trim() || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    
    matchActions.scheduleMatch(name1, name2, series, timeToUse);
    
    // Reset selection
    setSelectedSchools([]);
    setScheduledTime("");
  };

  const handleStartMatch = (id: string) => {
    matchActions.startScheduled(id);
    setShowCodeModal(true);
  };

  const twoSelected = selectedSchools.length === 2;

  // B-6: the server rejects ADMIN_* from unauthenticated sockets. Say so here
  // rather than letting the operator press buttons that silently do nothing.
  if (match.isConnected && !match.isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050510] p-4 font-sans">
        <div className="tri-glass w-full max-w-md rounded-2xl border border-white/15 p-8 text-center">
          <h2 className="font-display text-lg font-black tracking-[0.2em] text-tri-magenta">
            AKSES DITOLAK
          </h2>
          <p className="mt-4 font-tech text-xs leading-relaxed tracking-wide text-white/60">
            Panel admin butuh token. Buka ulang halaman ini dengan
            <span className="mt-2 block rounded-lg border border-white/20 bg-black/50 px-3 py-2 font-mono text-[11px] text-tri-cyan">
              /admin?adminToken=TOKEN
            </span>
            <span className="mt-3 block">
              Token tercetak di log server saat startup, atau diset lewat env
              <span className="text-white/80"> ADMIN_TOKEN</span>.
            </span>
          </p>
        </div>
      </div>
    );
  }

  // If a match was started and we have the code, show the giant modal
  if (showCodeModal && match.activeMatchCode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050510] p-4 font-sans selection:bg-tri-magenta/30">
        <div className="tri-glass flex animate-in fade-in zoom-in flex-col items-center rounded-2xl border border-white/15 p-8 duration-500 max-w-md w-full">
          <h2 className="text-center font-display text-lg font-black tracking-[0.2em] text-cyan-400">
            PERTANDINGAN DIMULAI
          </h2>
          <p className="mt-2 text-center font-tech text-[10px] tracking-widest text-white/60 mb-6 uppercase">
            Silakan umumkan kode ini ke peserta:
          </p>
          
          <div className="rounded-2xl border-4 border-tri-magenta bg-black/60 p-6 w-full text-center shadow-[0_0_40px_rgba(255,0,102,0.5)]">
            <p className="font-display text-5xl font-black tracking-[0.3em] text-white tabular-nums drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">
              {match.activeMatchCode}
            </p>
          </div>
          
          <div className="mt-8 w-full">
            <Link
              to="/admin-live"
              onClick={() => setShowCodeModal(false)}
              className="block w-full rounded-xl bg-tri-magenta py-4 text-center font-display text-sm font-black tracking-[0.2em] text-white shadow-[0_0_20px_rgba(255,0,102,0.4)] transition-transform hover:scale-[1.02] active:scale-95"
            >
              MASUK KE LIVE CONTROL
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-[#050510] p-4 font-sans selection:bg-tri-magenta/30 overflow-y-auto">
      <div className="w-full max-w-sm space-y-6 pb-20">
        {/* Header */}
        <header className="flex flex-col items-center gap-1 pt-4">
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
            ADMIN SCHEDULER
          </p>
        </header>

        {/* List of Scheduled Matches */}
        <section className="tri-glass rounded-2xl border border-white/15 p-4">
          <h2 className="font-display text-sm font-black tracking-[0.25em] text-tri-cyan mb-4">
            JADWAL AKTIF
          </h2>
          <div className="flex flex-col gap-3">
            {match.scheduledMatches.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/30 py-6 text-center">
                <p className="font-tech text-xs tracking-[0.2em] text-white/30">BELUM ADA JADWAL</p>
              </div>
            ) : (
              match.scheduledMatches.map((sm) => (
                <div key={sm.id} className="rounded-xl border border-white/20 bg-black/50 p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-tech text-[10px] tracking-[0.2em] text-white/60">{sm.seriesCity}</span>
                    <span className="rounded bg-white/10 px-2 py-0.5 font-tech text-[10px] font-bold text-white">{sm.scheduledTime}</span>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <p className="font-display text-sm font-bold text-tri-magenta truncate w-[45%] text-right">{sm.schoolA}</p>
                    <span className="font-tech text-[10px] text-white/30 font-bold">VS</span>
                    <p className="font-display text-sm font-bold text-tri-cyan truncate w-[45%] text-left">{sm.schoolB}</p>
                  </div>
                  <button
                    onClick={() => handleStartMatch(sm.id)}
                    className="w-full rounded-lg bg-tri-cyan/20 border border-tri-cyan py-2 font-display text-[11px] font-black tracking-widest text-tri-cyan transition-all active:scale-95 hover:bg-tri-cyan hover:text-black"
                    style={{ boxShadow: `0 0 15px ${CYAN}33` }}
                  >
                    START MATCH
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Scheduling Form */}
        <section className="tri-glass rounded-2xl border border-white/15 p-4">
          <h2 className="font-display text-sm font-black tracking-[0.25em] text-white/80">
            BUAT JADWAL BARU
          </h2>

          <div className="mt-4 flex gap-2">
            <label className="flex flex-col gap-1 flex-1">
              <span className="font-tech text-[10px] tracking-[0.3em] text-white/50">SERIES LABEL</span>
              <input
                type="text"
                value={series}
                maxLength={40}
                onChange={(e) => setSeries(e.target.value)}
                className="rounded-lg border border-white/20 bg-black/50 px-3 py-2 font-tech text-xs text-white outline-none transition-colors focus:border-tri-cyan"
                placeholder="Ex: SERI JOGJA"
              />
            </label>
            <label className="flex flex-col gap-1 w-24">
              <span className="font-tech text-[10px] tracking-[0.3em] text-white/50">JAM</span>
              <input
                type="text"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="rounded-lg border border-white/20 bg-black/50 px-3 py-2 font-tech text-xs text-white text-center outline-none transition-colors focus:border-tri-cyan"
                placeholder="10:00"
              />
            </label>
          </div>

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
              onClick={scheduleNewMatch}
              disabled={!twoSelected}
              className="w-full rounded-xl border-2 py-3 font-display text-sm font-black tracking-[0.2em] transition-all disabled:border-white/20 disabled:opacity-30"
              style={{
                borderColor: twoSelected ? MAGENTA : undefined,
                boxShadow: twoSelected
                  ? `0 0 20px ${MAGENTA}66`
                  : undefined,
                color: twoSelected ? MAGENTA : "white",
              }}
            >
              JADWALKAN PERTANDINGAN
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
