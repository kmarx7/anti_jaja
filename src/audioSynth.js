class SleepAudioSynth {
  constructor() {
    this.audioCtx = null;
    this.oscillators = [];
    this.gainNode = null;
    this.noiseSource = null;
    this.isPlaying = false;
    this.volume = 0.5;
  }

  start(musicType = 'binaural') {
    if (this.isPlaying) this.stop();

    // Create AudioContext
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new AudioContextClass();
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);

    // Lowpass filter to make it very dark and warm
    const lowpass = this.audioCtx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(180, this.audioCtx.currentTime); // very low cutoff

    this.gainNode.connect(lowpass);
    lowpass.connect(this.audioCtx.destination);

    this.isPlaying = true;

    if (musicType === 'binaural') {
      // Binaural beats (100Hz in left ear, 102Hz in right ear -> 2Hz Delta wave)
      const osc1 = this.audioCtx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(100, this.audioCtx.currentTime);

      const panner1 = this.audioCtx.createStereoPanner ? this.audioCtx.createStereoPanner() : null;
      if (panner1) {
        panner1.pan.setValueAtTime(-1, this.audioCtx.currentTime);
        osc1.connect(panner1);
        panner1.connect(this.gainNode);
      } else {
        osc1.connect(this.gainNode);
      }

      const osc2 = this.audioCtx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(102, this.audioCtx.currentTime);

      const panner2 = this.audioCtx.createStereoPanner ? this.audioCtx.createStereoPanner() : null;
      if (panner2) {
        panner2.pan.setValueAtTime(1, this.audioCtx.currentTime);
        osc2.connect(panner2);
        panner2.connect(this.gainNode);
      } else {
        osc2.connect(this.gainNode);
      }

      osc1.start();
      osc2.start();
      this.oscillators.push(osc1, osc2);

      // Add a third triangle wave for a warm pad chord (e.g. 150Hz)
      const osc3 = this.audioCtx.createOscillator();
      osc3.type = 'triangle';
      osc3.frequency.setValueAtTime(150, this.audioCtx.currentTime);
      
      const padGain = this.audioCtx.createGain();
      padGain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
      osc3.connect(padGain);
      padGain.connect(this.gainNode);
      osc3.start();
      this.oscillators.push(osc3);

    } else if (musicType === 'rain') {
      // Generate white noise buffer
      const bufferSize = 2 * this.audioCtx.sampleRate;
      const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.audioCtx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      // Filter Specifically for rain (lowpass + bandpass)
      const bandpass = this.audioCtx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(300, this.audioCtx.currentTime);
      bandpass.Q.setValueAtTime(0.7, this.audioCtx.currentTime);

      whiteNoise.connect(bandpass);
      bandpass.connect(this.gainNode);
      whiteNoise.start();
      this.noiseSource = whiteNoise;

      // Add low frequency ocean rumble
      const osc = this.audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(70, this.audioCtx.currentTime);
      osc.connect(this.gainNode);
      osc.start();
      this.oscillators.push(osc);
    } else if (musicType === 'ambient') {
      // Deep meditation pad chords
      const frequencies = [110, 165, 220, 275]; // A2, E3, A3, C#4 (Warm major chord)
      frequencies.forEach(f => {
        const osc = this.audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, this.audioCtx.currentTime);
        
        // slow volume modulation LFO
        const lfo = this.audioCtx.createOscillator();
        lfo.frequency.setValueAtTime(0.04 + Math.random() * 0.04, this.audioCtx.currentTime);
        
        const lfoGain = this.audioCtx.createGain();
        lfoGain.gain.setValueAtTime(0.04, this.audioCtx.currentTime);
        
        const oscGain = this.audioCtx.createGain();
        oscGain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
        
        lfo.connect(lfoGain);
        lfoGain.connect(oscGain.gain);
        osc.connect(oscGain);
        oscGain.connect(this.gainNode);
        
        lfo.start();
        osc.start();
        this.oscillators.push(osc, lfo);
      });
    }
  }

  setVolume(volume) {
    this.volume = volume;
    if (this.gainNode && this.audioCtx) {
      this.gainNode.gain.setValueAtTime(volume, this.audioCtx.currentTime);
    }
  }

  stop() {
    if (!this.isPlaying) return;
    this.oscillators.forEach(osc => {
      try { osc.stop(); } catch(e) {}
    });
    if (this.noiseSource) {
      try { this.noiseSource.stop(); } catch(e) {}
    }
    if (this.audioCtx) {
      this.audioCtx.close();
    }
    this.oscillators = [];
    this.noiseSource = null;
    this.audioCtx = null;
    this.gainNode = null;
    this.isPlaying = false;
  }

  fadeAndStop(durationSeconds) {
    if (!this.isPlaying || !this.gainNode || !this.audioCtx) return;
    const time = this.audioCtx.currentTime;
    try {
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, time);
      this.gainNode.gain.linearRampToValueAtTime(0, time + durationSeconds);
    } catch (e) {
      console.warn("Audio scheduling failed, stopping immediately", e);
    }
    
    // Stop after the duration is finished
    setTimeout(() => {
      this.stop();
    }, durationSeconds * 1000);
  }
}

export default SleepAudioSynth;
