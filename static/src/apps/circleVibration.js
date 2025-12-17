import { ShaderProgram } from "../glHelper.js";

export class CircleVibe {    
    VS = /*glsl*/`
        #version 300 es
        in vec2 position;
        uniform vec2 uAspectRatio;
        out vec2 xy;

        void main() {
            xy = position;
            vec2 gridDim = vec2(10, 10);
            vec2 blockIdx = vec2(
                gl_InstanceID % gridDim.x,
                floor(gl_InstanceID % gridDim.x)
            )
            vec2 blockUv = blockIdx / gridDim;
            float aScale = .1;
            vec2 offsetUv = blockUv;
            vec2 offsetXy = 2. * blockUv - 1.;
            vec2 pt = (position * aScale + offsetXy) / uAspectRatio;
            gl_Position = vec4(pt, 0., 1.);
        }
    `

    FS = /*glsl*/`
        #version 300 es
        precision highp float;
        in vec2 xy;
        out vec4 FOut;

        void main() {        
            FOut = vec4(1.);
        }
    `

    constructor({gl, aspectRatio}) {
        this.gl = gl
        this.aspectRatio = aspectRatio
        this.pg = new ShaderProgram({gl, vs:this.VS, fs:this.FS})
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
