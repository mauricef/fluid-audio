import { calculateAspectRatio } from "/static/src/ui/index.js"
import { ShaderProgram } from "/static/src/glHelper.js";
import { GridApp } from "/static/src/apps/gridApp.js";

export class SplatShader {    
    VS = /*glsl*/`
        #version 300 es
        in vec2 position;

        uniform vec2 uAspectRatio;
        uniform sampler2D uLocation;
        uniform sampler2D uRadius;
        uniform sampler2D uValue;
        
        out vec2 vXY;
        out vec4 vValue;
        out float vBlur; 

        vec4 sampleInstance(sampler2D samp) {
            return texelFetch(samp, ivec2(gl_InstanceID, 0), 0);
        }
        void main() {
            float aScale = sampleInstance(uRadius).r;
            vec2 aOffset = sampleInstance(uLocation).rg;
            vValue = sampleInstance(uValue);
            vXY = position;
            vec2 pt = (position * aScale + aOffset) / uAspectRatio;
            gl_Position = vec4(pt, 0., 1.);
        }
    `

    FS = /*glsl*/`
        #version 300 es
        precision highp float;
        in vec2 vXY;
        in vec4 vValue;
        in float vBlur;
        uniform float uAlpha;
        out vec4 FOut;

        void main() {        
            float weight = float(length(vXY) < 1.);
            FOut = vValue * weight * uAlpha;
        }
    `

    constructor({gl, aspectRatio, blend}) {
        this.gl = gl
        this.aspectRatio = aspectRatio
        this.pg = new ShaderProgram({gl, vs:this.VS, fs:this.FS, blend: blend, clear: true})
    }
    render(inputBuffers, fbi, alpha, numInstances) {
        this.pg.execute({
            uAspectRatio: this.aspectRatio,
            uRadius: inputBuffers.radiusTexture,
            uLocation: inputBuffers.locationTexture,
            uValue: inputBuffers.valueTexture,
            uAlpha: alpha
        }, fbi, {numInstances: numInstances})
    }
}

const VELOCITY_MAGNITUDE_MAX = 1


const locationFS = /*glsl*/`
    #version 300 es
    precision highp float;

    #define PI 3.1415927
    in vec2 uv;
    uniform float radius;
    uniform float uThetaOffset;
    uniform float uSpiralLoops;
    uniform float uSpiralInward;
    out vec4 location;

    void main() 
    {
        float theta = 2. * PI * (uv.x * (1. + uSpiralLoops) + uThetaOffset);
        float r = radius * (uSpiralInward + (1. - uSpiralInward) * uv.x);
        vec2 pt = r * vec2(cos(theta), sin(theta));
        location = vec4(pt, 0., 1.);
    }
`

const colorRadiusFS = /*glsl*/`
    #version 300 es
    precision highp float;

    in vec2 uv;
    uniform sampler2D uAudioPowerTexture;
    uniform float uMax;
    out vec4 outRadius;

    void main() 
    {   
        float frequencyStrength = texture(uAudioPowerTexture, uv).r;
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
    uniform float uThetaOffset;

    out vec4 velocity;

    void main() 
    {   
        float frequencyStrength = texture(uAudioPowerTexture, uv).r;
        float magnitude = .1 * uMagnitude * frequencyStrength;
        float theta = 2. * PI * (uv.x + uThetaOffset);
        vec2 vXY = magnitude * vec2(cos(theta), sin(theta));
        velocity = vec4(vXY, 0., 1.);
    }
`

const MAX_JET_COUNT = 256


export class JetEmitter {
    constructor({gl, canvas, size}) {

        this.gridApp = new GridApp({gl})
        
        this.PROPS = [
            ['JetColorAlpha', 1.],
            ['JetSourceSize', .5],
            ['PerimeterRotate', .5],
            ['PerimeterRadius', .5],
            ['JetLength', .25],
            ['JetSpeed', .5],
            ['JetRotate', .5],
            ['SpiralLoops', 0],
            ['SpiralInward', 1]
        ]
        this.PROPS = this.PROPS.concat(this.gridApp.PROPS)

        let aspectRatio = calculateAspectRatio(size)
        this.gl = gl
        
        this.locationShader = new ShaderProgram({gl, fs: locationFS})

        this.colorRadiusShader = new ShaderProgram({gl, fs: colorRadiusFS})

        this.colorShader = new ShaderProgram({gl, fs: colorFS})
        this.colorFbi = twgl.createFramebufferInfo(gl, [{}], MAX_JET_COUNT, 1)

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

        this.thetaOffset = 0
        this.circleOffset = 0
    }
    ensureBuffers(jetCount) {
        let {gl} = this
        if (this.lastCount != jetCount) {
            this.locationFbi = twgl.createFramebufferInfo(gl, [{internalFormat: gl.RG32F}], jetCount, 1)
            this.colorRadiusFbi = twgl.createFramebufferInfo(gl, [{internalFormat: gl.R32F}], jetCount, 1)
            this.colorFbi = twgl.createFramebufferInfo(gl, [{}], jetCount, 1)
            this.velocityRadiusFbi = twgl.createFramebufferInfo(gl, [{internalFormat: gl.R32F}], jetCount, 1)
            this.velocityVectorFbi = twgl.createFramebufferInfo(gl, [{internalFormat: gl.RG32F}], jetCount, 1)
            this.lastCount = jetCount
        }
    }
    execute({timestamp, params, audioPowerTexture, colorTexture}) {
        let JET_COUNT = params.JetCount * MAX_JET_COUNT
        this.ensureBuffers(JET_COUNT)
        let {gl} = this
        let circleOffsetFreq = -1 * (2 * params.PerimeterRotate - 1)
        circleOffsetFreq =  (Math.abs(circleOffsetFreq) < .1) ? 0 :circleOffsetFreq
        this.circleOffset += (circleOffsetFreq * .01) % 1.

        this.locationShader.execute({
            radius: params.PerimeterRadius,
            uThetaOffset: this.circleOffset,
            uSpiralLoops: 10 * params.SpiralLoops,
            uSpiralInward: params.SpiralInward,
        }, this.locationFbi)

        this.colorShader.execute({}, this.colorFbi)

        let maxJetRadius = .5 * 2 * Math.PI * params.PerimeterRadius / JET_COUNT
        this.colorRadiusShader.execute({
            uMax: maxJetRadius * params.JetSourceSize,
            uAudioPowerTexture: audioPowerTexture
        }, this.colorRadiusFbi)

        this.velocityRadiusShader.execute({
            uScale: params.JetLength,
            uRadiusTexture: this.colorRadiusFbi.attachments[0],
        }, this.velocityRadiusFbi)

        let thetaOffsetFreq = -1 * (2 * params.JetRotate - 1)
        thetaOffsetFreq =  (Math.abs(thetaOffsetFreq) < .1) ? 0 :thetaOffsetFreq
        this.thetaOffset += (thetaOffsetFreq * .01) % 1.
        this.velocityVectorShader.execute({
            uMagnitude: VELOCITY_MAGNITUDE_MAX * params.JetSpeed,
            uAudioPowerTexture: audioPowerTexture,
            uThetaOffset: this.thetaOffset
        }, this.velocityVectorFbi)
       
        twgl.bindFramebufferInfo(this.gl, this.colorBuffer)
        this.gl.clear(gl.COLOR_BUFFER_BIT)
        twgl.bindFramebufferInfo(this.gl, null)
        if (params.JetColorAlpha > 0) {
            this.colorEmitter.render( {
                radiusTexture: this.colorRadiusFbi.attachments[0],
                locationTexture: this.locationFbi.attachments[0],
                valueTexture: colorTexture // this.colorFbi.attachments[0]
            }, this.colorBuffer, params.JetColorAlpha, Math.ceil(JET_COUNT))
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
        },this.velocityBuffer, 1., Math.ceil(JET_COUNT))
    }
}