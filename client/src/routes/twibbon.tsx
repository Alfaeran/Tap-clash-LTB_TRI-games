import { createFileRoute } from "@tanstack/react-router";
import TwibbonScreen from "@/components/phases/TwibbonScreen";

export const Route = createFileRoute("/twibbon")({
  head: () => ({
    meta: [
      { title: "Twibbon Generator — Tri LTB Duel Clash" },
      {
        name: "description",
        content:
          "Buat twibbon 9:16 hasil duel: skor pertandingan, nama sekolah, upload selfie, lalu download atau share ke Instagram.",
      },
      { property: "og:title", content: "Twibbon Generator — Tri LTB Duel Clash" },
      {
        property: "og:description",
        content: "Cetak momen kemenangan duel Tri LTB jadi twibbon neon siap unggah.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TwibbonScreen,
});
