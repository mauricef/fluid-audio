import { ShaderProgram } from "/static/src/glHelper.js";

class ColorNode {
    FS = /*glsl*/`
        #version 300 es
        precision highp float;
        in vec2 xy;
        in vec2 AspectRatio;

        uniform float uRadius;
        uniform float uWidth;
        uniform float uBlur;
        uniform vec3 uColor;
        out vec4 colorOut;

        void main() {        
            float d = length(xy * AspectRatio);
            d = abs(d - uRadius);
            d = 1. - smoothstep(uWidth * (1. - uBlur), uWidth, d);
            colorOut = vec4(uColor * d, d);
        }
    `
    constructor({gl, size}) {
        this.pg = new ShaderProgram({gl, fs: this.FS, size: size})
        this.colorBuffer = twgl.createFramebufferInfo(gl, [{internalFormat: gl.RGBA16F}], size[0], size[1])
    }
    execute(uniforms) {
        this.pg.execute(uniforms, this.colorBuffer, {clear: true})
    }
}

class VelocityNode {
    FS = /*glsl*/`
        #version 300 es
        precision highp float;
        in vec2 xy;
        in vec2 AspectRatio;

        uniform sampler2D uThetaMagnitude;
        uniform float uMagnitudeScale;
        uniform float uRadius;
        uniform float uWidth;
        uniform float uBlur;
        out vec4 colorOut;

        #define PI 3.1415927
        
        void main() {      
            float theta = atan(xy.y, xy.x);  
            float theta01 = (theta + PI) / (2. * PI);
            float magnitude = texture(uThetaMagnitude, vec2(theta01, .5)).r;
            magnitude *= uMagnitudeScale;
            vec2 velocity = magnitude * vec2(cos(theta), sin(theta));
            float d = length(xy * AspectRatio);
            d = abs(d - uRadius);
            d = 1. - smoothstep(uWidth * (1. - uBlur), uWidth, d);
            colorOut = vec4(velocity * d, 0., 1.);
        }
    `
    constructor({gl, size}) {
        this.pg = new ShaderProgram({gl, fs: this.FS, size: size})
        this.velocityBuffer = twgl.createFramebufferInfo(gl, [{internalFormat: gl.RG16F}], size[0], size[1])
    }
    execute(uniforms) {
        this.pg.execute(uniforms, this.velocityBuffer, {clear: true})
    }
}

export class RingEmitter {
    constructor({gl, size}) {
        this.PROPS = [
            ['ringRadius', .5],
            ['ringWidth', .02],
            ['ringRelBlur', .1],
            ['ringVelocityRelWidth', .2],
            ['ringVelocityMagScale', .05]
        ]

        this.colorNode = new ColorNode({gl, size})
        this.velocityNode = new VelocityNode({gl, size})
    }
    get colorBuffer() {
        return this.colorNode.colorBuffer
    }
    get velocityBuffer() {
        return this.velocityNode.velocityBuffer
    }
    execute({params, audioPowerTexture}) {
        this.colorNode.execute({
            uRadius: params.ringRadius,
            uWidth: params.ringWidth,
            uBlur: params.ringRelBlur,
            uColor: [1., 1., 1]
        })
        this.velocityNode.execute({
            uRadius: params.ringRadius,
            uWidth: params.ringWidth * params.ringVelocityRelWidth,
            uBlur: params.ringRelBlur,
            uThetaMagnitude: audioPowerTexture,
            uMagnitudeScale: params.ringVelocityMagScale
        })
    }
}