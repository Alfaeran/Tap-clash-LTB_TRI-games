import { createFileRoute } from "@tanstack/react-router";
import LeaderboardScreen from "@/components/phases/LeaderboardScreen";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Global Leaderboard — Tri LTB Duel Clash" },
      {
        name: "description",
        content: "Klasemen sementara sekolah di Tri LTB Duel Clash.",
      },
    ],
  }),
  component: LeaderboardScreen,
});
