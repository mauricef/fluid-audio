import { ShaderProgram } from "../glHelper.js";

const FS = /*glsl*/`
    #version 300 es
    #define PI 3.1415926

    precision highp float;

    in vec2 xy;
    in vec2 uv;
    uniform sampler2D audio;
    out vec4 color;


    void main() 
    {   
        float freq = uv.x;
        float db = texture(audio, vec2(freq, .5)).r;
        float white = float(abs(xy.y) < db);
        vec3 rgb = vec3(white);
        color = vec4(rgb, 1.);
    }
`


class Shader {
    constructor({gl}) {
        this.gl = gl
    }
    async load() {
        let {gl}  = this
        this.pg = new ShaderProgram({gl, vs:VS, fs:FS})
        this.loaded = true
    }
    render({audioTexture}) {
        if (this.loaded) {
            this.pg.execute({
                audio: audioTexture,
            })     
        }
    }
    unload() {
        this.pg.release()
        this.pg = null
    }
}

export function create(ctx) {
    return new Shader(ctx)
}