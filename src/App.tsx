import { useEffect, useState } from 'react';
import { MainMenu } from './components/MainMenu';
import { GameArena } from './components/GameArena';
import { ResultScreen } from './components/ResultScreen';
import { audio } from './utils/audio';
import './App.css';

type GameState = 'MAIN_MENU' | 'PLAYING' | 'RESULTS';

function App() {
  const [gameState, setGameState] = useState<GameState>('MAIN_MENU');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [isPaused, setIsPaused] = useState(false);
  const [globalHighScore, setGlobalHighScore] = useState(0);

  // Result metrics
  const [results, setResults] = useState({
    victory: false,
    score: 0,
    wpm: 0,
    accuracy: 100,
    waveReached: 1,
  });

  // Load high score
  useEffect(() => {
    const stored = localStorage.getItem('highscore_global');
    if (stored) {
      setGlobalHighScore(parseInt(stored, 10));
    }
  }, [gameState]);

  const handleStartGame = (selectedDiff: 'easy' | 'medium' | 'hard') => {
    setDifficulty(selectedDiff);
    setIsPaused(false);
    setGameState('PLAYING');
  };

  const handleGameOver = (score: number, wpm: number, accuracy: number, waveReached: number) => {
    setResults({
      victory: false,
      score,
      wpm,
      accuracy,
      waveReached,
    });
    setGameState('RESULTS');
  };

  const handleVictory = (score: number, wpm: number, accuracy: number) => {
    setResults({
      victory: true,
      score,
      wpm,
      accuracy,
      waveReached: 5, // All waves cleared
    });
    setGameState('RESULTS');
  };

  const handlePauseToggle = () => {
    audio.playKey();
    setIsPaused(prev => !prev);
  };

  const handleRestart = () => {
    setIsPaused(false);
    setGameState('PLAYING');
  };

  const handleMainMenu = () => {
    setGameState('MAIN_MENU');
  };

  return (
    <div className="game-wrapper">
      {gameState === 'MAIN_MENU' && (
        <MainMenu onStartGame={handleStartGame} highScore={globalHighScore} />
      )}

      {gameState === 'PLAYING' && (
        <div className="playing-container">
          <GameArena
            difficulty={difficulty}
            onGameOver={handleGameOver}
            onVictory={handleVictory}
            onPauseToggle={handlePauseToggle}
            isPaused={isPaused}
          />

          {isPaused && (
            <div className="pause-overlay animate-fade-in">
              <div className="pause-modal">
                <h2 className="pause-title">SYSTEM PAUSED</h2>
                <p className="pause-subtitle">TACTICAL COMMS SUSPENDED</p>
                <div className="pause-actions">
                  <button 
                    className="glow-button resume-btn" 
                    onClick={() => {
                      audio.playKey();
                      setIsPaused(false);
                    }}
                  >
                    RESUME COMBAT
                  </button>
                  <button 
                    className="glow-button restart-btn" 
                    onClick={handleRestart}
                  >
                    RESTART MATCH
                  </button>
                  <button 
                    className="glow-button menu-btn" 
                    onClick={handleMainMenu}
                  >
                    QUIT TO INTERFACE
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {gameState === 'RESULTS' && (
        <ResultScreen
          victory={results.victory}
          score={results.score}
          wpm={results.wpm}
          accuracy={results.accuracy}
          waveReached={results.waveReached}
          difficulty={difficulty}
          onRestart={handleRestart}
          onMainMenu={handleMainMenu}
        />
      )}
    </div>
  );
}

export default App;
