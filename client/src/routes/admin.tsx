import { createFileRoute } from "@tanstack/react-router";
import AdminScreen from "@/components/phases/AdminScreen";

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>) => ({
    adminToken: search.adminToken as string | undefined,
  }),
  head: () => ({
    meta: [
      { title: "Admin Control — Tri LTB Duel Clash" },
      {
        name: "description",
        content:
          "Panel admin Tri LTB: atur sekolah peserta, durasi match, lalu start, stop, dan reset duel secara langsung.",
      },
      { property: "og:title", content: "Admin Control — Tri LTB Duel Clash" },
      {
        property: "og:description",
        content: "Setup sekolah dan kendalikan jalannya duel Kicker vs Goalie secara real-time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminScreen,
});
