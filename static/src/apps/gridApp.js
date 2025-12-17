import { ShaderProgram } from "../glHelper.js";

const VS = /*glsl*/`
    #version 300 es

    in vec2 position;
    uniform vec2 uAspectRatio;
    uniform float uBorder;
    out vec2 xy;
    out vec2 uv;
    out vec2 AspectRatio;

    void main() 
    {   
        AspectRatio = uAspectRatio;
        xy = position;
        uv = .5 * (position + 1.);
        vec2 transformed = position * (1. - uBorder);
        gl_Position = vec4(transformed, 0., 1.);
    }
`

const FS = /*glsl*/`
    #version 300 es
    precision highp float;
    in vec2 xy;
    in vec2 uv;
    uniform sampler2D uAudio;
    uniform sampler2D uColor;
    uniform vec2 uGridDim;
    uniform float uMargin;
    uniform float uBlur;
    uniform float uBorder;
    uniform float uAlpha;

    out vec4 FOut;

    void main() {  
        float gridSize = uGridDim.x * uGridDim.y;
        vec2 blockIdx = floor(uv * uGridDim);
        vec2 blockUv = blockIdx / uGridDim;
        float linearIdx = blockIdx.y * uGridDim.x + blockIdx.x;
        float linearU = linearIdx / gridSize;
        vec2 threadUv = fract(uv * uGridDim);
        vec2 threadXY = threadUv * 2. - 1.;
        float power = texture(uAudio, vec2(linearU, .5)).r;
        float margin = min(1.,power) * uMargin;
        float alphaX = 1. - smoothstep(margin * (1. - uBlur), margin, abs(threadXY.x));
        float alphaY = 1. - smoothstep(margin * (1. - uBlur), margin, abs(threadXY.y));
        float alpha = alphaX * alphaY;
        alpha *= uAlpha;
        alpha *= power;
        vec3 color = texture(uColor, vec2(linearU, .5)).rgb;
        FOut = vec4(color * alpha, alpha);
    }
`

const BLOCK_MAX = 256
export class GridApp {
    constructor({gl}) {
        this.gl = gl
        this.pg = new ShaderProgram({gl, vs:VS, fs:FS, blend: gl.ONE_MINUS_SRC_ALPHA})
        this.PROPS = [
            ['GridBlockCount', .5],
            ['GridBorder', .05],
            ['GridMargin', .1],
            ['GridBlur', .1],
            ['GridAlpha', 0]
        ]
    }
    execute({timestamp, params, audioPowerTexture, colorTexture}, fbi) {
        if (params.GridAlpha > 0) {
            this.pg.execute({
                params: params, 
                uAudio: audioPowerTexture,
                uGridDim: [BLOCK_MAX * params.GridBlockCount, BLOCK_MAX * params.GridBlockCount],
                uMargin: 1. - params.GridMargin,
                uBorder: params.GridBorder,
                uBlur: params.GridBlur,
                uColor: colorTexture,
                uAlpha: params.GridAlpha
            }, fbi)
    
        }
    }
}