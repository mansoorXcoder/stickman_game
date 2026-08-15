import React, { useState } from 'react';
import { audio } from '../utils/audio';

interface MainMenuProps {
  onStartGame: (difficulty: 'easy' | 'medium' | 'hard') => void;
  highScore: number;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onStartGame, highScore }) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [isMuted, setIsMuted] = useState(audio.getMuted());

  const handleHover = () => {
    audio.init();
    audio.playKey();
  };

  const handleMuteToggle = () => {
    audio.init();
    const muted = audio.toggleMute();
    setIsMuted(muted);
    audio.playKey();
  };

  const handleStart = () => {
    audio.init();
    audio.playAttack('weak');
    onStartGame(selectedDifficulty);
  };

  return (
    <div className="menu-container">
      <div className="decorations">
        <div className="grid-overlay"></div>
        <div className="cyber-circle circle-1"></div>
        <div className="cyber-circle circle-2"></div>
      </div>

      <header className="menu-header animate-fade-in">
        <div className="tagline">RETRO COMBAT EXPERIMENT v1.0</div>
        <h1 className="title-neon">
          KEYBOARD <span className="highlight">WARRIOR</span>
        </h1>
        <div className="sub-title">A TYPING BEAT-'EM-UP GAME</div>
      </header>

      {highScore > 0 && (
        <div className="high-score-tag animate-pulse">
          HIGH SCORE: <span className="score-val">{highScore}</span>
        </div>
      )}

      <main className="menu-body animate-slide-up">
        <section className="difficulty-section">
          <h3>CHOOSE DIFFICULTY</h3>
          <div className="difficulty-grid">
            <button
              className={`difficulty-card easy ${selectedDifficulty === 'easy' ? 'active' : ''}`}
              onClick={() => {
                setSelectedDifficulty('easy');
                audio.playKey();
              }}
              onMouseEnter={handleHover}
            >
              <div className="difficulty-title">EASY</div>
              <p className="difficulty-desc">Slow enemies, shorter words. Great for practice.</p>
              <div className="difficulty-stat">WPM Goal: ~25</div>
            </button>

            <button
              className={`difficulty-card medium ${selectedDifficulty === 'medium' ? 'active' : ''}`}
              onClick={() => {
                setSelectedDifficulty('medium');
                audio.playKey();
              }}
              onMouseEnter={handleHover}
            >
              <div className="difficulty-title">MEDIUM</div>
              <p className="difficulty-desc">Standard speed and health. Balanced pacing.</p>
              <div className="difficulty-stat">WPM Goal: ~45</div>
            </button>

            <button
              className={`difficulty-card hard ${selectedDifficulty === 'hard' ? 'active' : ''}`}
              onClick={() => {
                setSelectedDifficulty('hard');
                audio.playKey();
              }}
              onMouseEnter={handleHover}
            >
              <div className="difficulty-title">HARD</div>
              <p className="difficulty-desc">Furious sprinters, heavy titans, long vocabularies.</p>
              <div className="difficulty-stat">WPM Goal: 70+</div>
            </button>
          </div>
        </section>

        <section className="action-section">
          <button 
            className="start-button glow-button" 
            onClick={handleStart}
            onMouseEnter={handleHover}
          >
            INITIALIZE COMBAT
          </button>
          
          <button 
            className={`mute-button ${isMuted ? 'muted' : ''}`}
            onClick={handleMuteToggle}
            onMouseEnter={handleHover}
            title={isMuted ? "Unmute Sound" : "Mute Sound"}
          >
            {isMuted ? "🔇 SOUND OFF" : "🔊 SOUND ON"}
          </button>
        </section>

        <section className="controls-guide">
          <h3>SYSTEM CONTROLS</h3>
          <div className="controls-grid">
            <div className="control-item">
              <span className="key-cap">A</span>
              <span className="key-cap">D</span>
              <span className="control-desc">Move Left / Right</span>
            </div>
            <div className="control-item">
              <span className="key-cap long">SPACE</span>
              <span className="control-desc">Jump / Dodge</span>
            </div>
            <div className="control-item">
              <span className="key-cap letters">WORD KEYS</span>
              <span className="control-desc">Attack Target</span>
            </div>
            <div className="control-item">
              <span className="key-cap medium-cap">SHIFT</span>
              <span className="control-desc">Special Attack (at 100% Charge)</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="menu-footer">
        <p>Built using Canvas + Web Audio Synth | DeepMind Pair-Programming 2026</p>
      </footer>
    </div>
  );
};
