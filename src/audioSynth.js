class SleepAudioSynth {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.masterVolume = 0.5;
    
    // Channel volumes (0 to 1)
    this.volumes = {
      pad: 0.4,
      rain: 0.2,
      fire: 0.0,
      wind: 0.1
    };

    // Nodes
    this.masterGainNode = null;
    this.channelGains = {};
    this.oscillators = [];
    this.noiseSources = [];
    this.intervals = [];
  }

  start() {
    if (this.isPlaying) this.stop();

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new AudioContextClass();
    
    // Master Gain
    this.masterGainNode = this.audioCtx.createGain();
    this.masterGainNode.gain.setValueAtTime(this.masterVolume, this.audioCtx.currentTime);
    this.masterGainNode.connect(this.audioCtx.destination);

    this.isPlaying = true;

    // Initialize Channels
    this.initPadChannel();
    this.initRainChannel();
    this.initFireChannel();
    this.initWindChannel();
  }

  // Channel 1: Deep Meditation Pad
  initPadChannel() {
    this.channelGains.pad = this.audioCtx.createGain();
    this.channelGains.pad.gain.setValueAtTime(this.volumes.pad, this.audioCtx.currentTime);
    this.channelGains.pad.connect(this.masterGainNode);

    // Warm Lowpass Filter
    const lowpass = this.audioCtx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(150, this.audioCtx.currentTime);
    lowpass.connect(this.channelGains.pad);

    // 3 Detuned Sine Oscillators for Binaural & Warmth (A2, E3, A3)
    const frequencies = [110, 111.5, 165, 220]; // 1.5Hz beat between left/right
    frequencies.forEach((f, idx) => {
      const osc = this.audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, this.audioCtx.currentTime);

      const oscGain = this.audioCtx.createGain();
      oscGain.gain.setValueAtTime(idx === 0 || idx === 1 ? 0.3 : 0.15, this.audioCtx.currentTime);

      // Stereo panning
      const panner = this.audioCtx.createStereoPanner ? this.audioCtx.createStereoPanner() : null;
      if (panner) {
        // Pan left for osc1, right for osc2, center for others
        const panVal = idx === 0 ? -1 : idx === 1 ? 1 : 0;
        panner.pan.setValueAtTime(panVal, this.audioCtx.currentTime);
        osc.connect(oscGain);
        oscGain.connect(panner);
        panner.connect(lowpass);
      } else {
        osc.connect(oscGain);
        oscGain.connect(lowpass);
      }

      osc.start();
      this.oscillators.push(osc);
    });
  }

  // Channel 2: Filtered Soft Rain
  initRainChannel() {
    this.channelGains.rain = this.audioCtx.createGain();
    this.channelGains.rain.gain.setValueAtTime(this.volumes.rain, this.audioCtx.currentTime);
    this.channelGains.rain.connect(this.masterGainNode);

    // Create White Noise
    const bufferSize = 2 * this.audioCtx.sampleRate;
    const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Rain Bandpass Filter
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(320, this.audioCtx.currentTime);
    filter.Q.setValueAtTime(0.5, this.audioCtx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(this.channelGains.rain);
    whiteNoise.start();
    this.noiseSources.push(whiteNoise);
  }

  // Channel 3: Campfire Crackling Click Synth
  initFireChannel() {
    this.channelGains.fire = this.audioCtx.createGain();
    this.channelGains.fire.gain.setValueAtTime(this.volumes.fire, this.audioCtx.currentTime);
    this.channelGains.fire.connect(this.masterGainNode);

    // Low Frequency Fire Rumble
    const rumbleOsc = this.audioCtx.createOscillator();
    rumbleOsc.type = 'sine';
    rumbleOsc.frequency.setValueAtTime(55, this.audioCtx.currentTime); // Low A hum
    
    // Modulate rumble amplitude with slow LFO
    const rumbleLfo = this.audioCtx.createOscillator();
    rumbleLfo.frequency.setValueAtTime(1.5, this.audioCtx.currentTime); // 1.5Hz flame flutter
    
    const rumbleLfoGain = this.audioCtx.createGain();
    rumbleLfoGain.gain.setValueAtTime(0.04, this.audioCtx.currentTime);
    
    const rumbleGain = this.audioCtx.createGain();
    rumbleGain.gain.setValueAtTime(0.06, this.audioCtx.currentTime);

    rumbleLfo.connect(rumbleLfoGain);
    rumbleLfoGain.connect(rumbleGain.gain);
    rumbleOsc.connect(rumbleGain);
    rumbleGain.connect(this.channelGains.fire);

    rumbleLfo.start();
    rumbleOsc.start();
    this.oscillators.push(rumbleLfo, rumbleOsc);

    // High frequency crackling click triggers
    const triggerCrackles = () => {
      if (!this.audioCtx || !this.isPlaying) return;
      
      // Crackle pops are random triangle waves with extremely short decays
      const crackle = this.audioCtx.createOscillator();
      const crackleGain = this.audioCtx.createGain();

      crackle.type = 'triangle';
      crackle.frequency.setValueAtTime(100 + Math.random() * 1500, this.audioCtx.currentTime);

      crackleGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
      crackleGain.gain.linearRampToValueAtTime(0.06 * Math.random(), this.audioCtx.currentTime + 0.001);
      crackleGain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + 0.005 + Math.random() * 0.02);

      // Filter to keep only sharp highs
      const highpass = this.audioCtx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(800, this.audioCtx.currentTime);

      crackle.connect(highpass);
      highpass.connect(crackleGain);
      crackleGain.connect(this.channelGains.fire);

      crackle.start();
      crackle.stop(this.audioCtx.currentTime + 0.1);

      // Schedule next crackle at random interval (30ms - 250ms)
      const nextTime = 30 + Math.random() * 220;
      const timeoutId = setTimeout(triggerCrackles, nextTime);
      this.intervals.push(timeoutId);
    };

    triggerCrackles();
  }

  // Channel 4: Windy Gusts with Modulator LFO
  initWindChannel() {
    this.channelGains.wind = this.audioCtx.createGain();
    this.channelGains.wind.gain.setValueAtTime(this.volumes.wind, this.audioCtx.currentTime);
    this.channelGains.wind.connect(this.masterGainNode);

    // Create White Noise
    const bufferSize = 2 * this.audioCtx.sampleRate;
    const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Wind dynamic filter (Lowpass)
    const windFilter = this.audioCtx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.setValueAtTime(250, this.audioCtx.currentTime);

    // Modulate filter frequency slowly to simulate gusts
    const filterLfo = this.audioCtx.createOscillator();
    filterLfo.frequency.setValueAtTime(0.05, this.audioCtx.currentTime); // 20-second sweep cycle
    
    const filterLfoGain = this.audioCtx.createGain();
    filterLfoGain.gain.setValueAtTime(120, this.audioCtx.currentTime); // Sweep by +/- 120Hz

    filterLfo.connect(filterLfoGain);
    filterLfoGain.connect(windFilter.frequency);

    whiteNoise.connect(windFilter);
    windFilter.connect(this.channelGains.wind);

    filterLfo.start();
    whiteNoise.start();
    this.oscillators.push(filterLfo);
    this.noiseSources.push(whiteNoise);
  }

  // Dynamic Volume Modifiers
  setVolume(volume) {
    this.masterVolume = volume;
    if (this.masterGainNode && this.audioCtx) {
      this.masterGainNode.gain.setValueAtTime(volume, this.audioCtx.currentTime);
    }
  }

  setChannelVolume(channel, volume) {
    const bounded = Math.max(0, Math.min(1, volume));
    this.volumes[channel] = bounded;
    if (this.channelGains[channel] && this.audioCtx) {
      this.channelGains[channel].gain.setValueAtTime(bounded, this.audioCtx.currentTime);
    }
  }

  stop() {
    if (!this.isPlaying) return;
    
    // Stop all oscillators
    this.oscillators.forEach(osc => {
      try { osc.stop(); } catch(e) {}
    });
    
    // Stop all noise sources
    this.noiseSources.forEach(source => {
      try { source.stop(); } catch(e) {}
    });

    // Clear crackle timeouts
    this.intervals.forEach(id => clearTimeout(id));

    if (this.audioCtx) {
      this.audioCtx.close();
    }

    this.oscillators = [];
    this.noiseSources = [];
    this.intervals = [];
    this.channelGains = {};
    this.masterGainNode = null;
    this.audioCtx = null;
    this.isPlaying = false;
  }

  fadeAndStop(durationSeconds) {
    if (!this.isPlaying || !this.masterGainNode || !this.audioCtx) return;
    const time = this.audioCtx.currentTime;
    try {
      this.masterGainNode.gain.setValueAtTime(this.masterGainNode.gain.value, time);
      this.masterGainNode.gain.linearRampToValueAtTime(0, time + durationSeconds);
    } catch (e) {
      console.warn("Audio scheduling failed, stopping immediately", e);
    }
    
    setTimeout(() => {
      this.stop();
    }, durationSeconds * 1000);
  }
}

export default SleepAudioSynth;
