import { clamp01, toLogScale01 } from "./math.js"
import { SendChannel, RecieveChannel } from "./channel.js"

const MIDI_MAPPING_STR = '[["r1c1","s16"],\
["r1c2","s20"],\
["r1c3","s24"],\
["r1c4","s28"],\
["r1c5","s46"],\
["r1c6","s50"],\
["r1c7","s54"],\
["r1c8","s58"],\
["r2c1","s55"],\
["r2c2","s59"],\
["r2c7","s48"],\
["r2c3","s18"],\
["r2c4","s22"],\
["r2c5","s26"],\
["r2c6","s30"],\
["r2c8","s19"],\
["r3c1","s23"],\
["r3c2","s27"],\
["r3c3","s31"],\
["r3c4","s49"],\
["r3c5","s53"],\
["r3c6","s57"],\
["r3c7","s61"]]'


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
        let midiInput = midiInputs[0]
        if (midiInput) {
            midiInput.onmidimessage  = this.onMidiMessage.bind(this)
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
    
    updateParameter(key, value) {
        this.params[key] = value
        this.serverChannel.send('HudParameterChange', {key, value})
        // console.log({key, value})
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
        this.midiPropertyMapping = {}
        this.gui = new dat.GUI()
        this.gui.enableMidi() 
        this.params = {
            'ReloadServer': () => {
                this.serverChannel.send('HudRequestServerReload')
            },
            "RecordStart": () => {
                this.serverChannel.send('HudRequestRecordStart')
            },
            "RecordStop": () => {
                this.serverChannel.send('HudRequestRecordStop')
            }
        }
        this.gui.add(this.params, 'ReloadServer')
        this.gui.add(this.params, 'RecordStart')
        this.gui.add(this.params, 'RecordStop')
        props.forEach(([n, d]) => {           
            this.params[n] = d
            let controller = this.gui.add(this.params, n, 0, 1, 1/128)
            controller.onChange(() => {
                this.updateParameter(n, this.params[n])
            })
        })

        var sliderCount = 0
        var buttonCount = 0
        for (let i = 0; i < this.gui.__controllers.length; i++) {
            let controller = this.gui.__controllers[i]
            let propertyName = controller.property
            let propertyValue = this.params[propertyName]
            let isFunction = typeof propertyValue == 'function'
            var gridKey = null
            if (isFunction) {
                gridKey = this.midi.sortedButtonKeys[buttonCount]
                buttonCount++
            }
            else {
                gridKey = this.midi.sortedSliderKeys[sliderCount]
                sliderCount++
            }
            controller.name(`${gridKey} - ${controller.property}`)
            this.midiPropertyMapping[gridKey] = {
                controller: controller,
                propertyName: controller.property,
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