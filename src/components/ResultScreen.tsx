import React, { useEffect, useState } from 'react';
import { audio } from '../utils/audio';

interface ResultScreenProps {
  victory: boolean;
  score: number;
  wpm: number;
  accuracy: number;
  waveReached: number;
  difficulty: 'easy' | 'medium' | 'hard';
  onRestart: () => void;
  onMainMenu: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  victory,
  score,
  wpm,
  accuracy,
  waveReached,
  difficulty,
  onRestart,
  onMainMenu,
}) => {
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  // Calculate Rank
  const getRank = () => {
    const acc = accuracy;
    const speed = wpm;
    if (victory && acc >= 96 && speed >= 60) return 'S';
    if (acc >= 90 && speed >= 45) return 'A';
    if (acc >= 80 && speed >= 35) return 'B';
    if (acc >= 70 && speed >= 25) return 'C';
    return 'D';
  };

  const rank = getRank();

  useEffect(() => {
    // Play end sound
    if (victory) {
      audio.playVictory();
    } else {
      audio.playGameOver();
    }

    // Check high score
    const key = `highscore_${difficulty}`;
    const stored = localStorage.getItem(key);
    const prevHigh = stored ? parseInt(stored, 10) : 0;
    if (score > prevHigh) {
      localStorage.setItem(key, score.toString());
      // Save global high score too
      const globalKey = 'highscore_global';
      const storedGlobal = localStorage.getItem(globalKey);
      const prevGlobal = storedGlobal ? parseInt(storedGlobal, 10) : 0;
      if (score > prevGlobal) {
        localStorage.setItem(globalKey, score.toString());
      }
      setIsNewHighScore(true);
    }
  }, [victory, score, difficulty]);

  return (
    <div className="results-container animate-fade-in">
      <div className="grid-overlay"></div>

      <header className="results-header">
        <h1 className={`results-title-neon ${victory ? 'victory' : 'defeat'}`}>
          {victory ? 'MISSION COMPLETE' : 'SYSTEM SHUTDOWN'}
        </h1>
        <p className="results-subtitle">
          {victory 
            ? 'The database is secure. You have proven your typing prowess!' 
            : 'Operational status: TERMINATED. Enemy overwhelmed the node.'}
        </p>
      </header>

      {isNewHighScore && (
        <div className="new-high-score-banner animate-bounce">
          🏆 NEW HIGH SCORE! 🏆
        </div>
      )}

      <div className="results-body">
        {/* Rank Circle */}
        <div className="rank-wrapper animate-scale-up">
          <div className="rank-label">COMBAT RANK</div>
          <div className={`rank-letter rank-${rank}`}>{rank}</div>
        </div>

        {/* Stats Grid */}
        <div className="stats-report">
          <div className="report-row">
            <span className="report-label">DIFFICULTY:</span>
            <span className="report-value highlight-text">{difficulty.toUpperCase()}</span>
          </div>
          <div className="report-row">
            <span className="report-label">SCORE:</span>
            <span className="report-value score-glow">{score.toLocaleString()}</span>
          </div>
          <div className="report-row">
            <span className="report-label">WPM (SPEED):</span>
            <span className="report-value">{Math.round(wpm)} WPM</span>
          </div>
          <div className="report-row">
            <span className="report-label">TYPING ACCURACY:</span>
            <span className="report-value">{Math.round(accuracy)}%</span>
          </div>
          <div className="report-row">
            <span className="report-label">WAVES CLEARED:</span>
            <span className="report-value">{victory ? 'ALL (4/4)' : `${waveReached - 1} / 4`}</span>
          </div>
        </div>
      </div>

      <div className="results-actions animate-slide-up">
        <button 
          className="glow-button restart-btn" 
          onClick={() => {
            audio.playAttack('weak');
            onRestart();
          }}
          onMouseEnter={() => audio.playKey()}
        >
          REBOOT MATCH
        </button>
        <button 
          className="glow-button menu-btn" 
          onClick={() => {
            audio.playKey();
            onMainMenu();
          }}
          onMouseEnter={() => audio.playKey()}
        >
          RETURN TO INTERFACE
        </button>
      </div>
    </div>
  );
};
