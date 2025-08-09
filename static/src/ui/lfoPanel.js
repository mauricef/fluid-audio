/**
 * LFO Panel UI Component
 * Provides a mobile-friendly interface for configuring LFOs on any parameter
 */

import { WAVEFORMS, getWaveformSample } from '../lfo.js';

export class LFOPanel {
    constructor(container, paramName, lfoManager, onUpdate, hudInstance = null) {
        this.container = container;
        this.paramName = paramName;
        this.lfoManager = lfoManager;
        this.onUpdate = onUpdate;
        this.hudInstance = hudInstance;
        this.isExpanded = false;
        this.animationFrame = null;
        
        this.createPanel();
        this.bindEvents();
    }

    createPanel() {
        this.panel = document.createElement('div');
        this.panel.className = 'lfo-panel';
        this.panel.innerHTML = `
            <div class="lfo-header" data-param="${this.paramName}">
                <button class="lfo-toggle" title="Toggle LFO">
                    <span class="lfo-icon">~</span>
                </button>
                <button class="lfo-expand" title="LFO Settings">
                    <span class="expand-icon">⚙</span>
                </button>
                <div class="lfo-indicator"></div>
            </div>
            <div class="lfo-controls">
                <div class="lfo-control-group">
                    <label>Wave</label>
                    <select class="lfo-waveform">
                        ${Object.entries(WAVEFORMS).map(([key, label]) => 
                            `<option value="${key}">${label}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="lfo-control-group">
                    <label>Rate</label>
                    <input type="range" class="lfo-rate" min="0.001" max="2" step="0.001" value="0.01">
                    <span class="lfo-rate-value">0.01 Hz</span>
                </div>
                <div class="lfo-control-group">
                    <label>Depth</label>
                    <input type="range" class="lfo-depth" min="0" max="1" step="0.01" value="0.5">
                    <span class="lfo-depth-value">50%</span>
                </div>
                <div class="lfo-control-group">
                    <label>Offset</label>
                    <input type="range" class="lfo-offset" min="0" max="1" step="0.01" value="0.5">
                    <span class="lfo-offset-value">50%</span>
                </div>
                <div class="lfo-control-group">
                    <label>Phase</label>
                    <input type="range" class="lfo-phase" min="0" max="1" step="0.01" value="0">
                    <span class="lfo-phase-value">0°</span>
                </div>
                <div class="lfo-control-group lfo-checkboxes">
                    <label class="checkbox-label">
                        <input type="checkbox" class="lfo-bipolar"> Bipolar
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" class="lfo-sync"> Sync
                    </label>
                </div>
                <div class="lfo-visualizer">
                    <canvas class="lfo-wave-canvas" width="200" height="60"></canvas>
                </div>
                <div class="lfo-actions">
                    <button class="lfo-reset">Reset</button>
                    <button class="lfo-copy">Copy</button>
                    <button class="lfo-paste">Paste</button>
                </div>
            </div>
        `;
        
        this.container.appendChild(this.panel);
        this.initializeControls();
        this.updateVisualization();
    }

    initializeControls() {
        // Get control elements
        this.toggleBtn = this.panel.querySelector('.lfo-toggle');
        this.expandBtn = this.panel.querySelector('.lfo-expand');
        this.indicator = this.panel.querySelector('.lfo-indicator');
        this.controls = this.panel.querySelector('.lfo-controls');
        
        this.waveformSelect = this.panel.querySelector('.lfo-waveform');
        this.rateSlider = this.panel.querySelector('.lfo-rate');
        this.rateValue = this.panel.querySelector('.lfo-rate-value');
        this.depthSlider = this.panel.querySelector('.lfo-depth');
        this.depthValue = this.panel.querySelector('.lfo-depth-value');
        this.offsetSlider = this.panel.querySelector('.lfo-offset');
        this.offsetValue = this.panel.querySelector('.lfo-offset-value');
        this.phaseSlider = this.panel.querySelector('.lfo-phase');
        this.phaseValue = this.panel.querySelector('.lfo-phase-value');
        this.bipolarCheck = this.panel.querySelector('.lfo-bipolar');
        this.syncCheck = this.panel.querySelector('.lfo-sync');
        
        this.canvas = this.panel.querySelector('.lfo-wave-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.resetBtn = this.panel.querySelector('.lfo-reset');
        this.copyBtn = this.panel.querySelector('.lfo-copy');
        this.pasteBtn = this.panel.querySelector('.lfo-paste');
        
        // Load current LFO state
        this.loadLFOState();
    }

    bindEvents() {
        // Toggle LFO on/off
        this.toggleBtn.addEventListener('click', () => {
            const lfo = this.lfoManager.getLFO(this.paramName);
            
            // Get the actual current value from the HUD params, not the base value
            const currentValue = this.hudInstance && this.hudInstance.params 
                ? this.hudInstance.params[this.paramName] 
                : this.lfoManager.getBaseValue(this.paramName);
            
            console.log(`Toggling LFO for ${this.paramName}: enabled=${lfo.enabled}, currentValue=${currentValue}, fromHUD=${!!this.hudInstance}`);
            
            lfo.setEnabled(!lfo.enabled, currentValue);
            
            this.updateIndicator();
            this.onUpdate();
        });

        // Expand/collapse controls
        this.expandBtn.addEventListener('click', (event) => {
            this.isExpanded = !this.isExpanded;
            this.panel.classList.toggle('expanded', this.isExpanded);
            this.expandBtn.querySelector('.expand-icon').textContent = this.isExpanded ? '✕' : '⚙';
            
            if (this.isExpanded) {
                // Position the controls panel near the button
                const buttonRect = this.expandBtn.getBoundingClientRect();
                const controls = this.controls;
                
                // Position below and to the left of the button
                controls.style.left = `${Math.max(10, buttonRect.right - 280)}px`;
                controls.style.top = `${buttonRect.bottom + 5}px`;
                
                // Ensure it doesn't go off-screen
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                
                if (parseInt(controls.style.left) + 280 > viewportWidth) {
                    controls.style.left = `${viewportWidth - 290}px`;
                }
                
                if (parseInt(controls.style.top) + 200 > viewportHeight) {
                    controls.style.top = `${buttonRect.top - 200}px`;
                }
            }
            
            // Manage parent row z-index to ensure proper layering
            const parentRow = this.container.closest('.cr');
            if (parentRow) {
                parentRow.classList.toggle('lfo-expanded', this.isExpanded);
            }
        });

        // Control changes
        this.waveformSelect.addEventListener('change', () => this.updateLFO());
        this.rateSlider.addEventListener('input', () => {
            const rate = parseFloat(this.rateSlider.value);
            this.rateValue.textContent = rate < 0.01 ? `${rate.toFixed(3)} Hz` : `${rate.toFixed(2)} Hz`;
            this.updateLFO();
            this.updateVisualization();
        });
        this.depthSlider.addEventListener('input', () => {
            this.depthValue.textContent = `${Math.round(this.depthSlider.value * 100)}%`;
            this.updateLFO();
            this.updateVisualization();
        });
        this.offsetSlider.addEventListener('input', () => {
            this.offsetValue.textContent = `${Math.round(this.offsetSlider.value * 100)}%`;
            this.updateLFO();
            this.updateVisualization();
        });
        this.phaseSlider.addEventListener('input', () => {
            this.phaseValue.textContent = `${Math.round(this.phaseSlider.value * 360)}°`;
            this.updateLFO();
            this.updateVisualization();
        });
        this.bipolarCheck.addEventListener('change', () => {
            this.updateLFO();
            this.updateVisualization();
        });
        this.syncCheck.addEventListener('change', () => this.updateLFO());

        // Actions
        this.resetBtn.addEventListener('click', () => this.resetLFO());
        this.copyBtn.addEventListener('click', () => this.copyLFO());
        this.pasteBtn.addEventListener('click', () => this.pasteLFO());

        // Start animation for indicator
        this.startAnimation();
        
        // Close panel when clicking outside
        this.handleOutsideClick = (event) => {
            if (this.isExpanded && !this.panel.contains(event.target)) {
                this.isExpanded = false;
                this.panel.classList.remove('expanded');
                this.expandBtn.querySelector('.expand-icon').textContent = '⚙';
                
                const parentRow = this.container.closest('.cr');
                if (parentRow) {
                    parentRow.classList.remove('lfo-expanded');
                }
            }
        };
        
        document.addEventListener('click', this.handleOutsideClick);
    }

    loadLFOState() {
        // Ensure we get the LFO for this specific parameter
        const lfo = this.lfoManager.getLFO(this.paramName);
        const state = lfo.getState();
        
        console.log(`Loading LFO state for ${this.paramName}:`, state); // Debug log
        
        this.waveformSelect.value = state.waveform;
        this.rateSlider.value = state.rate;
        this.rateValue.textContent = state.rate < 0.01 ? `${state.rate.toFixed(3)} Hz` : `${state.rate.toFixed(2)} Hz`;
        this.depthSlider.value = state.depth;
        this.depthValue.textContent = `${Math.round(state.depth * 100)}%`;
        this.offsetSlider.value = state.offset;
        this.offsetValue.textContent = `${Math.round(state.offset * 100)}%`;
        this.phaseSlider.value = state.phase;
        this.phaseValue.textContent = `${Math.round(state.phase * 360)}°`;
        this.bipolarCheck.checked = state.bipolar;
        this.syncCheck.checked = state.sync;
        
        this.updateIndicator();
        this.updateVisualization();
    }

    updateLFO() {
        const lfo = this.lfoManager.getLFO(this.paramName);
        const newParams = {
            waveform: this.waveformSelect.value,
            rate: parseFloat(this.rateSlider.value),
            depth: parseFloat(this.depthSlider.value),
            offset: parseFloat(this.offsetSlider.value),
            phase: parseFloat(this.phaseSlider.value),
            bipolar: this.bipolarCheck.checked,
            sync: this.syncCheck.checked
        };
        
        console.log(`Updating LFO for ${this.paramName}:`, newParams); // Debug log
        lfo.updateParams(newParams);
        this.onUpdate();
    }

    updateIndicator() {
        const lfo = this.lfoManager.getLFO(this.paramName);
        this.panel.classList.toggle('lfo-active', lfo.enabled);
        this.indicator.style.opacity = lfo.enabled ? '1' : '0.3';
    }

    updateVisualization() {
        const lfo = this.lfoManager.getLFO(this.paramName);
        const state = lfo.getState();
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([2, 2]);
        
        // Horizontal center line
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.canvas.height / 2);
        this.ctx.lineTo(this.canvas.width, this.canvas.height / 2);
        this.ctx.stroke();
        
        // Vertical lines
        for (let i = 0; i <= 4; i++) {
            const x = (i / 4) * this.canvas.width;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        this.ctx.setLineDash([]);
        
        // Draw waveform
        this.ctx.strokeStyle = '#00ff88';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        
        for (let x = 0; x < this.canvas.width; x++) {
            const position = x / this.canvas.width;
            let value = getWaveformSample(state.waveform, (position + state.phase) % 1);
            
            // Apply depth and offset
            if (state.bipolar) {
                value = state.offset + (value * state.depth * 0.5);
            } else {
                const unipolar = (value + 1) * 0.5;
                value = state.offset + ((unipolar - 0.5) * state.depth);
            }
            
            // Clamp and convert to canvas coordinates
            value = Math.max(0, Math.min(1, value));
            const y = this.canvas.height - (value * this.canvas.height);
            
            if (x === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        
        this.ctx.stroke();
        
        // Draw current position indicator if LFO is active
        if (lfo.enabled) {
            const currentValue = lfo.getValue(performance.now());
            const clampedValue = Math.max(0, Math.min(1, currentValue));
            const indicatorY = this.canvas.height - (clampedValue * this.canvas.height);
            
            this.ctx.fillStyle = '#ff4444';
            this.ctx.beginPath();
            this.ctx.arc(10, indicatorY, 3, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    startAnimation() {
        const animate = () => {
            this.updateVisualization();
            this.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    }

    resetLFO() {
        const lfo = this.lfoManager.getLFO(this.paramName, {
            enabled: false,
            waveform: 'sine',
            rate: 1.0,
            depth: 0.5,
            offset: 0.5,
            phase: 0,
            bipolar: false,
            sync: false
        });
        lfo.reset();
        this.loadLFOState();
        this.onUpdate();
    }

    copyLFO() {
        const lfo = this.lfoManager.getLFO(this.paramName);
        const state = lfo.getState();
        navigator.clipboard.writeText(JSON.stringify(state)).then(() => {
            this.copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                this.copyBtn.textContent = 'Copy';
            }, 1000);
        });
    }

    async pasteLFO() {
        try {
            const text = await navigator.clipboard.readText();
            const state = JSON.parse(text);
            const lfo = this.lfoManager.getLFO(this.paramName);
            lfo.setState(state);
            this.loadLFOState();
            this.onUpdate();
            
            this.pasteBtn.textContent = 'Pasted!';
            setTimeout(() => {
                this.pasteBtn.textContent = 'Paste';
            }, 1000);
        } catch (e) {
            this.pasteBtn.textContent = 'Error';
            setTimeout(() => {
                this.pasteBtn.textContent = 'Paste';
            }, 1000);
        }
    }

    destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        // Clean up event listeners
        if (this.handleOutsideClick) {
            document.removeEventListener('click', this.handleOutsideClick);
        }
        
        // Clean up parent row class
        const parentRow = this.container.closest('.cr');
        if (parentRow) {
            parentRow.classList.remove('lfo-expanded');
        }
        
        this.panel.remove();
    }
}
