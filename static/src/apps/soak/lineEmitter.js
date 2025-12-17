import { calculateAspectRatio } from "../../ui/index.js"
import { ShaderProgram } from "../../glHelper.js";
import { GridApp } from "../gridApp.js";
import { SplatShader } from "./jetEmitter.js";

const VELOCITY_MAGNITUDE_MAX = 1

// Line location shader - positions emitters along a horizontal line
const locationFS = /*glsl*/`
    #version 300 es
    precision highp float;

    in vec2 uv;
    uniform float uLineY;
    uniform float uLineWidth;
    uniform float uLineOffset;
    out vec4 location;

    void main() 
    {
        // Position along line from -lineWidth/2 to +lineWidth/2
        float x = (uv.x - 0.5) * uLineWidth + uLineOffset;
        float y = uLineY;
        location = vec4(x, y, 0., 1.);
    }
`

const colorRadiusFS = /*glsl*/`
    #version 300 es
    precision highp float;

    in vec2 uv;
    uniform sampler2D uAudioPowerTexture;
    uniform float uMax;
    uniform float uMinLevel;
    out vec4 outRadius;

    void main() 
    {   
        float frequencyStrength = texture(uAudioPowerTexture, uv).r;
        frequencyStrength = max(frequencyStrength, uMinLevel);
        float radius = uMax * frequencyStrength;
        outRadius = vec4(vec3(radius), 1.);
    }
`

const velocityRadiusFS = /*glsl*/`
    #version 300 es
    precision highp float;
    in vec2 uv;

    uniform float uScale;
    uniform sampler2D uRadiusTexture;
    out vec4 outRadius;

    void main() 
    {   
        float baseRadius = texture(uRadiusTexture, uv).r;
        float radius = uScale * baseRadius;
        outRadius = vec4(vec3(radius), 1.);
    }
`

const colorFS = /*glsl*/`
    #version 300 es
    precision highp float;

    in vec2 uv;
    out vec4 color;

    vec3 hsv2rgb(vec3 c)
    {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    void main() 
    {   
        vec3 hsv = vec3(uv.x, 1., 1.);
        vec3 rgb = hsv2rgb(hsv);
        color = vec4(rgb, 1.);
    }
`

const velocityVectorFS = /*glsl*/`
    #version 300 es
    precision highp float;

    #define PI 3.1415927
    in vec2 uv;
    uniform sampler2D uAudioPowerTexture;
    uniform float uMagnitude;
    uniform float uDirection;
    uniform float uMinLevel;

    out vec4 velocity;

    void main() 
    {   
        float frequencyStrength = texture(uAudioPowerTexture, uv).r;
        frequencyStrength = max(frequencyStrength, uMinLevel);
        float magnitude = .1 * uMagnitude * frequencyStrength;
        
        // Direction: 0 = up, 0.25 = right, 0.5 = down, 0.75 = left
        float theta = 2. * PI * uDirection;
        vec2 vXY = magnitude * vec2(cos(theta), sin(theta));
        velocity = vec4(vXY, 0., 1.);
    }
`

const MAX_LINE_COUNT = 256

export class LineEmitter {
    constructor({gl, canvas, size}) {
        this.gridApp = new GridApp({gl})
        
        this.PROPS = [
            ['LineColorAlpha', 0],
            ['LineSourceSize', .5],
            ['LineMinLevel', 0.],
            ['LineY', 0.5],
            ['LineWidth', 1.],
            ['LineOffset', 0.5], // 0.5 = no movement, <0.5 = left, >0.5 = right
            ['LineLength', .25],
            ['LineSpeed', .5],
            ['LineDirection', 0.25] // 0=up, 0.25=right, 0.5=down, 0.75=left
        ]
        this.PROPS = this.PROPS.concat(this.gridApp.PROPS)

        let aspectRatio = calculateAspectRatio(size)
        this.gl = gl
        
        this.locationShader = new ShaderProgram({gl, fs: locationFS})
        this.colorRadiusShader = new ShaderProgram({gl, fs: colorRadiusFS})
        this.colorShader = new ShaderProgram({gl, fs: colorFS})
        this.colorFbi = twgl.createFramebufferInfo(gl, [{}], MAX_LINE_COUNT, 1)
        this.velocityRadiusShader = new ShaderProgram({gl, fs: velocityRadiusFS})
        this.velocityVectorShader = new ShaderProgram({gl, fs: velocityVectorFS})

        this.colorBuffer = twgl.createFramebufferInfo(gl, [{internalFormat: gl.RGBA16F}], size[0], size[1])
        this.velocityBuffer = twgl.createFramebufferInfo(gl, [{internalFormat: gl.RG16F}], size[0], size[1])

        this.colorEmitter = new SplatShader({
            gl, 
            blend: gl.ONE_MINUS_SRC_ALPHA,
            aspectRatio, 
        })

        this.velocityEmitter = new SplatShader({
            gl, 
            blend: gl.ONE,
            aspectRatio, 
        })   

        this.lineOffset = 0
    }
    
    ensureBuffers(lineCount) {
        let {gl} = this
        if (this.lastCount != lineCount) {
            this.locationFbi = twgl.createFramebufferInfo(gl, [{internalFormat: gl.RG32F}], lineCount, 1)
            this.colorRadiusFbi = twgl.createFramebufferInfo(gl, [{internalFormat: gl.R32F}], lineCount, 1)
            this.colorFbi = twgl.createFramebufferInfo(gl, [{}], lineCount, 1)
            this.velocityRadiusFbi = twgl.createFramebufferInfo(gl, [{internalFormat: gl.R32F}], lineCount, 1)
            this.velocityVectorFbi = twgl.createFramebufferInfo(gl, [{internalFormat: gl.RG32F}], lineCount, 1)
            this.lastCount = lineCount
        }
    }
    
    execute({timestamp, params, audioPowerTexture, colorTexture}) {
        let LINE_COUNT = params.LineCount * MAX_LINE_COUNT
        this.ensureBuffers(LINE_COUNT)
        let {gl} = this

        // Animate line offset if desired
        let lineOffsetFreq = -1 * (2 * params.LineOffset - 1)
        lineOffsetFreq = (Math.abs(lineOffsetFreq) < .1) ? 0 : lineOffsetFreq
        
        if (lineOffsetFreq === 0) {
            // No animation - reset to center
            this.lineOffset = 0.5
        } else {
            // Animate the offset
            this.lineOffset += lineOffsetFreq * .01
            this.lineOffset = this.lineOffset - Math.floor(this.lineOffset) // Keep between 0 and 1
        }

        this.locationShader.execute({
            uLineY: (params.LineY - 0.5) * 2, // Convert from 0-1 to -1 to 1
            uLineWidth: params.LineWidth * 2, // Full canvas width when = 1
            uLineOffset: (this.lineOffset - 0.5) * 0.3, // Oscillate around center, keep bounded
        }, this.locationFbi)

        this.colorShader.execute({}, this.colorFbi)

        let maxLineRadius = .5 * params.LineWidth / LINE_COUNT
        this.colorRadiusShader.execute({
            uMax: maxLineRadius * params.LineSourceSize,
            uAudioPowerTexture: audioPowerTexture,
            uMinLevel: params.LineMinLevel
        }, this.colorRadiusFbi)

        this.velocityRadiusShader.execute({
            uScale: params.LineLength,
            uRadiusTexture: this.colorRadiusFbi.attachments[0],
        }, this.velocityRadiusFbi)

        this.velocityVectorShader.execute({
            uMagnitude: VELOCITY_MAGNITUDE_MAX * params.LineSpeed,
            uAudioPowerTexture: audioPowerTexture,
            uDirection: params.LineDirection,
            uMinLevel: params.LineMinLevel
        }, this.velocityVectorFbi)
       
        twgl.bindFramebufferInfo(this.gl, this.colorBuffer)
        this.gl.clear(gl.COLOR_BUFFER_BIT)
        twgl.bindFramebufferInfo(this.gl, null)
        
        if (params.LineColorAlpha > 0) {
            this.colorEmitter.render({
                radiusTexture: this.colorRadiusFbi.attachments[0],
                locationTexture: this.locationFbi.attachments[0],
                valueTexture: colorTexture
            }, this.colorBuffer, params.LineColorAlpha, Math.ceil(LINE_COUNT))
        }

        if (params.BlockAlpha > 0) {
            this.gridApp.execute({
                timestamp, 
                params,
                audioPowerTexture: audioPowerTexture,
                colorTexture: colorTexture
            }, this.colorBuffer)
        }

        this.velocityEmitter.render({
            radiusTexture: this.velocityRadiusFbi.attachments[0],
            locationTexture: this.locationFbi.attachments[0],
            valueTexture: this.velocityVectorFbi.attachments[0],
        }, this.velocityBuffer, 1., Math.ceil(LINE_COUNT))
    }
}
