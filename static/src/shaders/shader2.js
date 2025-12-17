import { ShaderProgram } from "../glHelper.js";


const vs = /*glsl*/`
    #version 300 es

    in vec2 position;
    uniform vec2 aspect;
    out vec2 xy;

    void main() 
    {   
        xy = position * aspect;
        gl_Position = vec4(position, 0., 1.);
    }
`

const fs = /*glsl*/`
    #version 300 es
    #define PI 3.1415926

    precision highp float;

    in vec2 xy;
    uniform float time;
    out vec4 color;

    void main() 
    {
        float blur = .1;
        float d = length(xy);
        float theta = .5 * (1. + atan(xy.y, xy.x) / PI);
        float radius =  (.1 + .6 * abs(fract(10. * d) - .5));
        d = fract(20. * d - time);
        d = 1. - smoothstep(radius - blur, radius, abs(d - .5));
        color = vec4(d, d, d, 1.);
    }
`

class Shader {
    constructor({gl}) {
        this.gl = gl
        this.pg = new ShaderProgram({gl, vs, fs})
    }
    async load() {

    }
    render({time, size, aspect}) {
        this.pg.execute({
            time: (time / 1000.) % 1.,
            aspect: aspect
        })    
    }
    unload() {
        this.pg.release()
        this.pg = null
    }
}

export function create(ctx) {
    return new Shader(ctx)
}