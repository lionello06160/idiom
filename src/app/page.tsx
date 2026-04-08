import { 
  GameRoot, 
  GameHeader, 
  GameBoard, 
  GameDock, 
  GameOverlay 
} from "@/components/game/GameModule";

export default function Home() {
  return (
    <main>
      <GameRoot>
        <GameHeader />
        <GameBoard />
        <GameDock />
        <GameOverlay />
      </GameRoot>
    </main>
  );
}
