class AudioSynth {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.error("Failed to initialize AudioContext", e);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  getMuted() {
    return this.isMuted;
  }

  private createNoiseBuffer(): AudioBuffer {
    if (!this.ctx) throw new Error("No context");
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  playKey(isError: boolean = false) {
    if (this.isMuted || !this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    
    if (isError) {
      // Low buzz sound
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.linearRampToValueAtTime(80, now + 0.15);
      
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.15);
    } else {
      // Keyboard mechanical click
      // We combine a short sine wave click with a tiny noise click
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      // Randomize mechanical click pitch slightly to feel organic
      const pitch = 800 + Math.random() * 400;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);
      
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.04);

      // Noise component
      try {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer();
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(2000, now);
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.03, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
        
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        
        noise.start(now);
        noise.stop(now + 0.02);
      } catch (e) {
        // Fallback if noise fails
      }
    }
  }

  playAttack(type: 'weak' | 'heavy' | 'special') {
    if (this.isMuted || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    const now = this.ctx.currentTime;
    
    if (type === 'weak') {
      // Whoosh + short impact punch
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
      
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
      
      // Noise burst for impact
      try {
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = this.createNoiseBuffer();
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(400, now);
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.12, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        
        noiseSource.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        
        noiseSource.start(now);
        noiseSource.stop(now + 0.05);
      } catch (e) {}
      
    } else if (type === 'heavy') {
      // Deep punch/kick impact
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.18);
      
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
      
      // Low noise thump
      try {
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = this.createNoiseBuffer();
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(150, now);
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.25, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        
        noiseSource.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        
        noiseSource.start(now);
        noiseSource.stop(now + 0.15);
      } catch (e) {}
      
    } else if (type === 'special') {
      // Cyber storm rising laser and explosion
      const duration = 0.8;
      
      // 1. Rising siren
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.exponentialRampToValueAtTime(1500, now + duration);
      
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.2, now + duration);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration + 0.05);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.05);
      
      // 2. Huge lightning blast at the end of the siren
      const blastTime = now + duration;
      const blastOsc = this.ctx.createOscillator();
      const blastGain = this.ctx.createGain();
      
      blastOsc.type = 'triangle';
      blastOsc.frequency.setValueAtTime(100, blastTime);
      blastOsc.frequency.linearRampToValueAtTime(30, blastTime + 0.5);
      
      blastGain.gain.setValueAtTime(0.5, blastTime);
      blastGain.gain.exponentialRampToValueAtTime(0.001, blastTime + 0.5);
      
      blastOsc.connect(blastGain);
      blastGain.connect(this.ctx.destination);
      blastOsc.start(blastTime);
      blastOsc.stop(blastTime + 0.5);
      
      // Heavy crash noise
      try {
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = this.createNoiseBuffer();
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, blastTime);
        filter.frequency.exponentialRampToValueAtTime(50, blastTime + 0.4);
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4, blastTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, blastTime + 0.5);
        
        noiseSource.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        
        noiseSource.start(blastTime);
        noiseSource.stop(blastTime + 0.5);
      } catch (e) {}
    }
  }

  playHurt() {
    if (this.isMuted || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    const now = this.ctx.currentTime;
    // Dull flat impact sound
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.15);
    
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);

    // Short lowpass noise
    try {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer();
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, now);
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.2, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      
      noise.start(now);
      noise.stop(now + 0.1);
    } catch (e) {}
  }

  playWaveComplete() {
    if (this.isMuted || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    const now = this.ctx.currentTime;
    // Ascending cyber chime (C5 -> E5 -> G5 -> C6)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const start = now + idx * 0.12;
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(start);
      osc.stop(start + 0.25);
    });
  }

  playGameOver() {
    if (this.isMuted || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    const now = this.ctx.currentTime;
    // Sad descending progression (A4 -> F4 -> D4 -> C4)
    const notes = [440.00, 349.23, 293.66, 261.63];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const start = now + idx * 0.2;
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.linearRampToValueAtTime(freq - 20, start + 0.4);
      
      gain.gain.setValueAtTime(0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
      
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(start);
      osc.stop(start + 0.45);
    });
  }

  playVictory() {
    if (this.isMuted || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    const now = this.ctx.currentTime;
    // Uplifting arpeggio (C5 -> E5 -> G5 -> C6 -> E6 -> G6 -> C7)
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const start = now + idx * 0.1;
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });

    // Chord at the end
    const finalStart = now + 0.7;
    [1046.50, 1318.51, 1567.98, 2093.00].forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, finalStart);
      
      gain.gain.setValueAtTime(0.08, finalStart);
      gain.gain.exponentialRampToValueAtTime(0.001, finalStart + 0.8);
      
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(finalStart);
      osc.stop(finalStart + 0.8);
    });
  }
}

export const audio = new AudioSynth();
