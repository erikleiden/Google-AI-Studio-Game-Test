import React, { useState, useCallback } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { UIOverlay } from './components/UIOverlay';
import { GameState, TowerType, WaveComposition } from './types';
import { INITIAL_MONEY, INITIAL_LIVES } from './constants';
import { generateWave, getTacticalAdvice } from './services/geminiService';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    money: INITIAL_MONEY,
    lives: INITIAL_LIVES,
    wave: 0,
    isPlaying: false,
    isGameOver: false,
    gameSpeed: 1
  });

  const [selectedTower, setSelectedTower] = useState<TowerType | null>(null);
  const [waveComposition, setWaveComposition] = useState<WaveComposition | null>(null);
  const [isWaveGenerating, setIsWaveGenerating] = useState(false);
  const [waveBriefing, setWaveBriefing] = useState<string>("System online. Awaiting command.");
  const [aiAdvice, setAiAdvice] = useState<string>("");

  const startNextWave = useCallback(async () => {
    if (gameState.isPlaying || isWaveGenerating) return;

    setIsWaveGenerating(true);
    const nextWave = gameState.wave + 1;
    
    // Calculate difficulty multiplier
    const diffMod = 1.0 + (nextWave * 0.15);

    try {
      // Parallel requests for speed: Wave Gen + Flavor Text
      // Actually, better to sequence them or prioritize wave gen so game can start?
      // Let's do parallel but wait for wave to start.
      
      const waveData = await generateWave(nextWave, diffMod);
      
      setWaveComposition(waveData);
      setWaveBriefing(waveData.briefing);
      setGameState(prev => ({ ...prev, wave: nextWave, isPlaying: true }));
      
      // Fire-and-forget advice generation to not block
      getTacticalAdvice(nextWave, gameState.money, gameState.lives, []) // TODO: Pass actual towers if we lifted state up fully, but for now empty array is okay for first version or pass dummy.
          .then(advice => setAiAdvice(advice))
          .catch(() => {});

    } catch (error) {
      console.error("Error starting wave:", error);
    } finally {
      setIsWaveGenerating(false);
    }
  }, [gameState.wave, gameState.isPlaying, gameState.money, gameState.lives, isWaveGenerating]);

  const handleWaveComplete = useCallback(() => {
    setGameState(prev => ({ ...prev, isPlaying: false }));
    setWaveComposition(null);
    setAiAdvice("Wave clear. Repairs unavailable. Prepare for next assault.");
  }, []);

  const handleGameOver = useCallback(() => {
    setGameState(prev => ({ ...prev, isGameOver: true, isPlaying: false }));
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-black">
      <div className="flex shadow-2xl overflow-hidden rounded-xl border border-slate-800">
        <GameCanvas 
          gameState={gameState}
          setGameState={setGameState}
          selectedTower={selectedTower}
          waveComposition={waveComposition}
          onWaveComplete={handleWaveComplete}
          onGameOver={handleGameOver}
        />
        <UIOverlay 
          gameState={gameState}
          selectedTower={selectedTower}
          setSelectedTower={setSelectedTower}
          startNextWave={startNextWave}
          isWaveGenerating={isWaveGenerating}
          waveBriefing={waveBriefing}
          aiAdvice={aiAdvice}
        />
      </div>
    </div>
  );
};

export default App;
