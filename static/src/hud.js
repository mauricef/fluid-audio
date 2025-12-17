import { clamp01, toLogScale01 } from "./math.js"
import { SendChannel, RecieveChannel } from "./channel.js"

const MIDI_MAPPING_STR = '[["r1c1","s16"],["r1c2","s20"],["r1c3","s24"],["r1c4","s28"],["r1c5","s46"],["r1c6","s50"],["r1c7","s54"],["r1c8","s58"],["r2c1","s17"],["r2c2","s21"],["r2c3","s25"],["r2c4","s29"],["r2c5","s47"],["r2c6","s51"],["r2c7","s55"],["r2c8","s59"],["r2c9","b25"],["r3c1","s18"],["r3c2","s22"],["r3c3","s26"],["r3c4","s30"],["r3c5","s48"],["r3c6","s52"],["r3c7","s56"],["r3c8","s60"],["r3c9","b26"],["r4c1","b1"],["r4c2","b4"],["r4c3","b7"],["r4c4","b10"],["r4c5","b13"],["r4c6","b16"],["r4c7","b19"],["r4c8","b22"],["r4c9","b27"],["r5c1","b3"],["r5c2","b6"],["r5c3","b9"],["r5c4","b12"],["r5c5","b15"],["r5c6","b18"],["r5c7","b21"],["r5c8","b24"],["r6c1","s19"],["r6c2","s23"],["r6c3","s27"],["r6c4","s31"],["r6c5","s49"],["r6c6","s53"],["r6c7","s57"],["r6c8","s61"],["r6c9","s62"]]'


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

        // Add launch server button
        this.createLaunchButton()

        this.canvas = canvas
        this.hudChannel = new RecieveChannel('Hud', this)
        this.serverChannel = new SendChannel('Server')
        this.serverChannel.send('HudRequestProps')
        this.midi = new MidiMapper(MIDI_MAPPING_STR)
        this.midi.onMidiButtonDown = this.onMidiButtonDown.bind(this)
        this.midi.onMidiButtonUp = this.onMidiButtonUp.bind(this)
        this.midi.onMidiValueChanged = this.onMidiValueChanged.bind(this)
        this.midi.load()
    }
    createLaunchButton() {
        const button = document.createElement('button')
        button.textContent = 'Launch Server'
        button.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            padding: 20px 40px;
            font-size: 24px;
            font-weight: bold;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            z-index: 1000;
        `
        button.onmouseover = () => button.style.backgroundColor = '#45a049'
        button.onmouseout = () => button.style.backgroundColor = '#4CAF50'
        button.onclick = () => {
            window.open(window.location.origin + window.location.pathname + '?mode=server', '_blank')
        }
        document.body.appendChild(button)
        this.launchButton = button
    }
    onMidiButtonDown(gridKey) {
        console.log(['onMidiButtonDown', gridKey])
        let controllerMapping = this.midiPropertyMapping[gridKey]
        if (controllerMapping) {
            this.params[controllerMapping.propertyName]()   
        }
    }
    onMidiButtonUp(gridKey) {
        console.log(['onMidiButtonUp', gridKey])
    }
    onMidiValueChanged(gridKey, value) {
        let controllerMapping = this.midiPropertyMapping[gridKey]
        if (controllerMapping) {
            this.updateParameter(controllerMapping.propertyName, value / 128)
            controllerMapping.controller.updateDisplay()    
        }
    }
    
    updateParameter(key, value) {
        this.params[key] = value
        this.serverChannel.send('HudParameterChange', {key, value})
        console.log({key, value})
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
        // Hide launch button when server is running
        if (this.launchButton) {
            this.launchButton.remove()
            this.launchButton = null
        }
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