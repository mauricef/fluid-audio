import { calculateAspectRatio } from "../../ui/index.js"
import { ShaderProgram } from "../../glHelper.js";

const velocityFs = /*glsl*/`
    #version 300 es
    precision highp float;
    in vec2 uv;
    in vec2 xy;
    
    uniform sampler2D uAudio;
    uniform float uWidth;
    uniform float uBins;
    out vec4 outVelocity;

    void main() 
    {   
        float power = texture(uAudio, uv).r;
        float magnitude = .1 *  power;
        float alpha = float(xy.y < 0. && xy.y > (- uWidth));
        vec2 vel = vec2(0., magnitude);
        outVelocity = vec4(vel, 0., 1.);
    }
`

const colorFs = /*glsl*/`
    #version 300 es
    precision highp float;
    in vec2 xy;
    out vec4 outColor;

    void main() 
    {   
        float alpha = 1.;
        vec3 rgb = vec3(xy.y > 0.);
        outColor = vec4(rgb * alpha, alpha);
    }
`


export class BlackWhiteEmitter {
    constructor({gl, size}) {
        this.PROPS = [
        ]

        let aspectRatio = calculateAspectRatio(size)
        this.gl = gl

        this.colorKernel = new ShaderProgram({gl, fs: colorFs})
        this.colorBuffer = twgl.createFramebufferInfo(gl, [{internalFormat: gl.RGBA16F}], size[0], size[1])
        this.velocityKernel = new ShaderProgram({gl, fs: velocityFs})
        this.velocityBuffer = twgl.createFramebufferInfo(gl, [{internalFormat: gl.RG16F}], size[0], size[1])
    }

    execute({params, audioPowerTexture}) {
        let {gl} = this

        this.colorKernel.execute({

        }, this.colorBuffer)

        this.velocityKernel.execute({
            uAudio: audioPowerTexture,
            uWidth: .01,
            uBins: 128,
        }, this.velocityBuffer)
    }
}