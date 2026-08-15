import React from 'react';

interface HUDProps {
  hp: number;
  maxHp: number;
  wave: number;
  totalWaves: number;
  score: number;
  combo: number;
  wpm: number;
  accuracy: number;
  specialCharge: number;
  difficulty: 'easy' | 'medium' | 'hard';
  onPauseToggle: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  hp,
  maxHp,
  wave,
  totalWaves,
  score,
  combo,
  wpm,
  accuracy,
  specialCharge,
  difficulty,
  onPauseToggle,
}) => {
  const hpPercent = Math.max(0, (hp / maxHp) * 100);
  const isHpLow = hpPercent < 30;

  return (
    <div className="hud-overlay">
      {/* Top HUD Bar */}
      <div className="hud-top">
        {/* HP Bar */}
        <div className="hud-group hp-group">
          <div className="hud-label">
            <span>VITALITY</span>
            <span className="value-digits">{hp}/{maxHp}</span>
          </div>
          <div className={`hud-bar-container hp-bar-bg ${isHpLow ? 'alert-flash' : ''}`}>
            <div 
              className={`hud-bar-fill hp-bar-fill ${isHpLow ? 'critical' : ''}`}
              style={{ width: `${hpPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Level / Wave Tracker */}
        <div className="hud-group wave-group">
          <div className="hud-big-label">WAVE</div>
          <div className="hud-big-value">
            {wave > totalWaves ? 'BOSS' : `${wave} / ${totalWaves}`}
          </div>
          <div className="hud-sub-label difficulty-label">{difficulty.toUpperCase()}</div>
        </div>

        {/* Score & Combo */}
        <div className="hud-group score-group">
          <div className="hud-label">SCORE</div>
          <div className="hud-score-value">{score.toLocaleString()}</div>
          {combo > 1 && (
            <div className="hud-combo-badge animate-scale-up">
              COMBO <span className="combo-x">×{combo}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom HUD Bar */}
      <div className="hud-bottom">
        {/* Speed Stats (WPM) */}
        <div className="hud-stat-box">
          <div className="hud-stat-label">SPEED</div>
          <div className="hud-stat-value">
            {Math.round(wpm)} <span className="hud-stat-unit">WPM</span>
          </div>
        </div>

        {/* Accuracy Stats */}
        <div className="hud-stat-box">
          <div className="hud-stat-label">ACCURACY</div>
          <div className="hud-stat-value">
            {Math.round(accuracy)}<span className="hud-stat-unit">%</span>
          </div>
        </div>

        {/* Special Energy Meter */}
        <div className="hud-stat-box special-box">
          <div className="hud-stat-label">
            <span>SPECIAL CHARGE</span>
            {specialCharge >= 100 && <span className="ready-text animate-pulse">READY [SHIFT]</span>}
          </div>
          <div className="hud-bar-container special-bar-bg">
            <div 
              className={`hud-bar-fill special-bar-fill ${specialCharge >= 100 ? 'charged' : ''}`}
              style={{ width: `${specialCharge}%` }}
            ></div>
          </div>
        </div>

        {/* Menu button */}
        <button className="hud-pause-btn" onClick={onPauseToggle}>
          ⏸ SYSTEM PAUSE
        </button>
      </div>
    </div>
  );
};
