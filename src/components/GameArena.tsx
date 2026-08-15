import React, { useEffect, useRef, useState } from 'react';
import { audio } from '../utils/audio';
import wordsData from '../data/words.json';
import enemiesData from '../data/enemies.json';
import { HUD } from './HUD';

interface GameArenaProps {
  difficulty: 'easy' | 'medium' | 'hard';
  onGameOver: (score: number, wpm: number, accuracy: number, waveReached: number) => void;
  onVictory: (score: number, wpm: number, accuracy: number) => void;
  onPauseToggle: () => void;
  isPaused: boolean;
}

// Entity types
interface Enemy {
  id: number;
  type: 'basic' | 'fast' | 'heavy' | 'boss';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  color: string;
  size: number;
  points: number;
  word: string;
  typedIndex: number;
  state: 'chase' | 'attack' | 'hit' | 'dead';
  stateTimer: number;
  direction: number;
  animTime: number;
  lastAttackTime: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  scale: number;
  vy: number;
}

export const GameArena: React.FC<GameArenaProps> = ({
  difficulty,
  onGameOver,
  onVictory,
  onPauseToggle,
  isPaused,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Gameplay core stats in React refs to avoid closure re-binding in the animation loop
  const gameState = useRef({
    player: {
      x: 500,
      y: 400,
      vx: 0,
      vy: 0,
      hp: 100,
      maxHp: 100,
      state: 'idle' as 'idle' | 'run' | 'jump' | 'attack_punch' | 'attack_kick' | 'attack_heavy' | 'attack_special' | 'hurt' | 'dead',
      stateTime: 0,
      direction: 1, // 1 for Right, -1 for Left
      visualXOffset: 0,
      animTime: 0,
      isGrounded: true,
    },
    enemies: [] as Enemy[],
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],
    score: 0,
    combo: 0,
    specialCharge: 0,
    
    // Stats for calculations
    totalTyped: 0,
    correctTyped: 0,
    mistakes: 0,
    startTime: 0,
    elapsedTime: 0, // in ms
    
    // Spawning and Waves
    currentWave: 1,
    totalWaves: 4,
    enemiesSpawnQueue: [] as string[],
    enemiesDefeatedCount: 0,
    enemiesSpawnedCount: 0,
    lastSpawnTime: 0,
    waveCompletedTimer: 0,
    
    // Mechanics
    targetedEnemyId: null as number | null,
    heavySweepCooldown: 0, // in ms
    specialAttackTimer: 0, // in ms (screen flash effect duration)
    screenShake: 0,
    
    // Grid scrolling offset
    gridScrollX: 0,
    
    // Running flag
    isPlaying: true,
  });

  // Keep track of keys pressed (for simultaneous movement and jumping)
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // Trigger state update to HUD in React
  const [hudStats, setHudStats] = useState({
    hp: 100,
    maxHp: 100,
    wave: 1,
    totalWaves: 4,
    score: 0,
    combo: 0,
    wpm: 0,
    accuracy: 100,
    specialCharge: 0,
  });

  // Calculate difficulty multipliers
  const getDifficultyMultiplier = () => {
    switch (difficulty) {
      case 'easy': return 0.8;
      case 'hard': return 1.4;
      case 'medium':
      default: return 1.0;
    }
  };

  // Get active word pool filtered by words already on screen to prevent duplicates
  const getWordForEnemy = (type: string) => {
    const activeWords = new Set(gameState.current.enemies.map(e => e.word.toLowerCase()));
    let category: 'easy' | 'medium' | 'hard' | 'boss' = 'easy';

    if (type === 'fast') {
      category = 'easy'; // Fast enemies have short words to type quickly
    } else if (type === 'basic') {
      category = difficulty === 'hard' ? 'medium' : 'easy';
    } else if (type === 'heavy') {
      category = difficulty === 'easy' ? 'medium' : 'hard';
    } else if (type === 'boss') {
      category = 'boss';
    }

    const wordPool = wordsData[category].filter(w => !activeWords.has(w.toLowerCase()));
    
    // If we ran out of unique words, just fallback to full category pool
    const pool = wordPool.length > 0 ? wordPool : wordsData[category];
    return pool[Math.floor(Math.random() * pool.length)];
  };

  // Setup wave spawning queue
  const initWave = (waveNum: number) => {
    const state = gameState.current;
    state.currentWave = waveNum;
    state.enemiesSpawnedCount = 0;
    state.enemiesDefeatedCount = 0;
    state.targetedEnemyId = null;

    let queue: string[] = [];
    if (waveNum === 1) {
      queue = ['basic', 'basic', 'basic'];
    } else if (waveNum === 2) {
      queue = ['basic', 'fast', 'basic', 'fast', 'basic'];
    } else if (waveNum === 3) {
      queue = ['heavy', 'fast', 'basic', 'heavy', 'fast', 'basic'];
    } else if (waveNum === 4) {
      queue = ['boss'];
    }

    state.enemiesSpawnQueue = queue;
    state.lastSpawnTime = Date.now();
    state.waveCompletedTimer = 0;
    
    // Play wave start audio
    audio.playWaveComplete();

    // Floating wave announcement
    state.floatingTexts.push({
      x: 500,
      y: 200,
      text: waveNum === 4 ? 'BOSS WAVE DETECTED!' : `WAVE ${waveNum} INITIALIZED`,
      color: waveNum === 4 ? '#ffd700' : '#39ff14',
      alpha: 1,
      scale: 2.0,
      vy: -0.5,
    });
  };

  // Spawn an enemy from queue
  const spawnEnemy = () => {
    const state = gameState.current;
    if (state.enemiesSpawnQueue.length === 0) return;

    const type = state.enemiesSpawnQueue.shift() as 'basic' | 'fast' | 'heavy' | 'boss';
    const config = enemiesData[type];
    const side = Math.random() < 0.5 ? -1 : 1; // Left (-1) or Right (1)
    const x = side === -1 ? -50 : 1050;
    
    const diffMult = getDifficultyMultiplier();
    
    const newEnemy: Enemy = {
      id: Math.random(),
      type,
      x,
      y: 400,
      hp: Math.round(config.hp * diffMult),
      maxHp: Math.round(config.hp * diffMult),
      speed: config.speed * (0.9 + Math.random() * 0.2) * (difficulty === 'hard' ? 1.2 : 0.9),
      damage: Math.round(config.damage * diffMult),
      color: config.color,
      size: config.size,
      points: config.points,
      word: getWordForEnemy(type),
      typedIndex: 0,
      state: 'chase',
      stateTimer: 0,
      direction: side === -1 ? 1 : -1,
      animTime: Math.random() * 10,
      lastAttackTime: 0,
    };

    state.enemies.push(newEnemy);
    state.enemiesSpawnedCount++;
    state.lastSpawnTime = Date.now();
  };

  // Trigger floating text popup
  const addFloatingText = (x: number, y: number, text: string, color: string, scale: number = 1.0) => {
    gameState.current.floatingTexts.push({
      x,
      y,
      text,
      color,
      alpha: 1.0,
      scale,
      vy: -1.5 - Math.random() * 1.5,
    });
  };

  // Trigger blood/impact sparks
  const createSparks = (x: number, y: number, color: string, count: number = 10) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      gameState.current.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (1 + Math.random() * 2), // tend upward
        color,
        size: 2 + Math.random() * 4,
        alpha: 1.0,
        life: 0,
        maxLife: 20 + Math.random() * 30,
      });
    }
  };

  // Setup game
  useEffect(() => {
    const state = gameState.current;
    state.startTime = Date.now();
    state.score = 0;
    state.combo = 0;
    state.specialCharge = 0;
    state.player.hp = 100;
    state.player.x = 500;
    state.enemies = [];
    state.particles = [];
    state.floatingTexts = [];
    state.totalTyped = 0;
    state.correctTyped = 0;
    state.mistakes = 0;
    state.isPlaying = true;

    initWave(1);

    // Resize canvas
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (parent) {
        // We maintain an aspect ratio of 2:1 roughly (1000 x 480)
        canvas.width = 1000;
        canvas.height = 480;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [difficulty]);

  // Handle keyboard events (Typing & Movement)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPaused || !gameState.current.isPlaying) return;

      const state = gameState.current;
      const key = e.key;

      // Track movement keys in physical keyboard state map
      if (key === 'a' || key === 'A' || key === 'ArrowLeft') {
        keysPressed.current['left'] = true;
        return;
      }
      if (key === 'd' || key === 'D' || key === 'ArrowRight') {
        keysPressed.current['right'] = true;
        return;
      }
      if (key === ' ' || key === 'ArrowUp') {
        keysPressed.current['jump'] = true;
        e.preventDefault(); // prevent scroll
        return;
      }

      // Special screen clearing attack
      if (key === 'Shift') {
        if (state.specialCharge >= 100) {
          triggerSpecialAttack();
        } else {
          audio.playKey(true);
        }
        return;
      }

      // Heavy melee kick sweep (Enter)
      if (key === 'Enter') {
        triggerHeavySweep();
        return;
      }

      // Prevent processing characters if holding helper keys
      if (e.ctrlKey || e.altKey || e.metaKey || key.length > 1) {
        return;
      }

      // Core typing mechanic
      processTypedCharacter(key);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key;
      if (key === 'a' || key === 'A' || key === 'ArrowLeft') {
        keysPressed.current['left'] = false;
      }
      if (key === 'd' || key === 'D' || key === 'ArrowRight') {
        keysPressed.current['right'] = false;
      }
      if (key === ' ' || key === 'ArrowUp') {
        keysPressed.current['jump'] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPaused]);

  // Special attack mechanics
  const triggerSpecialAttack = () => {
    const state = gameState.current;
    state.specialCharge = 0;
    state.specialAttackTimer = 600; // 600ms screen flash
    state.screenShake = 25;
    state.player.state = 'attack_special';
    state.player.stateTime = 0;
    
    audio.playAttack('special');
    addFloatingText(state.player.x, state.player.y - 80, 'KEYBOARD STORM!', '#ffff00', 2.0);

    // Damage all active enemies
    state.enemies.forEach(enemy => {
      if (enemy.state !== 'dead') {
        const damageAmount = 250;
        enemy.hp = Math.max(0, enemy.hp - damageAmount);
        enemy.state = 'hit';
        enemy.stateTimer = 0;
        
        createSparks(enemy.x, enemy.y - 30, enemy.color, 15);
        addFloatingText(enemy.x, enemy.y - 70, `-${damageAmount}`, '#ffffff', 1.2);

        if (enemy.hp <= 0) {
          enemy.state = 'dead';
          enemy.stateTimer = 0;
          state.enemiesDefeatedCount++;
          state.score += enemy.points;
          createSparks(enemy.x, enemy.y - 30, '#ffd700', 25);
        }
      }
    });

    // Clear target just in case
    state.targetedEnemyId = null;
  };

  // Heavy manual sweep sweep kick
  const triggerHeavySweep = () => {
    const state = gameState.current;
    if (state.heavySweepCooldown > 0) {
      audio.playKey(true);
      return;
    }

    state.heavySweepCooldown = 1500; // 1.5s cooldown
    state.player.state = 'attack_heavy';
    state.player.stateTime = 0;
    state.screenShake = 10;
    
    audio.playAttack('heavy');
    addFloatingText(state.player.x, state.player.y - 80, 'HEAVY SWEEP!', '#c084fc', 1.5);

    // Hit nearby enemies (within 180px horizontally)
    state.enemies.forEach(enemy => {
      if (enemy.state !== 'dead') {
        const dist = Math.abs(enemy.x - state.player.x);
        if (dist < 180) {
          const dmg = 40;
          enemy.hp = Math.max(0, enemy.hp - dmg);
          
          // Knockback
          const knockDir = enemy.x > state.player.x ? 1 : -1;
          enemy.x += knockDir * 80;
          enemy.state = 'hit';
          enemy.stateTimer = 0;
          
          createSparks(enemy.x, enemy.y - 30, enemy.color, 10);
          addFloatingText(enemy.x, enemy.y - 70, `-${dmg}`, '#c084fc', 1.1);

          if (enemy.hp <= 0) {
            enemy.state = 'dead';
            enemy.stateTimer = 0;
            state.enemiesDefeatedCount++;
            state.score += enemy.points;
            createSparks(enemy.x, enemy.y - 30, '#ffd700', 20);
            if (state.targetedEnemyId === enemy.id) state.targetedEnemyId = null;
          }
        }
      }
    });
  };

  // Process a normal typed character
  const processTypedCharacter = (char: string) => {
    const state = gameState.current;
    state.totalTyped++;

    // 1. If we currently have an active target locked
    if (state.targetedEnemyId !== null) {
      const enemy = state.enemies.find(e => e.id === state.targetedEnemyId && e.state !== 'dead');
      
      if (enemy) {
        const expectedChar = enemy.word[enemy.typedIndex].toLowerCase();
        
        if (char.toLowerCase() === expectedChar) {
          // Success type!
          enemy.typedIndex++;
          state.correctTyped++;
          state.combo++;
          
          // Play key hit audio
          audio.playKey(false);
          
          // Player slide-to-attack logic
          state.player.direction = enemy.x > state.player.x ? 1 : -1;
          const slideDist = (enemy.x - state.player.x);
          // Set visual offset so player dashes in direction of hit
          state.player.visualXOffset = slideDist * 0.6;
          
          // Play attack punch or kick pose
          state.player.state = Math.random() < 0.5 ? 'attack_punch' : 'attack_kick';
          state.player.stateTime = 0;

          // Apply fractional damage
          const dmgPerKey = Math.ceil(enemy.maxHp / enemy.word.length);
          enemy.hp = Math.max(0, enemy.hp - dmgPerKey);
          
          // Sparks and floating text
          createSparks(enemy.x, enemy.y - 30, enemy.color, 4);
          
          // If word finished, destroy enemy
          if (enemy.typedIndex >= enemy.word.length) {
            enemy.hp = 0;
            enemy.state = 'dead';
            enemy.stateTimer = 0;
            state.enemiesDefeatedCount++;
            
            // Score with combo multiplier
            const comboMult = Math.min(5, 1 + Math.floor(state.combo / 5));
            const basePoints = enemy.points;
            const finalPoints = basePoints * comboMult;
            state.score += finalPoints;

            // Charge special meter
            state.specialCharge = Math.min(100, state.specialCharge + 15);
            
            audio.playAttack('weak');
            state.screenShake = 6;
            
            // Disintegrate explosion sparks
            createSparks(enemy.x, enemy.y - 30, '#ffffff', 18);
            addFloatingText(enemy.x, enemy.y - 70, `+${finalPoints}`, '#ffeb3b', 1.3);
            
            if (comboMult > 1) {
              addFloatingText(enemy.x, enemy.y - 95, `COMBO ×${comboMult}!`, '#00e5ff', 0.9);
            }

            state.targetedEnemyId = null; // release lock
          }
        } else {
          // Mistake typed on locked target
          triggerMistake();
        }
      } else {
        // Enemy died from other cause (like special sweep)
        state.targetedEnemyId = null;
        processTypedCharacter(char); // re-route typing
      }
    } else {
      // 2. No target locked. Search if typed key matches first letter of any active enemy word
      const candidates = state.enemies.filter(
        e => e.state !== 'dead' && e.word[0].toLowerCase() === char.toLowerCase()
      );

      if (candidates.length > 0) {
        // Pick the closest enemy to the player
        let closestEnemy = candidates[0];
        let minDist = Math.abs(closestEnemy.x - state.player.x);
        
        for (let i = 1; i < candidates.length; i++) {
          const dist = Math.abs(candidates[i].x - state.player.x);
          if (dist < minDist) {
            minDist = dist;
            closestEnemy = candidates[i];
          }
        }

        // Lock onto closest candidate
        state.targetedEnemyId = closestEnemy.id;
        closestEnemy.typedIndex = 1;
        state.correctTyped++;
        state.combo++;
        
        audio.playKey(false);
        
        // Attack visual feedback
        state.player.direction = closestEnemy.x > state.player.x ? 1 : -1;
        state.player.visualXOffset = (closestEnemy.x - state.player.x) * 0.6;
        state.player.state = 'attack_punch';
        state.player.stateTime = 0;
        
        const dmgPerKey = Math.ceil(closestEnemy.maxHp / closestEnemy.word.length);
        closestEnemy.hp = Math.max(0, closestEnemy.hp - dmgPerKey);
        createSparks(closestEnemy.x, closestEnemy.y - 30, closestEnemy.color, 4);

        // Edge case: word length 1
        if (closestEnemy.typedIndex >= closestEnemy.word.length) {
          closestEnemy.hp = 0;
          closestEnemy.state = 'dead';
          closestEnemy.stateTimer = 0;
          state.enemiesDefeatedCount++;
          state.score += closestEnemy.points;
          state.specialCharge = Math.min(100, state.specialCharge + 15);
          
          audio.playAttack('weak');
          createSparks(closestEnemy.x, closestEnemy.y - 30, '#ffffff', 18);
          addFloatingText(closestEnemy.x, closestEnemy.y - 70, `+${closestEnemy.points}`, '#ffeb3b', 1.2);
          state.targetedEnemyId = null;
        }
      } else {
        // No enemy starts with this letter
        triggerMistake();
      }
    }
  };

  const triggerMistake = () => {
    const state = gameState.current;
    state.mistakes++;
    state.combo = 0;
    audio.playKey(true);
    addFloatingText(state.player.x, state.player.y - 110, 'MISS!', '#ff4f4f', 1.0);
  };

  // Game loop updater & renderer
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const gameLoop = (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(gameLoop);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(gameLoop);
        return;
      }

      let dt = (time - lastTime) / 1000;
      if (dt > 0.1) dt = 0.1; // clamp lag spikes
      lastTime = time;

      if (!isPaused && gameState.current.isPlaying) {
        updateGame(dt);
      }
      
      renderGame(ctx, canvas.width, canvas.height);
      updateHUD();

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPaused]);

  // Update Game Logic
  const updateGame = (dt: number) => {
    const state = gameState.current;
    const player = state.player;

    // 1. Cooldown tickers
    if (state.heavySweepCooldown > 0) state.heavySweepCooldown -= dt * 1000;
    if (state.specialAttackTimer > 0) state.specialAttackTimer -= dt * 1000;

    // 2. Player Input Physics
    let isMoving = false;
    const runSpeed = 220; // pixels per second
    
    if (keysPressed.current['left']) {
      player.vx = -runSpeed;
      player.direction = -1;
      isMoving = true;
    } else if (keysPressed.current['right']) {
      player.vx = runSpeed;
      player.direction = 1;
      isMoving = true;
    } else {
      player.vx = 0;
    }

    if (keysPressed.current['jump'] && player.isGrounded) {
      player.vy = -380; // initial jump velocity
      player.isGrounded = false;
      player.state = 'jump';
      audio.playKey(false);
    }

    // Apply gravity
    if (!player.isGrounded) {
      player.vy += 800 * dt; // gravity force
      player.y += player.vy * dt;
      
      // Ground check
      if (player.y >= 400) {
        player.y = 400;
        player.vy = 0;
        player.isGrounded = true;
        player.state = 'idle';
      }
    }

    // Apply horizontal speed
    player.x += player.vx * dt;
    
    // Bounds check
    if (player.x < 100) player.x = 100;
    if (player.x > 900) player.x = 900;

    // Scrolling floor and background grid
    state.gridScrollX -= player.vx * dt * 0.5;

    // 3. Player animation transitions
    player.animTime += dt;
    if (player.isGrounded) {
      if (player.state === 'idle' || player.state === 'run' || player.state === 'jump') {
        player.state = isMoving ? 'run' : 'idle';
      } else {
        // Custom combat pose time out
        player.stateTime += dt;
        if (player.stateTime > 0.16) {
          player.state = isMoving ? 'run' : 'idle';
          player.stateTime = 0;
        }
      }
    } else {
      if (player.state !== 'attack_punch' && player.state !== 'attack_kick') {
        player.state = 'jump';
      } else {
        player.stateTime += dt;
        if (player.stateTime > 0.16) {
          player.state = 'jump';
          player.stateTime = 0;
        }
      }
    }

    // Decentering dash attack visual snap-back
    player.visualXOffset *= Math.exp(-15 * dt);

    // 4. Update enemies AI and positions
    state.enemies.forEach(enemy => {
      enemy.animTime += dt;

      if (enemy.state === 'dead') {
        enemy.stateTimer += dt;
        return;
      }

      // Face player
      enemy.direction = player.x > enemy.x ? 1 : -1;

      const dist = Math.abs(player.x - enemy.x);
      
      if (enemy.state === 'hit') {
        enemy.stateTimer += dt;
        // Stun duration 0.25s
        if (enemy.stateTimer > 0.25) {
          enemy.state = 'chase';
        }
      } else if (enemy.state === 'attack') {
        enemy.stateTimer += dt;
        if (enemy.stateTimer > 0.4) {
          enemy.state = 'chase';
        }
      } else {
        // Chase state
        if (dist > 65) {
          // Move towards player
          const step = enemy.speed * runSpeed * 0.45 * dt * enemy.direction;
          enemy.x += step;
        } else {
          // In range to attack player!
          const now = Date.now();
          if (now - enemy.lastAttackTime > 2000) {
            enemy.state = 'attack';
            enemy.stateTimer = 0;
            enemy.lastAttackTime = now;

            // Damage player
            player.hp = Math.max(0, player.hp - enemy.damage);
            player.state = 'hurt';
            player.stateTime = 0;
            
            // Screen shake & flash
            state.screenShake = 12;
            audio.playHurt();
            createSparks(player.x, player.y - 30, '#ff0000', 8);
            addFloatingText(player.x, player.y - 70, `-${enemy.damage} HP`, '#ff4f4f', 1.2);
            
            // Reset combo on hit
            state.combo = 0;

            // Game over check
            if (player.hp <= 0) {
              player.state = 'dead';
              state.isPlaying = false;
              setTimeout(() => {
                onGameOver(state.score, calculateWPM(), calculateAccuracy(), state.currentWave);
              }, 1500);
            }
          }
        }
      }
    });

    // Remove dead enemies after fade/disintegrate
    state.enemies = state.enemies.filter(e => !(e.state === 'dead' && e.stateTimer > 0.6));

    // 5. Update wave spawning
    const activeEnemies = state.enemies.filter(e => e.state !== 'dead').length;
    const timeSinceLastSpawn = Date.now() - state.lastSpawnTime;

    if (
      state.enemiesSpawnQueue.length > 0 && 
      activeEnemies < 3 && 
      timeSinceLastSpawn > 2500 / getDifficultyMultiplier()
    ) {
      spawnEnemy();
    }

    // Check if current wave completed
    if (state.enemiesSpawnQueue.length === 0 && state.enemies.length === 0) {
      if (state.waveCompletedTimer === 0) {
        state.waveCompletedTimer = Date.now();
      } else if (Date.now() - state.waveCompletedTimer > 1800) {
        // Next wave or victory!
        if (state.currentWave < state.totalWaves) {
          initWave(state.currentWave + 1);
        } else {
          // Victory!
          state.isPlaying = false;
          setTimeout(() => {
            onVictory(state.score, calculateWPM(), calculateAccuracy());
          }, 1500);
        }
      }
    }

    // 6. Update particles
    state.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life++;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
    });
    state.particles = state.particles.filter(p => p.life < p.maxLife);

    // 7. Update floating texts
    state.floatingTexts.forEach(ft => {
      ft.y += ft.vy;
      ft.alpha -= dt * 1.5;
    });
    state.floatingTexts = state.floatingTexts.filter(ft => ft.alpha > 0);

    // 8. Screen shake decay
    if (state.screenShake > 0) {
      state.screenShake *= 0.9;
      if (state.screenShake < 0.2) state.screenShake = 0;
    }
  };

  // Math WPM
  const calculateWPM = () => {
    const state = gameState.current;
    const elapsedMins = (Date.now() - state.startTime) / 60000;
    if (elapsedMins === 0) return 0;
    return (state.correctTyped / 5) / elapsedMins;
  };

  // Math Accuracy
  const calculateAccuracy = () => {
    const state = gameState.current;
    if (state.totalTyped === 0) return 100;
    return (state.correctTyped / state.totalTyped) * 100;
  };

  // Send updates to React HUD
  const updateHUD = () => {
    const state = gameState.current;
    setHudStats({
      hp: state.player.hp,
      maxHp: state.player.maxHp,
      wave: state.currentWave,
      totalWaves: state.totalWaves,
      score: state.score,
      combo: state.combo,
      wpm: calculateWPM(),
      accuracy: calculateAccuracy(),
      specialCharge: state.specialCharge,
    });
  };

  // Canvas Drawing
  const renderGame = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const state = gameState.current;

    // Apply Screen Shake
    ctx.save();
    if (state.screenShake > 0) {
      const dx = (Math.random() - 0.5) * state.screenShake;
      const dy = (Math.random() - 0.5) * state.screenShake;
      ctx.translate(dx, dy);
    }

    // 1. Clear Screen with deep retro background
    ctx.fillStyle = '#0b0c10';
    ctx.fillRect(0, 0, width, height);

    // 2. Draw cyber horizon skyline parallax
    drawSkyline(ctx, width, height, state.gridScrollX * 0.1);

    // 3. Draw neon grid floor
    drawFloorGrid(ctx, width, height, state.gridScrollX);

    // 4. Draw enemies
    state.enemies.forEach(enemy => {
      // Draw death dissolve effect or normal neon stickman
      const opacity = enemy.state === 'dead' ? Math.max(0, 1 - enemy.stateTimer / 0.6) : 1.0;
      ctx.globalAlpha = opacity;
      
      let pose = enemy.state === 'hit' ? 'hurt' : enemy.state === 'dead' ? 'dead' : 'run';
      if (enemy.state === 'attack') pose = 'punch';

      drawStickman(
        ctx, 
        enemy.x, 
        enemy.y, 
        pose, 
        enemy.animTime, 
        enemy.direction, 
        enemy.color, 
        enemy.size
      );

      // Draw HP Bar & Word above enemy
      if (enemy.state !== 'dead') {
        drawEnemyOverlays(ctx, enemy, state.targetedEnemyId === enemy.id);
      }
    });
    ctx.globalAlpha = 1.0;

    // 5. Draw player
    const player = state.player;
    drawStickman(
      ctx,
      player.x + player.visualXOffset,
      player.y,
      player.state,
      player.animTime,
      player.direction,
      '#00e5ff', // Neon Cyan
      1.1
    );

    // 6. Draw particles
    state.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 7. Draw floating texts
    state.floatingTexts.forEach(ft => {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.fillStyle = ft.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = ft.color;
      ctx.font = `bold ${Math.round(18 * ft.scale)}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    // 8. Special attack flash effect
    if (state.specialAttackTimer > 0) {
      const alpha = state.specialAttackTimer / 600;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.45})`;
      ctx.fillRect(0, 0, width, height);

      // Draw lightning bolt lines procedurally
      ctx.strokeStyle = '#ffffff';
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 20;
      ctx.lineWidth = 5;
      
      state.enemies.forEach(enemy => {
        ctx.beginPath();
        let currX = enemy.x + (Math.random() - 0.5) * 50;
        let currY = 0;
        ctx.moveTo(currX, currY);
        while (currY < enemy.y - 20) {
          currY += 40 + Math.random() * 40;
          currX += (Math.random() - 0.5) * 35;
          ctx.lineTo(currX, currY);
        }
        ctx.stroke();
      });
    }

    ctx.restore(); // Restore screen shake offsets
  };

  // Parallax backdrop
  const drawSkyline = (ctx: CanvasRenderingContext2D, width: number, height: number, scrollOffset: number) => {
    ctx.save();
    ctx.fillStyle = '#11121d';
    // Modulo scrolling offset to loop buildings infinitely
    const loopW = 240;
    const startX = (scrollOffset % loopW) - loopW;

    ctx.beginPath();
    for (let x = startX; x < width + loopW; x += loopW) {
      ctx.fillRect(x, 150, 80, height - 150);
      ctx.fillRect(x + 100, 200, 110, height - 200);
      ctx.fillRect(x + 60, 280, 50, height - 280);
      
      // glowing windows
      ctx.fillStyle = 'rgba(192, 132, 252, 0.1)';
      ctx.fillRect(x + 15, 170, 10, 20);
      ctx.fillRect(x + 15, 200, 10, 20);
      ctx.fillRect(x + 55, 170, 10, 20);
      ctx.fillRect(x + 120, 220, 15, 15);
      ctx.fillRect(x + 150, 220, 15, 15);
      ctx.fillStyle = '#11121d'; // restore
    }
    ctx.restore();
  };

  // Futuristic scrolling grid floor
  const drawFloorGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, scrollOffset: number) => {
    const horizon = 380;
    
    // Draw horizon dividing glow line
    ctx.strokeStyle = '#c084fc';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#c084fc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(width, horizon);
    ctx.stroke();

    // Solid floor background
    ctx.fillStyle = '#06070a';
    ctx.fillRect(0, horizon, width, height - horizon);

    // Draw grid horizontal lines (perspective lines)
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.2)';
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1;
    
    const linesCount = 8;
    for (let i = 0; i < linesCount; i++) {
      const y = horizon + (height - horizon) * Math.pow(i / linesCount, 2.0);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Perspective columns moving outwards
    const gridSpacing = 80;
    const modScroll = scrollOffset % gridSpacing;
    const centerX = width / 2;

    for (let x = -width; x < width * 2; x += gridSpacing) {
      const floorX = x + modScroll;
      ctx.beginPath();
      ctx.moveTo(centerX + (floorX - centerX) * 0.1, horizon);
      ctx.lineTo(floorX, height);
      ctx.stroke();
    }
  };

  // Draw overlay labels for active target, health, and spelling
  const drawEnemyOverlays = (ctx: CanvasRenderingContext2D, enemy: Enemy, isTargeted: boolean) => {
    const sizeOffset = enemy.size * 60;
    const yTop = enemy.y - sizeOffset;

    // 1. Draw mini Health Bar
    const hpPct = enemy.hp / enemy.maxHp;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(enemy.x - 30, yTop - 12, 60, 4);
    ctx.fillStyle = enemy.color;
    ctx.fillRect(enemy.x - 30, yTop - 12, 60 * hpPct, 4);

    // 2. Render spelling text floating above
    const word = enemy.word;
    const typedIdx = enemy.typedIndex;
    const typedText = word.substring(0, typedIdx);
    const untypedText = word.substring(typedIdx);

    ctx.font = `bold ${isTargeted ? '19' : '15'}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    
    // Width of strings to align side by side
    const typedW = ctx.measureText(typedText).width;
    const untypedW = ctx.measureText(untypedText).width;
    const totalW = typedW + untypedW;

    const textX = enemy.x;
    const textY = yTop - 22;

    // Draw active target neon highlighting box
    if (isTargeted) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 229, 255, 0.12)';
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#00e5ff';
      ctx.beginPath();
      // Draw rectangular border around text
      ctx.roundRect(textX - totalW / 2 - 8, textY - 18, totalW + 16, 26, 4);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Render characters
    ctx.save();
    ctx.shadowBlur = isTargeted ? 12 : 5;
    ctx.textAlign = 'left';
    
    // Draw typed part (Cyan/Green if targeted, grey otherwise)
    ctx.fillStyle = isTargeted ? '#00e5ff' : '#aaaaaa';
    ctx.shadowColor = isTargeted ? '#00e5ff' : 'transparent';
    ctx.fillText(typedText, textX - totalW / 2, textY);
    
    // Draw untyped part (White)
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.fillText(untypedText, textX - totalW / 2 + typedW, textY);
    ctx.restore();
  };

  // Procedural Glowing Stickman Generator
  const drawStickman = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    state: string,
    animTime: number,
    direction: number,
    color: string,
    scale: number
  ) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(direction * scale, scale);

    // Neon Style
    ctx.strokeStyle = color;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;

    // Joints coords relative to pelvis (0, -25)
    let px = 0, py = -25;
    let hx = 0, hy = -62;
    let nx = 0, ny = -50;
    
    let ls = { x: -10, y: -46 }, rs = { x: 10, y: -46 };
    let le = { x: -18, y: -34 }, re = { x: 18, y: -34 };
    let lh = { x: -22, y: -22 }, rh = { x: 22, y: -22 };

    let lhp = { x: -6, y: -24 }, rhp = { x: 6, y: -24 };
    let lk = { x: -12, y: -12 }, rk = { x: 12, y: -12 };
    let lf = { x: -15, y: 0 }, rf = { x: 15, y: 0 };

    if (state === 'idle') {
      const breath = Math.sin(animTime * 4.5) * 1.5;
      py += breath;
      hy += breath * 1.2;
      ny += breath * 1.1;
      
      ls.y += breath; rs.y += breath;
      le.y += breath * 0.8; re.y += breath * 0.8;
      
      // Hands resting guard
      le = { x: -14, y: -38 };
      re = { x: 14, y: -38 };
      lh = { x: -10, y: -48 };
      rh = { x: 10, y: -48 };
    } 
    else if (state === 'run') {
      const cycle = animTime * 11;
      const bob = Math.abs(Math.sin(cycle)) * 3;
      
      py += bob;
      hy += bob;
      ny += bob;
      ls.y += bob; rs.y += bob;

      // Elliptical leg cycle
      lk.x = -8 + Math.sin(cycle) * 8;
      lk.y = -10 + Math.cos(cycle) * 3;
      lf.x = -12 + Math.sin(cycle) * 15;
      lf.y = Math.max(0, Math.cos(cycle) * 10);

      rk.x = 8 + Math.sin(cycle + Math.PI) * 8;
      rk.y = -10 + Math.cos(cycle + Math.PI) * 3;
      rf.x = 12 + Math.sin(cycle + Math.PI) * 15;
      rf.y = Math.max(0, Math.cos(cycle + Math.PI) * 10);

      // Swing arms
      le.x = -10 + Math.cos(cycle) * 6;
      re.x = 10 + Math.cos(cycle + Math.PI) * 6;
      lh.x = -12 + Math.cos(cycle) * 10;
      rh.x = 12 + Math.cos(cycle + Math.PI) * 10;
      lh.y = -35;
      rh.y = -35;
    } 
    else if (state === 'jump') {
      py = -32;
      hy = -67;
      ny = -55;

      // Legs bent up
      lk = { x: -12, y: -20 };
      lf = { x: -8, y: -10 };
      rk = { x: 8, y: -18 };
      rf = { x: 6, y: -8 };

      // Hands raised high
      le = { x: -18, y: -65 };
      re = { x: 18, y: -65 };
      lh = { x: -24, y: -78 };
      rh = { x: 24, y: -78 };
    } 
    else if (state === 'attack_punch') {
      // Rapid jab forward
      const progress = Math.min(1, animTime * 6.5);
      const extend = progress < 0.5 ? progress * 2 : (1 - progress) * 2; // out & back
      
      hx += 5 * extend;
      ny += 3 * extend;

      // Right arm punches forward
      re = { x: 18 + 15 * extend, y: -45 };
      rh = { x: 22 + 28 * extend, y: -46 };

      // Left arm guards face
      le = { x: -10, y: -38 };
      lh = { x: -5, y: -48 };

      // Wider leg stance
      lk = { x: -12, y: -10 }; lf = { x: -18, y: 0 };
      rk = { x: 10, y: -10 }; rf = { x: 22, y: 0 };
    } 
    else if (state === 'attack_kick') {
      // Snap kick forward
      const progress = Math.min(1, animTime * 6.5);
      const extend = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
      
      // Lean torso back
      hx -= 8 * extend;
      ny -= 5 * extend;
      py += 2 * extend;

      // Right leg kicks out!
      rk = { x: 16 * extend, y: -25 * extend };
      rf = { x: 38 * extend, y: -30 * extend };

      // Standing left leg bent
      lk = { x: -12, y: -8 };
      lf = { x: -16, y: 0 };

      // Hands guard chest
      le = { x: -8, y: -38 }; lh = { x: -2, y: -42 };
      re = { x: 8, y: -38 }; rh = { x: 2, y: -42 };
    } 
    else if (state === 'attack_heavy') {
      // 360 Spin sweeping leg
      const spin = animTime * Math.PI * 4;
      
      py = -16; // drop low
      hx = 0; hy = -53;
      
      // Sweep leg rotating around pelvic center
      lf = { x: Math.sin(spin) * 28, y: 0 };
      rf = { x: Math.sin(spin + Math.PI) * 28, y: 0 };
      
      // Arms out for balance
      lh = { x: -24, y: -38 };
      rh = { x: 24, y: -38 };
    } 
    else if (state === 'attack_special') {
      // Floating glowing summon pose
      const hover = Math.sin(animTime * 15) * 5;
      py = -40 + hover;
      hy = -75 + hover;
      ny = -63 + hover;

      // Limbs dangling down
      lk = { x: -6, y: -25 + hover }; lf = { x: -10, y: -10 + hover };
      rk = { x: 6, y: -25 + hover }; rf = { x: 10, y: -10 + hover };

      // Arms raised outwards
      le = { x: -25, y: -65 + hover }; lh = { x: -35, y: -80 + hover };
      re = { x: 25, y: -65 + hover }; rh = { x: 35, y: -80 + hover };
    } 
    else if (state === 'hurt') {
      // Reeling back
      px = -12; py = -20;
      hx = -22; hy = -55;
      ny = -17; ny = -43;

      le = { x: -15, y: -52 }; lh = { x: -18, y: -62 };
      re = { x: 8, y: -52 }; rh = { x: 12, y: -62 };

      // feet dangling
      lk = { x: -8, y: -10 }; lf = { x: -12, y: -2 };
      rk = { x: 6, y: -10 }; rf = { x: 10, y: -2 };
    } 
    else if (state === 'dead') {
      // Lying down flat
      px = 0; py = -3;
      hx = 30; hy = -3;
      ny = 18; ny = -3;

      ls = { x: 14, y: -3 }; rs = { x: 22, y: -3 };
      le = { x: 10, y: -3 }; re = { x: 26, y: -3 };
      lh = { x: 8, y: -3 }; rh = { x: 28, y: -3 };

      lhp = { x: -5, y: -3 }; rhp = { x: 5, y: -3 };
      lk = { x: -15, y: -3 }; rk = { x: -10, y: -3 };
      lf = { x: -25, y: -3 }; rf = { x: -20, y: -3 };
    }

    // --- DRAW SKELETON ---
    
    // Head circle
    ctx.beginPath();
    ctx.arc(hx, hy, 7.5, 0, Math.PI * 2);
    ctx.stroke();

    // Spine: head -> neck -> pelvis
    ctx.beginPath();
    ctx.moveTo(hx, hy + 7.5);
    ctx.lineTo(nx, ny);
    ctx.lineTo(px, py);
    ctx.stroke();

    // Left Arm: neck -> shoulder -> elbow -> hand
    ctx.beginPath();
    ctx.moveTo(nx, ny);
    ctx.lineTo(ls.x, ls.y);
    ctx.lineTo(le.x, le.y);
    ctx.lineTo(lh.x, lh.y);
    ctx.stroke();

    // Right Arm: neck -> shoulder -> elbow -> hand
    ctx.beginPath();
    ctx.moveTo(nx, ny);
    ctx.lineTo(rs.x, rs.y);
    ctx.lineTo(re.x, re.y);
    ctx.lineTo(rh.x, rh.y);
    ctx.stroke();

    // Left Leg: pelvis -> hip -> knee -> foot
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(lhp.x, lhp.y);
    ctx.lineTo(lk.x, lk.y);
    ctx.lineTo(lf.x, lf.y);
    ctx.stroke();

    // Right Leg: pelvis -> hip -> knee -> foot
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(rhp.x, rhp.y);
    ctx.lineTo(rk.x, rk.y);
    ctx.lineTo(rf.x, rf.y);
    ctx.stroke();

    ctx.restore();
  };

  return (
    <div className="game-arena-wrapper">
      <HUD
        hp={hudStats.hp}
        maxHp={hudStats.maxHp}
        wave={hudStats.wave}
        totalWaves={hudStats.totalWaves}
        score={hudStats.score}
        combo={hudStats.combo}
        wpm={hudStats.wpm}
        accuracy={hudStats.accuracy}
        specialCharge={hudStats.specialCharge}
        difficulty={difficulty}
        onPauseToggle={onPauseToggle}
      />
      <div className="canvas-container">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};
