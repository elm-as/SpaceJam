class AudioManager {
  constructor(url) {
    this.url = url;
    this.ctx = null;
    this.buffer = null;
    this.gain = null;
    this.source = null;
    this.isPlaying = false;
  }

  init() {
    // Initialize on first user interaction to satisfy autoplay policies
    const onFirstInteraction = () => {
      this._ensureContext();
      if (this.buffer && !this.isPlaying) {
        this.play();
      }
    };
    window.addEventListener('mousedown', onFirstInteraction, { once: true });
    window.addEventListener('keydown', onFirstInteraction, { once: true });
    // Global mute toggle with 'M'
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'm') this.toggleMute();
    });
  }

  _ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0.2;
      this.gain.connect(this.ctx.destination);
      this._loadBuffer();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  async _loadBuffer() {
    try {
      const resp = await fetch(this.url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const arr = await resp.arrayBuffer();
      this.buffer = await this.ctx.decodeAudioData(arr);
    } catch (err) {
      console.warn('[SpaceJam] Music load failed:', err);
    }
  }

  play() {
    if (!this.ctx || !this.buffer) return;
    this.source = this.ctx.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.loop = true;
    this.source.connect(this.gain);
    this.source.start(0);
    this.isPlaying = true;
  }

  toggleMute() {
    if (!this.gain) return;
    this.gain.gain.value = this.gain.gain.value > 0 ? 0 : 0.2;
  }
}

export { AudioManager };
