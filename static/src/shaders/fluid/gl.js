let quadPositions = new Float32Array([-1, -1, -1, 1, 1, 1, 1, 1, 1, -1, -1, -1])

export class GLHelper {
    constructor(gl) {
        this.gl = gl
        this.quad = twgl.createBufferInfoFromArrays(gl, {a_position: {numComponents: 2, data: quadPositions}})
    }
    createProgram(vs, fs) {
        let {gl}  = this
        vs = '#version 300 es\n' + vs
        fs = '#version 300 es\n' + fs
        let programInfo = twgl.createProgramInfo(gl, [vs, fs])
        return programInfo
    }
    parseUniforms(uniforms) {
        Object.keys(uniforms).forEach(key => {
            let value = uniforms[key]
            if (value && value.attachments) {
                uniforms[key] = value.attachments[0]
            } 
            else if (value && (value.length == 2) && (value[0].attachments)) {
                uniforms[key] = value[0].attachments[0]
            }
        })
        return uniforms
    }
    guessUniforms(params) {
        params = this.parseUniforms(params)
        const uni = [];
        const len2type = {1:'float', 2:'vec2', 3:'vec3', 4:'vec4', 9:'mat3', 16:'mat4'};
        for (const name in params) {
            const v = params[name];
            let s = null;
            if (v instanceof WebGLTexture) {
                s = `uniform sampler2D ${name};`
            } else if (typeof v === 'number') {
                s=`uniform float ${name};`
            } else if (typeof v === 'boolean') {
                s=`uniform bool ${name};`
            } else if (v.length in len2type) {
                s=`uniform ${len2type[v.length]} ${name};`
            }
            if (s) uni.push(s);
        }
        return uni.join('\n')+'\n';
    }
    
    createFbi(internalFormat, pingPong, size, minMag) {
        let {gl} = this
        size = size || [gl.canvas.width, gl.canvas.height]
        minMag = minMag || gl.NEAREST
        let count = pingPong ? 2 : 1
        let buffers = []
        for (let i = 0; i < count; i++) {
            let fbi = twgl.createFramebufferInfo(gl, [
                {internalFormat: internalFormat, minMag: minMag,  wrap: gl.CLAMP_TO_EDGE}
            ], size[0], size[1])
            buffers.push(fbi)
        }
        if (pingPong) {
            return buffers
        }
        else {
            return buffers[0]
        }
    }
    
    executeProgram(program, uniforms, outputFb, quad) {
        let {gl} = this
        quad = quad || this.quad
        uniforms = this.parseUniforms(uniforms)
        if (outputFb && outputFb.length == 2) {
            outputFb.reverse()
            outputFb = outputFb[0]
        }
        gl.useProgram(program.program)
        twgl.setUniforms(program, uniforms)
        twgl.bindFramebufferInfo(gl, outputFb)
        twgl.setBuffersAndAttributes(gl, program, quad)
        twgl.drawBufferInfo(gl, quad)
    }

    executeCachedProgram(key, {
        VS,
        FS,
        uniforms,
        output,
    }) {
        let {gl} = this
        key = `__${key}`
        uniforms = this.parseUniforms(uniforms)
        if (!this[key]) {
            let uniformStr = this.guessUniforms(uniforms)
            let prefix = `
                precision highp float;
                out vec4 result;
            `
            FS = `
                ${prefix}
                ${uniformStr}

                ${FS}
            `
            let program = this.createProgram(VS, FS)
            this[key] = program

            if (output && output.format) {
                output = this.createFbi(output.format, false, output.size)
                this[key+'.output'] = output
            }
        }
        let program = this[key]
        output = this[key+'.output'] ||  output
        this.executeProgram(program, uniforms, output)
        return output
    }
}