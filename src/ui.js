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
    }

    _bindElements() {
        this._elements.gSlider = document.getElementById('g-slider');
        this._elements.gValue = document.getElementById('g-value');
        this._elements.timeSlider = document.getElementById('time-slider');
        this._elements.timeValue = document.getElementById('time-value');
        this._elements.bloomSlider = document.getElementById('bloom-slider');
        this._elements.bloomValue = document.getElementById('bloom-value');
        this._elements.btnSpiral = document.getElementById('btn-spiral');
        this._elements.btnBarred = document.getElementById('btn-barred');
        this._elements.btnElliptical = document.getElementById('btn-elliptical');
        this._elements.btnLenticular = document.getElementById('btn-lenticular');
        this._elements.btnIrregular = document.getElementById('btn-irregular');
        this._elements.btnRandom = document.getElementById('btn-random');
        this._elements.btnPreset = document.getElementById('btn-preset');
        this._elements.btnPause = document.getElementById('btn-pause');
        this._elements.btnStep = document.getElementById('btn-step');
        this._elements.btnFocus = document.getElementById('btn-focus');
        this._elements.btnTrails = document.getElementById('btn-trails');
        this._elements.btnInvert = document.getElementById('btn-invert');
        this._elements.btnTides = document.getElementById('btn-tides');
        this._elements.btnMulti = document.getElementById('btn-multi');
        this._elements.btnReset = document.getElementById('btn-reset');
        this._elements.statFps = document.getElementById('stat-fps');
        this._elements.statGalaxies = document.getElementById('stat-galaxies');
        this._elements.statParticles = document.getElementById('stat-particles');
        this._elements.statBH = document.getElementById('stat-bh');
        this._elements.statEnergy = document.getElementById('stat-energy');
        this._elements.statTime = document.getElementById('stat-time');
        this._elements.modeIndicator = document.getElementById('mode-indicator');

        // Bottom menu removed; horizontal UI only
        // Inject lightweight CSS to encourage a two-line horizontal layout if a UI container exists
        try {
            let style = document.getElementById('spacejam-ui-layout');
            if (!style) {
                style = document.createElement('style');
                style.id = 'spacejam-ui-layout';
                style.textContent = `
                    /* If a container with id 'ui' exists, lay out its children horizontally in two lines */
                    #ui {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 8px;
                        align-items: center;
                        justify-content: space-between;
                    }
                `;
                document.head.appendChild(style);
            }
        } catch (err) {
            // Non-critical: UI layout will still function without this styling
        }
    }

    _bindEvents() {
        // Guard bindings to avoid crashes if some DOM elements are missing
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

        if (this._elements.bloomSlider) {
            this._elements.bloomSlider.addEventListener('input', (e) => {
                this._elements.bloomValue.textContent = parseFloat(e.target.value).toFixed(2).replace('.', ',');
                if (this._callbacks.onBloomChange) this._callbacks.onBloomChange(parseFloat(e.target.value));
            });
        }

        if (this._elements.btnSpiral) this._elements.btnSpiral.addEventListener('click', () => this._enterPlacementMode('spiral'));
        if (this._elements.btnBarred) this._elements.btnBarred.addEventListener('click', () => this._enterPlacementMode('barred'));
        if (this._elements.btnElliptical) this._elements.btnElliptical.addEventListener('click', () => this._enterPlacementMode('elliptical'));
        if (this._elements.btnLenticular) this._elements.btnLenticular.addEventListener('click', () => this._enterPlacementMode('lenticular'));
        if (this._elements.btnIrregular) this._elements.btnIrregular.addEventListener('click', () => this._enterPlacementMode('irregular'));
        if (this._elements.btnRandom) this._elements.btnRandom.addEventListener('click', () => {
            if (this._callbacks.onAddRandom) this._callbacks.onAddRandom();
        });
        if (this._elements.btnPreset) this._elements.btnPreset.addEventListener('click', () => {
            if (this._callbacks.onPreset) this._callbacks.onPreset();
        });
        if (this._elements.btnPause) this._elements.btnPause.addEventListener('click', () => this._togglePause());
        if (this._elements.btnStep) this._elements.btnStep.addEventListener('click', () => {
            if (this._callbacks.onStep) this._callbacks.onStep();
        });
        if (this._elements.btnFocus) this._elements.btnFocus.addEventListener('click', () => {
            if (this._callbacks.onFocus) this._callbacks.onFocus();
        });
        if (this._elements.btnTrails) this._elements.btnTrails.addEventListener('click', () => this._toggleTrails());
        if (this._elements.btnInvert) this._elements.btnInvert.addEventListener('click', () => this._toggleInvertTime());
        if (this._elements.btnTides) this._elements.btnTides.addEventListener('click', () => this._toggleTides());
        if (this._elements.btnMulti) this._elements.btnMulti.addEventListener('click', () => {
            if (this._callbacks.onMultiScene) this._callbacks.onMultiScene();
        });
        if (this._elements.btnReset) this._elements.btnReset.addEventListener('click', () => {
            if (this._callbacks.onReset) this._callbacks.onReset();
        });
    }

    _enterPlacementMode(type) {
        this._placementMode = type;
        const labels = { spiral: 'Spirale', barred: 'Spirale barrée', elliptical: 'Elliptique', lenticular: 'Lenticulaire', irregular: 'Irrégulière' };
        this._elements.modeIndicator.textContent = `Cliquez pour placer une galaxie ${labels[type]}`;
        this._elements.modeIndicator.classList.add('active');

        const btnIds = ['btnSpiral', 'btnBarred', 'btnElliptical', 'btnLenticular', 'btnIrregular'];
        const typeMap = { spiral: 'btnSpiral', barred: 'btnBarred', elliptical: 'btnElliptical', lenticular: 'btnLenticular', irregular: 'btnIrregular' };

        btnIds.forEach(id => {
            this._elements[id].classList.toggle('active', id === typeMap[type]);
        });

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

    exitPlacementMode() {
        this._placementMode = null;
        this._elements.modeIndicator.classList.remove('active');
        const btnIds = ['btnSpiral', 'btnBarred', 'btnElliptical', 'btnLenticular', 'btnIrregular'];
        btnIds.forEach(id => {
            this._elements[id].classList.remove('active');
        });
        if (this._callbacks.onPlacementMode) this._callbacks.onPlacementMode(null);
    }

    on(event, callback) {
        const map = {
            'gChange': 'onGChange',
            'timeScaleChange': 'onTimeScaleChange',
            'bloomChange': 'onBloomChange',
            'pause': 'onPause',
            'toggleTrails': 'onToggleTrails',
            'invertTime': 'onInvertTime',
            'reset': 'onReset',
            'placementMode': 'onPlacementMode',
            'addRandom': 'onAddRandom',
            'preset': 'onPreset',
            'focus': 'onFocus',
            'toggleTides': 'onToggleTides',
            'step': 'onStep',
            'multiScene': 'onMultiScene',
        };
        // Add bottom menu related events
        if (map[event]) this._callbacks[map[event]] = callback;
    }

    updateStats(fps, galaxyCount, particleCount, bhCount, kineticEnergy, elapsed) {
        this._elements.statFps.textContent = fps;
        this._elements.statGalaxies.textContent = galaxyCount;
        this._elements.statParticles.textContent = this._formatNumber(particleCount);
        this._elements.statBH.textContent = bhCount;
        this._elements.statEnergy.textContent = this._formatNumber(kineticEnergy);
        this._elements.statTime.textContent = this._formatTime(elapsed);
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

    get placementMode() {
        return this._placementMode;
    }

    get paused() {
        return this._paused;
    }

    get tidesEnabled() {
        return this._tidesEnabled;
    }
}

export { UI };
