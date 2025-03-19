import { calculateAspectRatio } from "/static/src/ui/index.js"
import { ShaderProgram } from "/static/src/glHelper.js";

const ColorFS = /*glsl*/`
    #version 300 es
    precision highp float;
    in vec2 xy;

    uniform float uRadius;
    uniform float uBlur;
    uniform float uHue;
    uniform float uAlpha;
    uniform vec2 uAspectRatio;

    out vec4 FOut;

    vec3 hsv2rgb(vec3 c)
    {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    void main() {     
        vec3 hsv = vec3(uHue, 1., 1.);
        vec3 rgb = hsv2rgb(hsv);
        vec4 color = vec4(rgb * uAlpha, uAlpha);
        float weight = 1. - smoothstep(uRadius - uBlur, uRadius, length(xy * uAspectRatio));
        FOut = color * weight;
    }
`

const VelocityFS = /*glsl*/`
    #version 300 es
    precision highp float;
    in vec2 xy;

    uniform float uRadius;
    uniform float uMagnitude;
    uniform float uTheta;
    uniform vec2 uAspectRatio;

    out vec4 FOut;

    #define PI 3.1415926
    
    void main() {        
        float weight = 1. - smoothstep(0., uRadius, length(xy * uAspectRatio));
        vec2 velocity = uMagnitude * vec2(cos(2. * PI * uTheta), sin(2. * PI * uTheta));
        FOut = vec4(velocity * weight, 0., 1.);
    }
`
const RADIUS_SCALE = .1
const VELOCITY_MAGNITUDE_SCALE = 1

export class SimpleEmitterKernel {
    constructor({gl, size}) {
        this.PROPS =  [
            ['ColorRadius', .25],
            ['ColorRelBlur', .25],
            ['ColorHue', .5],
            ['ColorAlpha', .5],
            ['VelocityRelRadius', .25],
            ['VelocityMagnitude', .5],
            ['VelocityTheta', .5],
        ]
        this.gl = gl
        this.aspectRatio = calculateAspectRatio(size)
        this.colorKernel = new ShaderProgram({gl, fs:ColorFS})
        this.colorBuffer = twgl.createFramebufferInfo(gl, [{internalFormat: gl.RGBA32F}], size[0], size[1])
        this.velocityKernel = new ShaderProgram({gl, fs:VelocityFS})
        this.velocityBuffer = twgl.createFramebufferInfo(gl, [{internalFormat: gl.RG32F}], size[0], size[1])
    }
    execute({params}) {
        let colorRadius = params.ColorRadius * RADIUS_SCALE
        let velocityRadius = params.VelocityRelRadius * colorRadius
        this.colorKernel.execute({
            uAspectRatio: this.aspectRatio,
            uRadius: colorRadius,
            uBlur: params.ColorRelBlur * colorRadius,
            uHue: params.ColorHue,
            uAlpha: params.ColorAlpha,
        }, this.colorBuffer)

        this.velocityKernel.execute({
            uAspectRatio: this.aspectRatio,
            uRadius: velocityRadius,
            uMagnitude: params.VelocityMagnitude * VELOCITY_MAGNITUDE_SCALE,
            uTheta: params.VelocityTheta,
        }, this.velocityBuffer)       
    }
}