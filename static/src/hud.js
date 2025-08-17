import { clamp01, toLogScale01 } from "./math.js"
import { SendChannel, RecieveChannel } from "./channel.js"
import { LFOManager } from "./lfo.js"
import { LFOPanel } from "./ui/lfoPanel.js"

const MIDI_MAPPING_STR = '[["r1c1","s16"],\
["r1c2","s20"],\
["r1c3","s24"],\
["r1c4","s28"],\
["r1c5","s46"],\
["r1c6","s50"],\
["r1c7","s54"],\
["r1c8","s58"],\
["r2c1","s17"],\
["r2c2","s21"],\
["r2c3","s25"],\
["r2c4","s29"],\
["r2c5","s47"],\
["r2c6","s51"],\
["r2c7","s59"],\
["r2c8","s18"],\
["r3c1","s22"],\
["r3c2","s26"],\
["r3c3","s30"],\
["r3c4","s48"],\
["r3c5","s52"],\
["r3c6","s56"],\
["r3c7","s60"]]'

class MidiMapper {
    constructor(midiMappingString) {
        this.midiMap = {}
        this.midiMapReverse = {}
        this.midiIsDown = {}
        let rawMidiMappings = JSON.parse(midiMappingString)
        rawMidiMappings.forEach(([grid, midi]) => {
            this.midiMap[midi] = grid
            this.midiMapReverse[grid] = midi
        })
        this.sortedKeys = Object.values(this.midiMap).sort()
        this.sortedSliderKeys = this.sortedKeys.filter(k => this.midiMapReverse[k][0] == 's')
        this.sortedButtonKeys = this.sortedKeys.filter(k => this.midiMapReverse[k][0] == 'b')
    }
    async load() {
        let midiAccess = await navigator.requestMIDIAccess()
        let midiInputs = []
        midiAccess.inputs.forEach((e) => midiInputs.push(e))
        
        // Connect to ALL MIDI controllers, not just the first one
        midiInputs.forEach((midiInput, index) => {
            console.log(`Connecting to MIDI controller ${index + 1}: ${midiInput.name}`)
            midiInput.onmidimessage = this.onMidiMessage.bind(this)
        })
        
        if (midiInputs.length === 0) {
            console.log('No MIDI controllers found')
        } else {
            console.log(`Connected to ${midiInputs.length} MIDI controller(s)`)
        }
    }
    onMidiMessage(midiMessage) {
        let [messageType, channel, value] = midiMessage.data
        let controlType = messageType == 176 ? 's' : 'b'
        let midiKey = `${controlType}${channel}`
        let gridKey = this.midiMap[midiKey]
        if (messageType == 144) {
            if (!this.midiIsDown[gridKey]) {
                this.midiIsDown[gridKey] = true
                this.onMidiButtonDown(gridKey)
            }
        }
        else if (messageType == 128) {
            if (this.midiIsDown[gridKey]) {
                this.midiIsDown[gridKey] = false
                this.onMidiButtonUp(gridKey)
            }
        }
        else if (messageType == 176) {
            this.onMidiValueChanged(gridKey, value)
        }
    }
}

class Hud {
    constructor() {
        const canvas = document.querySelector('canvas')
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        this.stats = Stats()
        this.stats.showPanel(0)
        document.body.appendChild(this.stats.dom)
        
        this.canvas = canvas
        this.midiHighlightTimeouts = {}; // To manage highlight timeouts
        this.hudChannel = new RecieveChannel('Hud', this)
        this.serverChannel = new SendChannel('Server')
        this.serverChannel.send('HudRequestProps')
        this.midi = new MidiMapper(MIDI_MAPPING_STR)
        this.midi.onMidiButtonDown = this.onMidiButtonDown.bind(this)
        this.midi.onMidiButtonUp = this.onMidiButtonUp.bind(this)
        this.midi.onMidiValueChanged = this.onMidiValueChanged.bind(this)
        this.midi.load()
        
        // Initialize LFO system
        this.lfoManager = new LFOManager()
        this.lfoPanels = new Map() // paramName -> LFOPanel
        this.lastLFOUpdate = 0
        this.lfoUpdateInterval = 16 // ~60fps
        
        // Start LFO update loop
        this.startLFOLoop()
    }

    onMidiButtonDown(gridKey) {
        let controllerMapping = this.midiPropertyMapping[gridKey];
        if (controllerMapping && typeof this.params[controllerMapping.propertyName] === 'function') {
            this.params[controllerMapping.propertyName]();
            this.applyMidiHighlight(gridKey); // Apply highlight
        }
    }
    
    onMidiButtonUp(gridKey) {
      console.log(['onMidiButtonUp', gridKey])
      return;
    }

    onMidiValueChanged(gridKey, value) {
        let controllerMapping = this.midiPropertyMapping[gridKey];
        if (controllerMapping) {
            this.updateParameter(controllerMapping.propertyName, value / 128);
            if (controllerMapping.controller && typeof controllerMapping.controller.updateDisplay === 'function') {
                controllerMapping.controller.updateDisplay();
            }
            this.applyMidiHighlight(gridKey); // Apply highlight
        }
    }

    applyMidiHighlight(gridKey) {
        if (!this.midiPropertyMapping || !this.midiPropertyMapping[gridKey]) {
            return;
        }

        const controller = this.midiPropertyMapping[gridKey].controller;
        if (controller && controller.domElement) {
            const domElement = controller.domElement;

            // Clear any existing timeout for this specific element to prevent flickering
            if (this.midiHighlightTimeouts[gridKey]) {
                clearTimeout(this.midiHighlightTimeouts[gridKey]);
            }

            domElement.classList.add('midi-highlight');

            // Set a new timeout to remove the class
            this.midiHighlightTimeouts[gridKey] = setTimeout(() => {
                domElement.classList.remove('midi-highlight');
                delete this.midiHighlightTimeouts[gridKey]; // Clean up
            }, 500); // Highlight duration in milliseconds (e.g., 500ms = 0.5 seconds)
        }
    }
    
    updateParameter(key, value, fromLFO = false) {
        this.params[key] = value
        
        // Update base value for LFO if this is a manual change
        if (!fromLFO) {
            this.lfoManager.setBaseValue(key, value)
        }
        
        this.serverChannel.send('HudParameterChange', {key, value})
        console.log(`Parameter updated: ${key} = ${value} (fromLFO: ${fromLFO})`); // Debug log
    }
    
    startLFOLoop() {
        const updateLFOs = (timestamp) => {
            if (timestamp - this.lastLFOUpdate >= this.lfoUpdateInterval) {
                const lfoValues = this.lfoManager.updateAll(timestamp)
                
                // Send LFO-modulated values to server
                for (const [key, value] of Object.entries(lfoValues)) {
                    if (this.lfoManager.getLFO(key).enabled) {
                        this.params[key] = value
                        this.serverChannel.send('HudParameterChange', {key, value})
                        
                        // Update controller display if it exists
                        const controller = this.getControllerByProperty(key)
                        if (controller && typeof controller.updateDisplay === 'function') {
                            controller.updateDisplay()
                        }
                    }
                }
                
                this.lastLFOUpdate = timestamp
            }
            
            requestAnimationFrame(updateLFOs)
        }
        
        requestAnimationFrame(updateLFOs)
    }
    
    getControllerByProperty(propertyName) {
        if (!this.gui || !this.gui.__controllers) return null
        return this.gui.__controllers.find(c => c.property === propertyName)
    }
    
    createLFOPanel(paramName) {
        if (this.lfoPanels.has(paramName)) {
            return this.lfoPanels.get(paramName)
        }
        
        const controller = this.getControllerByProperty(paramName)
        if (!controller || !controller.domElement) {
            console.warn(`Could not create LFO panel for ${paramName}: controller not found`)
            return null
        }
        
        console.log(`Creating LFO panel for parameter: ${paramName}`)
        
        // Find the control section (not the label) to attach the LFO panel
        const controlSection = controller.domElement.querySelector('.c') || controller.domElement
        
        // Create container for LFO panel and append to the end of the row
        const container = document.createElement('div')
        container.className = 'lfo-container'
        controller.domElement.appendChild(container)
        
        const panel = new LFOPanel(container, paramName, this.lfoManager, () => {
            // This callback is called when LFO settings change
            console.log(`LFO settings changed for ${paramName}`)
        }, this) // Pass the HUD instance so panel can access current values
        
        this.lfoPanels.set(paramName, panel)
        return panel
    }
    
    destroyLFOPanels() {
        for (const panel of this.lfoPanels.values()) {
            panel.destroy()
        }
        this.lfoPanels.clear()
    }
    
    resetToDefaults() {
        // Reset all parameters to their default values
        Object.keys(this.defaultValues).forEach(key => {
            const defaultValue = this.defaultValues[key]
            this.params[key] = defaultValue
            this.lfoManager.setBaseValue(key, defaultValue)
            this.serverChannel.send('HudParameterChange', {key, value: defaultValue})
        })
        
        // Update all controller displays to reflect the reset values
        this.gui.__controllers.forEach(controller => {
            if (controller.property in this.defaultValues) {
                controller.updateDisplay()
            }
        })
    }
    
    resetParameter(paramName, defaultValue) {
        // Reset a single parameter to its default value
        this.params[paramName] = defaultValue
        this.lfoManager.setBaseValue(paramName, defaultValue)
        this.serverChannel.send('HudParameterChange', {key: paramName, value: defaultValue})
        
        // Update the specific controller display
        const controller = this.getControllerByProperty(paramName)
        if (controller) {
            controller.updateDisplay()
        }
    }
    
    addResetButton(controller, paramName, defaultValue) {
        // Create a reset button for individual parameters
        const resetButton = document.createElement('button')
        resetButton.className = 'param-reset-btn'
        resetButton.innerHTML = '↻'
        resetButton.title = `Reset ${paramName} to default (${defaultValue.toFixed(3)})`
        resetButton.onclick = (e) => {
            e.stopPropagation()
            this.resetParameter(paramName, defaultValue)
        }
        
        // Find the LFO container and add the reset button to it
        const controllerElement = controller.domElement
        if (controllerElement) {
            // Look for the LFO container that should be added later
            setTimeout(() => {
                const lfoContainer = controllerElement.querySelector('.lfo-container')
                if (lfoContainer) {
                    const lfoHeader = lfoContainer.querySelector('.lfo-header')
                    if (lfoHeader) {
                        // Add reset button to the LFO header alongside LFO toggle and expand buttons
                        lfoHeader.appendChild(resetButton)
                    }
                }
            }, 150) // Slightly longer delay to ensure LFO container is created
        }
    }
    onMessage(event) {
        let {name, context} = event.data
        let key = `on${name}`
        if (key in this) {
            this[key](context)
        }
        else {
            console.log(key)
        }
    }
    async onServerSendProps({props}) {
        if (this.gui) {
            this.gui.destroy()
            this.gui = null
        }
        
        // Destroy existing LFO panels
        this.destroyLFOPanels()
        
        this.midiPropertyMapping = {}
        this.gui = new dat.GUI({
            width: 600  // Make the GUI panel wider (default is ~245px)
        })
        this.gui.enableMidi() 
        
        // Store default values for reset functionality
        this.defaultValues = {}
        props.forEach(([name, defaultValue]) => {
            this.defaultValues[name] = defaultValue
            // Initialize base values in LFO manager
            this.lfoManager.setBaseValue(name, defaultValue)
        })
        
        this.params = {
            'ReloadServer': () => {
                this.serverChannel.send('HudRequestServerReload')
            },
            "RecordStart": () => {
                this.serverChannel.send('HudRequestRecordStart')
            },
            "RecordStop": () => {
                this.serverChannel.send('HudRequestRecordStop')
            },
            "Reset": () => {
                this.resetToDefaults()
            },
            "LFO Master": () => {
                this.lfoManager.setEnabled(!this.lfoManager.enabled)
            }
        }
        this.gui.add(this.params, 'ReloadServer')
        this.gui.add(this.params, 'RecordStart')
        this.gui.add(this.params, 'RecordStop')
        this.gui.add(this.params, 'Reset')
        this.gui.add(this.params, 'LFO Master')
        
        props.forEach(([n, d]) => {           
            this.params[n] = d
            let controller = this.gui.add(this.params, n, 0, 1, 1/128)
            controller.onChange(() => {
                this.updateParameter(n, this.params[n])
            })
            
            // Add individual reset button for this parameter
            this.addResetButton(controller, n, d)
        })
        
        // Add LFO panels after a short delay to ensure DOM is ready
        setTimeout(() => {
            props.forEach(([n, d]) => {
                this.createLFOPanel(n)
            })
        }, 100)

        var sliderCount = 0
        var buttonCount = 0
        for (let i = 0; i < this.gui.__controllers.length; i++) {
            let controller = this.gui.__controllers[i]
            let propertyName = controller.property
            let propertyValue = this.params[propertyName]
            let isFunction = typeof propertyValue == 'function'
            var gridKey = null
            if (isFunction) {
                // Only assign MIDI mapping if we have button keys available
                if (buttonCount < this.midi.sortedButtonKeys.length) {
                    gridKey = this.midi.sortedButtonKeys[buttonCount]
                    controller.name(`${gridKey} - ${controller.property}`)
                    this.midiPropertyMapping[gridKey] = {
                        controller: controller,
                        propertyName: controller.property,
                    }
                }
                buttonCount++
            }
            else {
                // Only assign MIDI mapping if we have slider keys available
                if (sliderCount < this.midi.sortedSliderKeys.length) {
                    gridKey = this.midi.sortedSliderKeys[sliderCount]
                    controller.name(`${gridKey} - ${controller.property}`)
                    this.midiPropertyMapping[gridKey] = {
                        controller: controller,
                        propertyName: controller.property,
                    }
                }
                sliderCount++
            }
        }
    }

    onServerRenderBegin() {
        this.stats.begin()
    }

    onServerRenderEnd() {
        this.stats.end()
    }
}

var hud = null
export async function run() {
    hud = new Hud()
}