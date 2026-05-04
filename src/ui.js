class UI {
    constructor() {
        this._elements = {};
        this._callbacks = {};
        this._paused = false;
        this._placementMode = null;
        this._timeInverted = false;
        this._tidesEnabled = true;
        this._bindElements();
        this._bindEvents();
        this._applyAdaptiveLayout();
        window.addEventListener('resize', () => this._applyAdaptiveLayout());
    }

    // ── Adaptation hauteur selon la taille d'écran ────────────────────────────
    _applyAdaptiveLayout() {
        const ctrl = this._elements.controls;
        if (!ctrl) return;
        const vh = window.innerHeight;
        // Hauteur max dynamique : 90% de l'écran, avec scroll si nécessaire
        ctrl.style.maxHeight = (vh - 40) + 'px';
        // Sur petits écrans (<= 700px de hauteur) : compacter les marges
        const compact = vh <= 700;
        ctrl.classList.toggle('compact', compact);
    }

    _bindElements() {
        this._elements.controls    = document.getElementById('controls');
        this._elements.gSlider     = document.getElementById('g-slider');
        this._elements.gValue      = document.getElementById('g-value');
        this._elements.timeSlider  = document.getElementById('time-slider');
        this._elements.timeValue   = document.getElementById('time-value');
        this._elements.animSlider  = document.getElementById('anim-slider');
        this._elements.animValue   = document.getElementById('anim-value');
        this._elements.bloomSlider = document.getElementById('bloom-slider');
        this._elements.bloomValue  = document.getElementById('bloom-value');
        this._elements.btnSpiral     = document.getElementById('btn-spiral');
        this._elements.btnBarred     = document.getElementById('btn-barred');
        this._elements.btnElliptical = document.getElementById('btn-elliptical');
        this._elements.btnLenticular = document.getElementById('btn-lenticular');
        this._elements.btnIrregular  = document.getElementById('btn-irregular');
        this._elements.btnRandom     = document.getElementById('btn-random');
        this._elements.btnPreset     = document.getElementById('btn-preset');
        this._elements.btnPause      = document.getElementById('btn-pause');
        this._elements.btnStep       = document.getElementById('btn-step');
        this._elements.btnFocus      = document.getElementById('btn-focus');
        this._elements.btnTrails     = document.getElementById('btn-trails');
        this._elements.btnInvert     = document.getElementById('btn-invert');
        this._elements.btnTides      = document.getElementById('btn-tides');
        this._elements.btnMulti      = document.getElementById('btn-multi');
        this._elements.btnReset      = document.getElementById('btn-reset');
        this._elements.statFps       = document.getElementById('stat-fps');
        this._elements.statGalaxies  = document.getElementById('stat-galaxies');
        this._elements.statParticles = document.getElementById('stat-particles');
        this._elements.statBH        = document.getElementById('stat-bh');
        this._elements.statEnergy    = document.getElementById('stat-energy');
        this._elements.statTime      = document.getElementById('stat-time');
        this._elements.modeIndicator = document.getElementById('mode-indicator');
        
        // New elements
        this._elements.btnAddBH      = document.getElementById('btn-add-bh');
        this._elements.btnAddStar    = document.getElementById('btn-add-star');
        this._elements.bhMassSlider  = document.getElementById('bhmass-slider');
        this._elements.bhMassValue   = document.getElementById('bhmass-value');
        this._elements.btnPerfMode   = document.getElementById('btn-perf-mode');
        this._perfMode = false;

        this._injectStyles();
    }

    _injectStyles() {
        if (document.getElementById('spacejam-ui-adaptive')) return;
        const style = document.createElement('style');
        style.id = 'spacejam-ui-adaptive';
        style.textContent = `
            #controls {
                overflow-y: auto;
                overflow-x: hidden;
                transition: max-height 0.3s ease;
                scrollbar-width: thin;
                scrollbar-color: rgba(255,255,255,0.15) transparent;
            }
            #controls::-webkit-scrollbar { width: 4px; }
            #controls::-webkit-scrollbar-track { background: transparent; }
            #controls::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
            /* Mode compact : réduire les espaces */
            #controls.compact .section-label { margin: 6px 0 4px 0; }
            #controls.compact .control-group { margin-bottom: 6px; }
            #controls.compact .btn { padding: 6px 10px; margin-bottom: 4px; }
            #controls.compact h2 { margin-bottom: 8px; }
        `;
        document.head.appendChild(style);
    }

    _bindEvents() {
        if (this._elements.gSlider) {
            this._elements.gSlider.addEventListener('input', (e) => {
                this._elements.gValue.textContent = parseFloat(e.target.value).toFixed(2).replace('.', ',');
                if (this._callbacks.onGChange) this._callbacks.onGChange(parseFloat(e.target.value));
            });
        }

        if (this._elements.timeSlider) {
            this._elements.timeSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this._elements.timeValue.textContent = val.toFixed(1).replace('.', ',') + 'x';
                if (this._callbacks.onTimeScaleChange) this._callbacks.onTimeScaleChange(val);
            });
        }

        // Nouveau slider : vitesse d'animation (animSpeed)
        if (this._elements.animSlider) {
            this._elements.animSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this._elements.animValue.textContent = val.toFixed(1).replace('.', ',') + 'x';
                if (this._callbacks.onAnimSpeedChange) this._callbacks.onAnimSpeedChange(val);
            });
        }

        if (this._elements.bloomSlider) {
            this._elements.bloomSlider.addEventListener('input', (e) => {
                this._elements.bloomValue.textContent = parseFloat(e.target.value).toFixed(2).replace('.', ',');
                if (this._callbacks.onBloomChange) this._callbacks.onBloomChange(parseFloat(e.target.value));
            });
        }

        if (this._elements.bhMassSlider) {
            this._elements.bhMassSlider.addEventListener('input', (e) => {
                this._elements.bhMassValue.textContent = e.target.value;
                if (this._callbacks.onBHMassChange) this._callbacks.onBHMassChange(parseFloat(e.target.value));
            });
        }

        if (this._elements.btnSpiral)     this._elements.btnSpiral.addEventListener('click', () => this._enterPlacementMode('spiral'));
        if (this._elements.btnBarred)     this._elements.btnBarred.addEventListener('click', () => this._enterPlacementMode('barred'));
        if (this._elements.btnElliptical) this._elements.btnElliptical.addEventListener('click', () => this._enterPlacementMode('elliptical'));
        if (this._elements.btnLenticular) this._elements.btnLenticular.addEventListener('click', () => this._enterPlacementMode('lenticular'));
        if (this._elements.btnIrregular)  this._elements.btnIrregular.addEventListener('click', () => this._enterPlacementMode('irregular'));
        if (this._elements.btnRandom)     this._elements.btnRandom.addEventListener('click', () => { if (this._callbacks.onAddRandom) this._callbacks.onAddRandom(); });
        if (this._elements.btnPreset)     this._elements.btnPreset.addEventListener('click', () => { if (this._callbacks.onPreset) this._callbacks.onPreset(); });
        if (this._elements.btnPause)      this._elements.btnPause.addEventListener('click', () => this._togglePause());
        if (this._elements.btnStep)       this._elements.btnStep.addEventListener('click', () => { if (this._callbacks.onStep) this._callbacks.onStep(); });
        if (this._elements.btnFocus)      this._elements.btnFocus.addEventListener('click', () => { if (this._callbacks.onFocus) this._callbacks.onFocus(); });
        if (this._elements.btnTrails)     this._elements.btnTrails.addEventListener('click', () => this._toggleTrails());
        if (this._elements.btnInvert)     this._elements.btnInvert.addEventListener('click', () => this._toggleInvertTime());
        if (this._elements.btnTides)      this._elements.btnTides.addEventListener('click', () => this._toggleTides());
        if (this._elements.btnMulti)      this._elements.btnMulti.addEventListener('click', () => { if (this._callbacks.onMultiScene) this._callbacks.onMultiScene(); });
        if (this._elements.btnReset)      this._elements.btnReset.addEventListener('click', () => { if (this._callbacks.onReset) this._callbacks.onReset(); });
        
        if (this._elements.btnAddBH)      this._elements.btnAddBH.addEventListener('click', () => this._enterPlacementMode('free_bh'));
        if (this._elements.btnAddStar)    this._elements.btnAddStar.addEventListener('click', () => this._enterPlacementMode('free_star'));
        if (this._elements.btnPerfMode)   this._elements.btnPerfMode.addEventListener('click', () => this._togglePerfMode());
    }

    _enterPlacementMode(type) {
        this._placementMode = type;
        const labels = { 
            spiral: 'Spirale', barred: 'Spirale barrée', elliptical: 'Elliptique', lenticular: 'Lenticulaire', irregular: 'Irrégulière',
            free_bh: 'Trou Noir (Ajustez la masse)', free_star: 'Étoiles Libres (Ajustez le nombre)'
        };
        const massLabel = document.getElementById('bhmass-label');
        if (massLabel) {
            if (type === 'free_bh') {
                massLabel.innerHTML = 'Masse Nv. TN <span class="value" id="bhmass-value">1000</span>';
                this._elements.bhMassSlider.min = 100;
                this._elements.bhMassSlider.max = 10000;
                this._elements.bhMassSlider.step = 100;
                this._elements.bhMassSlider.value = 1000;
                this._elements.bhMassValue = document.getElementById('bhmass-value');
                if (this._callbacks.onBHMassChange) this._callbacks.onBHMassChange(1000);
            } else if (type === 'free_star') {
                massLabel.innerHTML = 'Nbr. Étoiles <span class="value" id="bhmass-value">50</span>';
                this._elements.bhMassSlider.min = 1;
                this._elements.bhMassSlider.max = 200;
                this._elements.bhMassSlider.step = 1;
                this._elements.bhMassSlider.value = 50;
                this._elements.bhMassValue = document.getElementById('bhmass-value');
                if (this._callbacks.onBHMassChange) this._callbacks.onBHMassChange(50);
            }
        }
        
        this._elements.modeIndicator.textContent = `Cliquez pour placer : ${labels[type]}`;
        this._elements.modeIndicator.classList.add('active');
        const btnIds = ['btnSpiral', 'btnBarred', 'btnElliptical', 'btnLenticular', 'btnIrregular', 'btnAddBH', 'btnAddStar'];
        const typeMap = { spiral: 'btnSpiral', barred: 'btnBarred', elliptical: 'btnElliptical', lenticular: 'btnLenticular', irregular: 'btnIrregular', free_bh: 'btnAddBH', free_star: 'btnAddStar' };
        btnIds.forEach(id => { this._elements[id].classList.toggle('active', id === typeMap[type]); });
        if (this._callbacks.onPlacementMode) this._callbacks.onPlacementMode(type);
    }

    _togglePause() {
        this._paused = !this._paused;
        this._elements.btnPause.textContent = this._paused ? 'Reprendre' : 'Pause';
        if (this._callbacks.onPause) this._callbacks.onPause(this._paused);
    }

    _toggleTrails() {
        const isActive = this._elements.btnTrails.textContent === 'Masquer Trajectoires';
        this._elements.btnTrails.textContent = isActive ? 'Afficher Trajectoires' : 'Masquer Trajectoires';
        if (this._callbacks.onToggleTrails) this._callbacks.onToggleTrails();
    }

    _toggleInvertTime() {
        this._timeInverted = !this._timeInverted;
        this._elements.btnInvert.textContent = this._timeInverted ? 'Temps Normal' : 'Inverser le Temps';
        this._elements.btnInvert.classList.toggle('danger', this._timeInverted);
        if (this._callbacks.onInvertTime) this._callbacks.onInvertTime(this._timeInverted);
    }

    _toggleTides() {
        this._tidesEnabled = !this._tidesEnabled;
        this._elements.btnTides.textContent = `Marées: ${this._tidesEnabled ? 'ON' : 'OFF'}`;
        if (this._callbacks.onToggleTides) this._callbacks.onToggleTides(this._tidesEnabled);
    }

    _togglePerfMode() {
        this._perfMode = !this._perfMode;
        this._elements.btnPerfMode.textContent = `Mode Perf: ${this._perfMode ? 'ON' : 'OFF'}`;
        this._elements.btnPerfMode.classList.toggle('active', this._perfMode);
        if (this._callbacks.onTogglePerfMode) this._callbacks.onTogglePerfMode(this._perfMode);
    }

    exitPlacementMode() {
        this._placementMode = null;
        this._elements.modeIndicator.classList.remove('active');
        const btnIds = ['btnSpiral', 'btnBarred', 'btnElliptical', 'btnLenticular', 'btnIrregular', 'btnAddBH', 'btnAddStar'];
        btnIds.forEach(id => { this._elements[id].classList.remove('active'); });
        
        const massLabel = document.getElementById('bhmass-label');
        if (massLabel) {
            massLabel.innerHTML = 'Masse Nv. TN <span class="value" id="bhmass-value">1000</span>';
            this._elements.bhMassSlider.min = 100;
            this._elements.bhMassSlider.max = 10000;
            this._elements.bhMassSlider.step = 100;
            this._elements.bhMassSlider.value = 1000;
            this._elements.bhMassValue = document.getElementById('bhmass-value');
        }

        if (this._callbacks.onPlacementMode) this._callbacks.onPlacementMode(null);
    }

    on(event, callback) {
        const map = {
            'gChange':          'onGChange',
            'timeScaleChange':  'onTimeScaleChange',
            'animSpeedChange':  'onAnimSpeedChange',
            'bloomChange':      'onBloomChange',
            'pause':            'onPause',
            'toggleTrails':     'onToggleTrails',
            'invertTime':       'onInvertTime',
            'reset':            'onReset',
            'placementMode':    'onPlacementMode',
            'addRandom':        'onAddRandom',
            'preset':           'onPreset',
            'focus':            'onFocus',
            'toggleTides':      'onToggleTides',
            'togglePerfMode':   'onTogglePerfMode',
            'step':             'onStep',
            'multiScene':       'onMultiScene',
            'bhMassChange':     'onBHMassChange',
        };
        if (map[event]) this._callbacks[map[event]] = callback;
    }

    updateStats(fps, galaxyCount, particleCount, bhCount, kineticEnergy, elapsed) {
        this._elements.statFps.textContent       = fps;
        this._elements.statGalaxies.textContent  = galaxyCount;
        this._elements.statParticles.textContent = this._formatNumber(particleCount);
        this._elements.statBH.textContent        = bhCount;
        this._elements.statEnergy.textContent    = this._formatNumber(kineticEnergy);
        this._elements.statTime.textContent      = this._formatTime(elapsed);
    }

    updateGalaxyInfo(galaxy) {
        if (galaxy) {
            this._elements.modeIndicator.textContent =
                `${galaxy.type} | Masse: ${galaxy.Mtot.toFixed(0)} | Gaz: ${(galaxy.gasFraction * 100).toFixed(1)}%`;
            this._elements.modeIndicator.classList.add('active');
            setTimeout(() => {
                if (this._placementMode === null) {
                    this._elements.modeIndicator.classList.remove('active');
                }
            }, 3000);
        }
    }

    _formatNumber(n) {
        if (isNaN(n) || !isFinite(n)) return '0';
        if (n >= 1e9) return (n / 1e9).toFixed(1) + ' Md';
        if (n >= 1e6) return (n / 1e6).toFixed(1) + ' M';
        if (n >= 1e3) return (n / 1e3).toFixed(1) + ' k';
        return n.toFixed(0);
    }

    _formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    get placementMode() { return this._placementMode; }
    get paused()        { return this._paused; }
    get tidesEnabled()  { return this._tidesEnabled; }
}

export { UI };