import { ShaderProgram } from "../glHelper.js";

const FS = /*glsl*/`
    #version 300 es
    precision highp float;
    in vec2 uv;
    uniform sampler2D uSource;
    uniform float uStart;
    uniform float uLength;
    uniform float uYOffset;
    out vec4 outValue;

    void main() {  
        float len = min(uLength, 1. - uStart);
        float xOffset = (uStart + uv.x) * len;
        outValue = texture(uSource, vec2(xOffset, uYOffset));
    }
`

export class ColorTexture {
    constructor({gl}) {
        this.PROPS = [
            ['ColorXStart', .5],
            ['ColorXLength', .75],
            ['ColorYDrift', .5],
        ]
        this.gl = gl
        this.pg = new ShaderProgram({gl, fs:FS})
        this.baseTexture = twgl.createTexture(gl, {src: 'static/images/color.jpg'})
        this.fbo = twgl.createFramebufferInfo(gl, [{internalFormat: gl.RGBA8, minMag: gl.LINEAR}], 2048, 1.)
        this.colorYOffset = .5
    }
    get texture() {
        return this.fbo.attachments[0]
    }
    update({timestamp, params}) {
        let yOffsetFreq = params.ColorYDrift
        this.colorYOffset += .001 * yOffsetFreq
        this.pg.execute({
            uSource: this.baseTexture,
            uStart: params.ColorXStart,
            uLength: params.ColorXLength,
            uYOffset: this.colorYOffset
        }, this.fbo)
    }
}
