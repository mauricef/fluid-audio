/**
 * LFO (Low Frequency Oscillator) System
 * Provides customizable oscillation for any parameter in the fluid-audio system
 */

export class LFO {
    constructor(options = {}) {
        this.enabled = options.enabled ?? false;
        this.waveform = options.waveform ?? 'sine'; // sine, triangle, square, sawtooth, noise
        this.rate = options.rate ?? 1.0; // Hz
        this.depth = options.depth ?? 0.5; // 0-1, how much of the range to use
        this.offset = options.offset ?? 0.5; // 0-1, center point
        this.phase = options.phase ?? 0; // 0-1, phase offset
        this.min = options.min ?? 0;
        this.max = options.max ?? 1;
        this.bipolar = options.bipolar ?? false; // if true, oscillates around offset, else from min to max
        this.sync = options.sync ?? false; // if true, resets phase on enable
        
        this.startTime = performance.now();
        this.lastValue = this.offset;
        
        // For noise waveform
        this.noiseValue = Math.random();
        this.noiseUpdateRate = 0.1; // seconds between noise updates
        this.lastNoiseUpdate = 0;
    }

    /**
     * Get the current LFO value
     * @param {number} timestamp - Current timestamp in milliseconds
     * @returns {number} The modulated value
     */
    getValue(timestamp) {
        if (!this.enabled) {
            return this.lastValue;
        }

        const elapsed = (timestamp - this.startTime) / 1000; // Convert to seconds
        const cyclePosition = (elapsed * this.rate + this.phase) % 1;
        
        let oscillatorValue;
        
        switch (this.waveform) {
            case 'sine':
                oscillatorValue = Math.sin(cyclePosition * Math.PI * 2);
                break;
            case 'triangle':
                oscillatorValue = cyclePosition < 0.5 
                    ? (cyclePosition * 4 - 1) 
                    : (3 - cyclePosition * 4);
                break;
            case 'square':
                oscillatorValue = cyclePosition < 0.5 ? -1 : 1;
                break;
            case 'sawtooth':
                oscillatorValue = (cyclePosition * 2) - 1;
                break;
            case 'noise':
                if (elapsed - this.lastNoiseUpdate > this.noiseUpdateRate) {
                    this.noiseValue = (Math.random() * 2) - 1;
                    this.lastNoiseUpdate = elapsed;
                }
                oscillatorValue = this.noiseValue;
                break;
            default:
                oscillatorValue = 0;
        }
        
        // Apply depth and offset
        let finalValue;
        if (this.bipolar) {
            // Bipolar mode: oscillate around the offset
            finalValue = this.offset + (oscillatorValue * this.depth * 0.5);
        } else {
            // Unipolar mode: scale from 0 to depth, then add offset
            const unipolar = (oscillatorValue + 1) * 0.5; // Convert -1,1 to 0,1
            finalValue = this.offset + ((unipolar - 0.5) * this.depth);
        }
        
        // Clamp to min/max bounds
        finalValue = Math.max(this.min, Math.min(this.max, finalValue));
        
        this.lastValue = finalValue;
        return finalValue;
    }

    /**
     * Reset the LFO phase
     */
    reset() {
        this.startTime = performance.now();
    }

    /**
     * Enable/disable the LFO
     */
    setEnabled(enabled, currentValue = null) {
        if (enabled && !this.enabled) {
            // When enabling, start from current parameter value
            if (currentValue !== null) {
                this.startFromValue(currentValue);
            } else if (this.sync) {
                this.reset();
            }
        }
        this.enabled = enabled;
    }
    
    /**
     * Start the LFO from a specific value by temporarily adjusting the offset
     */
    startFromValue(currentValue) {
        // Store the original offset so we can restore it later
        this.originalOffset = this.offset;
        
        // Clamp the current value to our range
        const clampedValue = Math.max(this.min, Math.min(this.max, currentValue));
        
        // Normalize the current value to 0-1 range
        const normalizedValue = (clampedValue - this.min) / (this.max - this.min);
        
        // Temporarily set the offset so that at phase 0, we start at the current value
        if (this.bipolar) {
            // In bipolar mode, offset is the center, so set it to current value
            this.offset = normalizedValue;
        } else {
            // In unipolar mode, adjust offset so that at the start of the cycle we're at current value
            // At phase 0, oscillator value is -1 (for sine) or 0 (for sawtooth)
            // We want: currentValue = offset + ((oscillatorAtPhase0 + 1) * 0.5 - 0.5) * depth
            let oscillatorAtPhase0;
            switch (this.waveform) {
                case 'sine':
                    oscillatorAtPhase0 = 0; // sin(0) = 0
                    break;
                case 'triangle':
                    oscillatorAtPhase0 = -1; // triangle starts at -1
                    break;
                case 'square':
                    oscillatorAtPhase0 = -1; // square starts at -1
                    break;
                case 'sawtooth':
                    oscillatorAtPhase0 = -1; // sawtooth starts at -1
                    break;
                default:
                    oscillatorAtPhase0 = 0;
            }
            
            // Calculate what offset would make us start at normalizedValue
            // normalizedValue = offset + ((oscillatorAtPhase0 + 1) * 0.5 - 0.5) * depth
            const unipolarAtPhase0 = (oscillatorAtPhase0 + 1) * 0.5;
            this.offset = normalizedValue - ((unipolarAtPhase0 - 0.5) * this.depth);
        }
        
        // Reset phase and timing for a clean start
        this.phase = 0;
        this.startTime = performance.now();
        
        // Set up a timer to restore the original offset after a short delay
        // This allows the LFO to start smoothly but then return to user's settings
        setTimeout(() => {
            if (this.originalOffset !== undefined) {
                const transitionDuration = 2000; // 2 seconds
                const startOffset = this.offset;
                const targetOffset = this.originalOffset;
                const startTime = performance.now();
                
                const restoreOffset = () => {
                    const elapsed = performance.now() - startTime;
                    const progress = Math.min(elapsed / transitionDuration, 1);
                    
                    // Smooth transition back to original offset
                    this.offset = startOffset + (targetOffset - startOffset) * progress;
                    
                    if (progress < 1) {
                        requestAnimationFrame(restoreOffset);
                    } else {
                        delete this.originalOffset;
                    }
                };
                
                requestAnimationFrame(restoreOffset);
            }
        }, 500); // Wait 0.5 seconds before starting transition
        
        console.log(`Starting LFO from value ${currentValue} (normalized: ${normalizedValue}), temp offset: ${this.offset}, original: ${this.originalOffset}`);
    }

    /**
     * Update LFO parameters
     */
    updateParams(params) {
        Object.assign(this, params);
        if (params.sync !== undefined && params.enabled && this.sync) {
            this.reset();
        }
    }

    /**
     * Get a serializable state of the LFO
     */
    getState() {
        return {
            enabled: this.enabled,
            waveform: this.waveform,
            rate: this.rate,
            depth: this.depth,
            offset: this.offset,
            phase: this.phase,
            min: this.min,
            max: this.max,
            bipolar: this.bipolar,
            sync: this.sync
        };
    }

    /**
     * Load state from a serializable object
     */
    setState(state) {
        this.updateParams(state);
    }
}

/**
 * LFO Manager - manages multiple LFOs for different parameters
 */
export class LFOManager {
    constructor() {
        this.lfos = new Map(); // paramName -> LFO instance
        this.baseValues = new Map(); // paramName -> original base value
        this.enabled = true;
    }

    /**
     * Create or get an LFO for a parameter
     */
    getLFO(paramName, options = {}) {
        if (!this.lfos.has(paramName)) {
            // Create a unique LFO with slightly different default phase for each parameter
            const paramHash = this.hashString(paramName);
            const uniquePhase = (paramHash % 100) / 100;
            const defaultOptions = {
                enabled: false,
                waveform: 'sine',
                rate: 0.01 + (paramHash % 10) * 0.001, // Much slower rates, slightly different
                depth: 0.5,
                offset: 0.5,
                phase: uniquePhase, // Unique phase per parameter
                min: 0,
                max: 1,
                bipolar: false,
                sync: false,
                ...options
            };
            
            console.log(`Creating new LFO for ${paramName} with hash ${paramHash}, phase ${uniquePhase}, rate ${defaultOptions.rate}`);
            this.lfos.set(paramName, new LFO(defaultOptions));
        }
        return this.lfos.get(paramName);
    }

    /**
     * Simple hash function to create unique values per parameter
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Set the base value for a parameter (the value it returns to when LFO is disabled)
     */
    setBaseValue(paramName, value) {
        this.baseValues.set(paramName, value);
    }

    /**
     * Get the base value for a parameter
     */
    getBaseValue(paramName) {
        return this.baseValues.get(paramName) ?? 0.5;
    }

    /**
     * Get the current modulated value for a parameter
     */
    getValue(paramName, timestamp) {
        if (!this.enabled) {
            return this.getBaseValue(paramName);
        }

        const lfo = this.lfos.get(paramName);
        if (!lfo || !lfo.enabled) {
            return this.getBaseValue(paramName);
        }

        return lfo.getValue(timestamp);
    }

    /**
     * Update all LFOs and return modulated values
     */
    updateAll(timestamp) {
        const values = {};
        for (const [paramName, lfo] of this.lfos) {
            if (this.enabled && lfo.enabled) {
                values[paramName] = lfo.getValue(timestamp);
            } else {
                values[paramName] = this.getBaseValue(paramName);
            }
        }
        return values;
    }

    /**
     * Enable/disable all LFOs
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    /**
     * Remove an LFO
     */
    removeLFO(paramName) {
        this.lfos.delete(paramName);
        this.baseValues.delete(paramName);
    }

    /**
     * Clear all LFOs
     */
    clear() {
        this.lfos.clear();
        this.baseValues.clear();
    }

    /**
     * Get all LFO states for serialization
     */
    getAllStates() {
        const states = {};
        for (const [paramName, lfo] of this.lfos) {
            states[paramName] = {
                lfo: lfo.getState(),
                baseValue: this.getBaseValue(paramName)
            };
        }
        return {
            enabled: this.enabled,
            parameters: states
        };
    }

    /**
     * Load all states from serialization
     */
    setAllStates(states) {
        this.enabled = states.enabled ?? true;
        this.clear();
        
        for (const [paramName, paramState] of Object.entries(states.parameters || {})) {
            const lfo = new LFO();
            lfo.setState(paramState.lfo);
            this.lfos.set(paramName, lfo);
            this.baseValues.set(paramName, paramState.baseValue);
        }
    }
}

// Waveform utility functions for visualization
export const WAVEFORMS = {
    sine: 'Sine',
    triangle: 'Triangle', 
    square: 'Square',
    sawtooth: 'Sawtooth',
    noise: 'Noise'
};

export function getWaveformSample(waveform, position) {
    switch (waveform) {
        case 'sine':
            return Math.sin(position * Math.PI * 2);
        case 'triangle':
            return position < 0.5 ? (position * 4 - 1) : (3 - position * 4);
        case 'square':
            return position < 0.5 ? -1 : 1;
        case 'sawtooth':
            return (position * 2) - 1;
        case 'noise':
            return (Math.random() * 2) - 1;
        default:
            return 0;
    }
}
