import { 
  GameRoot, 
  GameHeader, 
  GameBoard, 
  GameDock, 
  GameOverlay 
} from "@/components/game/GameModule";

export default function Home() {
  return (
    <main className="h-[100dvh] overflow-hidden">
      <GameRoot>
        <GameHeader />
        <GameBoard />
        <GameDock />
        <GameOverlay />
      </GameRoot>
    </main>
  );
}
