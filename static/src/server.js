import { AudioTexture, connectAudioDeviceOutput, loadAudioDeviceSource, loadAudioFileSource} from "./media/index.js"
import { calculateAspectRatio } from "./ui/index.js"
import { SendChannel, RecieveChannel } from "./channel.js";
import { FluidApp } from "./shaders/fluid/fluid.js"
import { JetEmitter } from "./apps/soak/jetEmitter.js";
import { SimpleEmitterKernel } from "./emitters/simpleEmitter.js"
import { RingEmitter } from "./emitters/ringEmitter.js";
import { SimpleJetApp } from "./apps/simpleJetApp.js";
import { SoakApp } from "./apps/soak/soakApp.js"
import { GridApp } from "./apps/gridApp.js"
import { HistApp } from "./apps/histApp.js"
import { ColorTexture } from "./media/colorTexture.js";
import { Mp4Recorder } from "./media/mp4Recorder.js";

function downloadBlob(filename, blob) {
    let url = window.URL.createObjectURL(blob)
    let a = document.createElement("a")
    a.style.display = "none"
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
}

const FLUID_PARAMS = {
    DT: 1/60,
    SIM_SCALE: 2,
    SUBSTEPS: 4,
    PRESSURE_STEPS: 16
}

// const FLUID_PARAMS = {
//     DT: .1,
//     SIM_SCALE: 1,
//     SUBSTEPS: 1,
//     PRESSURE_STEPS: 16
// }


class Server {
    constructor(canvas) {
        const gl = canvas.getContext("webgl2")
        
        gl.getExtension("EXT_color_buffer_float")
        gl.getExtension("OES_texture_float_linear")
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
       
        this.gl = gl
        this.canvas = canvas
        this.hudChannel = new SendChannel('Hud')
        this.serverChannel = new RecieveChannel('Server', this)
        this.PROPS = []
        this.apps = {
            'soak': () => new SoakApp({gl, fluidParams: FLUID_PARAMS}),
            'grid': () => new GridApp({gl}),
            'hist': () => new HistApp({gl}),
        }
        this.selectedApp = 'soak'
        this.app = this.apps[this.selectedApp]()
        this.PROPS = this.app.PROPS
        this.PROPS = this.PROPS.concat([
            ['AudioStart', .1],
            ['AudioLength', .1],
            ['AudioGain', .5],
        ])
        // Add ColorTexture PROPS here to ensure consistent initialization
        this.PROPS = this.PROPS.concat([
            ['ColorXStart', .5],
            ['ColorXLength', .75],
            ['ColorYDrift', .5],
        ])
        this.params = {}

    // --- NEW: bind + register the resize handler ---------------------------
    this._onResize = this._onResize.bind(this);
    window.addEventListener("resize", this._onResize, { passive: true });
    window.addEventListener("orientationchange", this._onResize, { passive: true });
    // -----------------------------------------------------------------------
  }

  /* -------- NEW: resize logic (rAF-throttled) ----------------------------- */
  _onResize() {
    // avoid flooding; coalesce events into one per frame
    if (this._resizePending) return;
    this._resizePending = true;

    requestAnimationFrame(() => {
      this._resizePending = false;

      const w   = window.innerWidth;
      const h   = window.innerHeight;

      if (w === this.canvas.width && h === this.canvas.height) return; // no change

      this.canvas.width  = w;
      this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);

      // If the active “app” exposes a resize() hook, call it
      if (typeof this.app.resize === "function") {
        this.app.resize({ width: w, height: h, dpr });
      }
    });
  }
  /* ------------------------------------------------------------------------ */

  /* Remember to remove listeners if you ever add a dispose() method:
     window.removeEventListener("resize", this._onResize);
     window.removeEventListener("orientationchange", this._onResize);
  */
    
    sendProps() {
        this.hudChannel.send('ServerSendProps', {
            props: this.PROPS
        })
    }
    onHudParameterChange({key, value}) {
        this.params[key] = value
    }
    onHudRequestProps() {
        this.sendProps()
    }
    onHudRequestServerReload() {
        location.reload()
    }
    async onHudRequestRecordStart() {
        console.log('onHudRequestRecordStart')
        let recorder = new Mp4Recorder({
            canvas: this.canvas,
            fps: 30,
            audioSource: this.audioSource,
        })
        await recorder.init()
        this.recorder = recorder
    }
    async onHudRequestRecordStop() {
        console.log('onHudRequestRecordStop') 
        let recorder = this.recorder
        this.recorder = null
        let blob = await recorder.finish()  
        downloadBlob('out.mp4', blob)
    }
    async run() {
        let {gl, canvas} = this
        const audioContext = new AudioContext()
        
        try {
            // First request permission explicitly
            await navigator.mediaDevices.getUserMedia({ audio: true });
            
            this.audioSource = await loadAudioDeviceSource({
                context: audioContext,
            });
        } catch (error) {
            console.error('Microphone access denied or not available:', error);
            // Handle the error appropriately
        }
        const gainNode = audioContext.createGain()
        const audioAnalyzer = new AnalyserNode(audioContext, {
            smoothingTimeConstant: .75,
            fftSize: 2**10,    
        })
        this.audioSource.connect(gainNode).connect(audioAnalyzer)
        gainNode.gain.setValueAtTime(1.5, audioContext.currentTime)
        this.audioTexture = new AudioTexture({gl, analyzer: audioAnalyzer})
        this.colorTexture = new ColorTexture({gl})
        requestAnimationFrame(this.render.bind(this))
        
        this.PROPS.forEach(([n, d]) => {
            this.params[n] = d
        })
        this.sendProps()
    }
    get canvasSize() {
        let {canvas} = this
        return [canvas.width, canvas.height]
    }
    get canvasAspectRatio() {
        return calculateAspectRatio(this.canvasSize)
    }
    render(timestamp) {
        let {params} = this
        this.hudChannel.send('ServerRenderBegin')

        this.audioTexture.update(params)
        this.colorTexture.update({timestamp, params})

        let audioBuffer = this.audioTexture.textureBuffer
        let isFinite = audioBuffer.every(Number.isFinite)
        if (isFinite) {    
            this.app.execute({
                timestamp: timestamp,
                params: this.params,
                audioPowerTexture: this.audioTexture.texture,
                colorTexture: this.colorTexture.texture
            }) 
        }
        if (this.recorder) {
            this.recorder.captureFrame()
        }
        this.hudChannel.send('ServerRenderEnd')
        requestAnimationFrame(this.render.bind(this))
    }
}
export async function run() {
    var running = false
    const canvas = document.querySelector('canvas')
    let server = new Server(canvas)
    //server.run()
    canvas.onclick = () => {
        if (!running) {
            server.run()
            running = true
        }
    }
}