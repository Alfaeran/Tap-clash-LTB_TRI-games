import { createFileRoute } from "@tanstack/react-router";
import BattleScreen from "@/components/phases/BattleScreen";
import ChargingScreen from "@/components/phases/ChargingScreen";
import LoginScreen from "@/components/phases/LoginScreen";
import ResultScreen from "@/components/phases/ResultScreen";
import { useMatch } from "@/lib/matchStore";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tri LTB — 1v1 Reflex Duel Clash" },
      {
        name: "description",
        content:
          "Duel tap refleks 1v1 Kicker vs Goalie: registrasi pemain, charging, tug-of-war neon, lalu twibbon kemenangan.",
      },
      { property: "og:title", content: "Tri LTB — 1v1 Reflex Duel Clash" },
      {
        property: "og:description",
        content:
          "Tap lebih cepat dari lawanmu. Duel neon 60 detik Kicker vs Goalie dengan tug-of-war langsung.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlayerFlow,
});

function PlayerFlow() {
  const match = useMatch();
  if (match.status === "charging") return <ChargingScreen />;
  if (match.status === "live") return <BattleScreen />;
  if (match.status === "finished") return <ResultScreen />;
  return <LoginScreen />;
}
