import { ShaderProgram } from "/static/src/glHelper.js";

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
    uniform vec2 uBins;
    uniform float uMargin;
    uniform float uBlur;
    uniform float uBorder;
    out vec4 FOut;

    void main() {  
        float power = texture(uAudio, vec2(uv.x, .5)).r;
        float alpha = 1.;
        vec3 color = vec3(power);
        FOut = vec4(color * alpha, alpha);
    }
`

const BIN_MAX = 256

export class HistApp {
    constructor({gl}) {
        this.gl = gl
        this.pg = new ShaderProgram({gl, vs:VS, fs:FS})
        this.PROPS = [
            ['Bins', .5],
            ['Border', .05],
            ['Margin', .1],
            ['Blur', .1],
        ]
    }
    execute({timestamp, params, audioPowerTexture}) {
        this.pg.execute({
            params: params, 
            uAudio: audioPowerTexture,
            uBins: BIN_MAX * params.Bins,
            uMargin: params.Margin,
            uBorder: params.Border,
            uBlur: params.Blur
        })
    }
}