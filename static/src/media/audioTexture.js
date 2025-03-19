import { toLogScale01, dbToPower, powerToDb, fromLogScale01} from "../math.js"
import { ShaderProgram } from "/static/src/glHelper.js";

const FS = /*glsl*/`
    #version 300 es
    precision highp float;
    in vec2 uv;
    uniform sampler2D uAudioSource;
    uniform float uStart;
    uniform float uLength;
    uniform float uGain;
    out vec4 audioOut;

    void main() {  
        float len = min(uLength, 1. - uStart);
        float offset = (uStart + uv.x) * len;
        float audioIn = texture(uAudioSource, vec2(offset, .5)).r;
        audioOut = vec4(audioIn * uGain);
    }
`

const MAX_GAIN = 10

export class AudioTexture {
    constructor({gl, analyzer}) {
        this.gl = gl
        this.pg = new ShaderProgram({gl, fs:FS})
        this.analyzer = analyzer
        this.bufferLength = analyzer.frequencyBinCount
        this.audioBuffer = new Float32Array(this.bufferLength)
        this.byteFrequencyData = new Uint8Array(this.bufferLength)
        this.textureBuffer = new Float32Array(this.bufferLength)
        this.textureOptions = {width: this.bufferLength, height: 1, internalFormat: gl.R32F, auto: true}
        this.tmpTexture = twgl.createTexture(gl, this.textureOptions)
        this.fbo = twgl.createFramebufferInfo(gl, [{internalFormat: gl.R32F, minMag: gl.LINEAR}])
    }
    get texture() {
        return this.fbo.attachments[0]
    }
    update(params) {
        let {gl, analyzer, bufferLength, audioBuffer, textureBuffer, textureOptions} = this        
        /* Normalize and bucket audio frequency data and place it in a texture*/
        //analyzer.getFloatFrequencyData(audioBuffer)
        analyzer.getByteFrequencyData(this.byteFrequencyData)
        let min = Math.min.apply(null, audioBuffer)
        let max = Math.max.apply(null, audioBuffer)
        
        for (let i = 0; i < bufferLength; i++) {
            textureBuffer[i] = this.byteFrequencyData[i] / 255 //audioBuffer[i] // (audioBuffer[i] - min) / Math.max((max - min), 1e-4)
        }
        twgl.setTextureFromArray(gl, this.tmpTexture, textureBuffer, textureOptions)
        this.pg.execute({
            uAudioSource: this.tmpTexture,
            uGain: params.AudioGain * MAX_GAIN,
            uStart: params.AudioStart,
            uLength: params.AudioLength
        }, this.fbo)
    }
}
