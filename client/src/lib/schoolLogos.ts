import { SCHOOL_LIST } from "./schoolsData";

/**
 * Logo files live in /public/school-logo and are served by express (server.js)
 * from the app root. Filenames do not match the school labels character for
 * character ("SMKN 2 KLATEN" vs "SMK Negeri 2 Klaten.png"), so the mapping is
 * explicit and keyed by school id — the one stable identifier.
 *
 * checks/school-logo-check.cjs asserts every entry here points at a file that
 * exists and every id is a real school, so a rename cannot silently blank out
 * a logo.
 */
const LOGO_FILE_BY_ID: Record<string, string> = {
  "SMA-1": "MAN 2 Yogyakarta.png",
  "SMA-2": "SMAN 1 Sayegan.jpg",
  "SMA-3": "SMAN 4 Yogyakarta.png",
  "SMA-4": "SMK Negeri 2 Klaten.png",
  "SMA-7": "SMAN 8 Yogyakarta.png",
  "SMA-8": "SMAN 10 Yogyakarta.png",
  "SMA-10": "SMAN 7 Yogyakarta.png",
  "SMA-15": "SMAN 1 Godean.jpg",
  "SMA-17": "SMAN 6 Yogyakarta.png",
  "SMA-19": "SMAN 1 Wates.png",
  "SMA-22": "SMKN 3 Yogyakarta.jpg",
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// The match state carries display names ("MAN 2 YOGYAKARTA"), not ids, so the
// reverse index is built from the same source of truth the admin picks from.
const ID_BY_DISPLAY_NAME = new Map(
  SCHOOL_LIST.map((s) => [norm(`${s.name} ${s.detail}`), s.id]),
);

export function schoolLogoUrlById(id: string | null | undefined): string | null {
  if (!id) return null;
  const file = LOGO_FILE_BY_ID[id];
  return file ? `/school-logo/${encodeURIComponent(file)}` : null;
}

/** Resolves the display name stored on a match back to a logo URL. */
export function schoolLogoUrl(displayName: string | null | undefined): string | null {
  if (!displayName) return null;
  return schoolLogoUrlById(ID_BY_DISPLAY_NAME.get(norm(displayName)));
}

export const __testing = { LOGO_FILE_BY_ID };
