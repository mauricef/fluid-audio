import { calculateAspectRatio } from "./ui/index.js"

export class ShaderProgram {
    VS = /*glsl*/`
        #version 300 es

        in vec2 position;
        uniform vec2 uAspectRatio;
        out vec2 xy;
        out vec2 uv;
        out vec2 AspectRatio;

        void main() 
        {   
            AspectRatio = uAspectRatio;
            xy = position;
            uv = .5 * (position + 1.);
            gl_Position = vec4(position, 0., 1.);
        }
    `
    constructor({gl, vs, fs, blend, clear, size}) {
        vs = vs || this.VS
        this.size = size
        this.aspectRatio = size ? calculateAspectRatio(size) : null
        this.blend = blend
        this.clear = clear
        this.gl = gl
        this.pi = twgl.createProgramInfo(gl, [vs, fs])
        this.bi = twgl.createBufferInfoFromArrays(gl, {
            position: { numComponents: 2, data: [1, 1, 1, -1, -1, -1, -1, -1, -1, 1, 1, 1] }
        })
    }
    execute(uniforms, fbi, opts) {
        opts = opts || {}
        uniforms || {}
        if (this.aspectRatio) {
            Object.assign(uniforms, {uAspectRatio: this.aspectRatio})
        }
        let numInstances = opts.numInstances
        let blend = this.blend || opts.blend
        let clear = this.clear || opts.clear
        let {gl, pi, bi} = this
        if (blend) {
            gl.enable(gl.BLEND)
            gl.blendFunc(gl.ONE, blend)
        }
        gl.useProgram(pi.program)
        twgl.setBuffersAndAttributes(gl, pi, bi)
        twgl.setUniforms(pi, uniforms)
        if (fbi) {
            twgl.bindFramebufferInfo(gl, fbi)
        }
        if (clear) {
            gl.clear(gl.COLOR_BUFFER_BIT)
        }
        twgl.drawBufferInfo(gl, bi, gl.TRIANGLES, bi.numElements, 0, numInstances)
        if (fbi) {
            twgl.bindFramebufferInfo(gl, null)
        }
        if (this.blend) {
            gl.disable(gl.BLEND)
            gl.blendFunc(gl.ONE, gl.ZERO)
        }
    }
    release() {
        this.gl.glDeleteProgram(this.pi.program)
        Object.values(this.bi.attribs).forEach(b => {
            this.gl.glDeleteBuffer(b.buffer)
        })
    }
}