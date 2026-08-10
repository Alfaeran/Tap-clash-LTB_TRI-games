import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { matchActions, useMatch } from "@/lib/matchStore";
import { SCHOOL_LIST } from "@/lib/schoolsData";

const MAGENTA = "#FF0066";
const CYAN = "#00E5FF";

export default function AdminScreen() {
  const match = useMatch();
  const [series, setSeries] = useState(match.seriesLabel);
  const [category, setCategory] = useState<"SMA" | "SMP">("SMA");
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);
  const [lobbyCreated, setLobbyCreated] = useState(false);

  const handleSchoolClick = (schoolId: string) => {
    if (lobbyCreated) return;
    
    if (selectedSchools.includes(schoolId)) {
      setSelectedSchools(selectedSchools.filter(x => x !== schoolId));
    } else {
      if (selectedSchools.length < 2) {
        setSelectedSchools([...selectedSchools, schoolId]);
      }
    }
  };

  const createLobby = () => {
    if (selectedSchools.length !== 2) return;
    const name1 = SCHOOL_LIST.find(s => s.id === selectedSchools[0])?.name || "A";
    const name2 = SCHOOL_LIST.find(s => s.id === selectedSchools[1])?.name || "B";
    matchActions.setupMatch(name1, name2, series);
    setLobbyCreated(true);
  };

  // URL for players to join
  const joinUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : '';
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}&bgcolor=1a1a1a&color=ffffff&margin=10`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] p-4 font-sans selection:bg-tri-magenta/30">
      <div className="w-full max-w-sm space-y-4">
        {/* Header */}
        <header className="flex flex-col items-center gap-1 pb-4">
          <h1 className="font-display text-xl font-black uppercase tracking-[0.25em] text-white">
            <span className="tri-text-magenta">TRI</span> <span className="text-white/40">LTB</span> 2026
          </h1>
          <p className="font-tech text-[10px] tracking-[0.4em] text-white/50">LOBBY DASHBOARD</p>
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
              />
            </label>

            <div className="mt-6 border-t border-white/15 pt-4">
              <h3 className="text-center font-display text-xs font-black tracking-[0.2em] text-cyan-400">PILIH KATEGORI</h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCategory("SMA")}
                  className="rounded-2xl border-2 px-3 py-4 text-center transition-all"
                  style={{
                    borderColor: category === "SMA" ? CYAN : "rgba(255,255,255,0.15)",
                    backgroundColor: category === "SMA" ? "rgba(0,229,255,0.1)" : "transparent",
                  }}
                >
                  <p className="font-display font-black text-white">SMA/SMK</p>
                  <p className="font-tech text-xs text-white/50">24 Tim</p>
                </button>
                <button
                  type="button"
                  onClick={() => setCategory("SMP")}
                  className="rounded-2xl border-2 px-3 py-4 text-center transition-all"
                  style={{
                    borderColor: category === "SMP" ? MAGENTA : "rgba(255,255,255,0.15)",
                    backgroundColor: category === "SMP" ? "rgba(255,0,102,0.1)" : "transparent",
                  }}
                >
                  <p className="font-display font-black text-white">SMP</p>
                  <p className="font-tech text-xs text-white/50">8 Tim</p>
                </button>
              </div>
              
              <p className="mt-4 font-tech text-[10px] tracking-[0.3em] text-white/50 text-center">
                PILIH MAKSIMAL 2 SEKOLAH (1: KICKER, 2: GOALIE)
              </p>

              <div className="mt-3 grid grid-cols-2 gap-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                {SCHOOL_LIST.filter(s => s.category === category).map((school) => {
                  const idx = selectedSchools.indexOf(school.id);
                  const isActive = idx !== -1;
                  const activeColor = isActive ? (idx === 0 ? MAGENTA : CYAN) : "transparent";
                  
                  return (
                    <button
                      key={school.id}
                      type="button"
                      onClick={() => handleSchoolClick(school.id)}
                      className="flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-transform active:scale-95"
                      style={{
                        borderColor: isActive ? activeColor : "rgba(255,255,255,0.1)",
                        backgroundColor: isActive ? `${activeColor}22` : "rgba(0,0,0,0.5)",
                        boxShadow: isActive ? `0 0 15px ${activeColor}55` : undefined,
                        opacity: !isActive && selectedSchools.length === 2 ? 0.3 : 1,
                      }}
                    >
                      <div className="relative">
                        <img 
                          src={`https://placehold.co/100x100?text=${school.name.substring(0, 3)}`}
                          alt={school.name}
                          className="w-12 h-12 rounded-full bg-white/10 object-cover"
                        />
                        {isActive && (
                          <div className="absolute -bottom-1 -right-1 rounded-full bg-black border border-white text-[9px] font-bold w-5 h-5 flex items-center justify-center" style={{ color: activeColor, borderColor: activeColor }}>
                            {idx + 1}
                          </div>
                        )}
                      </div>
                      <div className="text-center w-full overflow-hidden">
                        <p className="font-display text-xs font-bold text-white truncate">{school.name}</p>
                        <p className="font-tech text-[9px] tracking-wider text-white/50 truncate">{school.detail}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={createLobby}
                disabled={selectedSchools.length !== 2}
                className="w-full rounded-xl border-2 py-3 font-display text-sm font-black tracking-[0.2em] transition-all disabled:opacity-30 disabled:border-white/20"
                style={{
                  borderColor: selectedSchools.length === 2 ? CYAN : undefined,
                  boxShadow: selectedSchools.length === 2 ? `0 0 15px ${CYAN}66` : undefined,
                  color: selectedSchools.length === 2 ? CYAN : "white"
                }}
              >
                BUAT LOBBY SEKARANG
              </button>
            </div>
          </section>
        ) : (
          <section className="tri-glass rounded-2xl border border-white/15 p-6 flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <h2 className="font-display text-lg font-black tracking-[0.2em] text-cyan-400 text-center">
              LOBBY TERBUKA!
            </h2>
            <p className="mt-2 font-tech text-xs text-white/60 text-center">
              Pemain sekarang dapat melakukan scan QR atau mengakses link di bawah untuk registrasi.
            </p>

            <div className="mt-6 p-2 bg-white rounded-xl">
              <img src={qrCodeUrl} alt="Join QR Code" className="w-[200px] h-[200px]" />
            </div>

            <div className="mt-4 w-full text-center p-3 border border-white/10 rounded-lg bg-black/40">
              <p className="font-tech text-xs text-white/40 mb-1">LINK AKSES</p>
              <a href={joinUrl} target="_blank" rel="noreferrer" className="font-display text-sm text-tri-magenta font-bold break-all">
                {joinUrl}
              </a>
            </div>

            <div className="mt-8 w-full">
              <Link
                to="/admin-live"
                className="block w-full rounded-xl bg-tri-magenta py-3 text-center font-display text-sm font-black tracking-[0.2em] text-white transition-transform hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(255,0,102,0.4)]"
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
