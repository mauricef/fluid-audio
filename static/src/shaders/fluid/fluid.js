import { calculateAspectRatio } from "../../ui/index.js"
import { Pointer } from "./mouse.js"
import { GLHelper } from "./gl.js"
import { ShaderProgram } from "../../glHelper.js"


const VELOCITY_DISSIPATION_MAX = 1
const DYE_DISSIPATION_MAX = 1

const PRECISION_INCLUDE = `
    precision highp float;
    precision highp sampler2D;
`

const VARYING_INCLUDE = `
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
`

const FUNCTION_INCLUDE = `
`

const VS = /*glsl*/`
    precision highp float;

    attribute vec2 aPosition;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform vec2 texelSize;

    vec2 uvOffset(float ox, float oy) {
        return vUv + vec2(ox * texelSize.x, oy * texelSize.y);
    }
    void main() {
        vUv = aPosition * .5 + .5;
        vL = uvOffset(-1., 0.);
        vR = uvOffset(1., 0.);
        vT = uvOffset(0., 1.);
        vB = uvOffset(0., -1.);
        gl_Position = vec4(aPosition, 0.0, 1.0);
    }
`

const CopyFS = /*glsl*/`
    #version 300 es
    precision highp float;
    in vec2 uv;

    uniform sampler2D uSourceTexture;

    out vec4 FOut;

    void main() {     
        FOut = texture(uSourceTexture, uv);
    }
`

function createQuad(gl, bbox) {
    let [l, r, b, t] = bbox || [-1, 1, -1, 1]
    let positions = new Float32Array([l, b, l, t, r, t, r, t, r, b, l, b])
    let quad = twgl.createBufferInfoFromArrays(gl, {aPosition: {numComponents: 2, data: positions}})
    return quad
}

export class FluidApp {
    constructor({gl, canvas, size}) {
        this.PROPS = [
            ['GlobalAlphaDecay', .5],
            ['GlobalSpeedDecay', .5],
        ]
        this.gl = gl
        this.GL = new GLHelper(gl, {es100: true})
        this.aspectRatio = calculateAspectRatio(size)
        this.lastUpdateTime = Date.now()
        this.canvas = canvas
        this.canvasSize = [this.canvas.width, this.canvas.height]
        this.texelSize = [1/size[0], 1/size[1]]
        this.quad = createQuad(gl)

        this.dyeBuffer = this.GL.createFbi(gl.RGBA16F, true, size, gl.LINEAR)
        this.velocityBuffer = this.GL.createFbi(gl.RG16F, true, size, gl.LINEAR)
        this.divergence = this.GL.createFbi(gl.R16F, false, size, gl.LINEAR)
        this.pressure = this.GL.createFbi(gl.R16F, true, size, gl.LINEAR)
        this.pointer = new Pointer(canvas)
        this.copyKernel = new ShaderProgram({gl, fs: CopyFS})
        this.programs = {}
    }
    execute(program, uniforms, output) {
        let {gl, quad} = this
        this.GL.executeProgram(program, uniforms, output, quad)
    }

    glsl(key, {vs, fs, uniforms, output, quad}) {
        let {gl} = this
        if (!(key in this.programs)) {
            let uniformDefs = this.GL.guessUniforms(uniforms)
                let expandedFs = `
                    ${PRECISION_INCLUDE}
                    ${uniformDefs}
                    ${VARYING_INCLUDE}
                    ${FUNCTION_INCLUDE}
                    ${fs}
                `
            this.programs[key] = twgl.createProgramInfo(gl, [vs, expandedFs])
        }
        let program = this.programs[key]
        quad = quad || this.quad
        return this.GL.executeProgram(program, uniforms, output, quad)
    }
    divergenceUpdate(uniforms, output) {
        this.glsl('divergenceUpdate', {
            uniforms,
            vs: VS,
            fs: /*glsl*/`
                vec2 velocityAtPoint(vec2 point)
                {
                    return texture2D(velocity, point).xy * uAspectRatio;
                }
                void main() {
                    float L = velocityAtPoint(vL).x;
                    float R = velocityAtPoint(vR).x;
                    float T = velocityAtPoint(vT).y;
                    float B = velocityAtPoint(vB).y;
                    vec2 C = velocityAtPoint(vUv).xy;
                 
                    float divergence = 0.5 * (R - L + T - B);
                    gl_FragColor = vec4(divergence, 0., 0., 1.);
                }
            `,
            output
        })
    }

    advectionUpdate(params) {
        return this.glsl('advectionUpdate', {
            uniforms: params,
            vs: VS,
            fs: /*glsl*/`
                void main () {
                    vec2 coord = vUv - dt * texture2D(velocity, vUv).xy;
                    vec4 result = texture2D(target, coord);
                    float decay = 1.0 + uDecay * dt;
                    gl_FragColor = result / decay;
                }
            `,
            output: params.target
        })
    }
    pressureUpdate(uniforms, output) {
        return this.glsl('pressureUpdate', {
            uniforms,
            vs: VS,
            fs:/*glsl*/`
                void main() {
                    float L = texture2D(uPressure, vL).x;
                    float R = texture2D(uPressure, vR).x;
                    float T = texture2D(uPressure, vT).x;
                    float B = texture2D(uPressure, vB).x;
                    float C = texture2D(uPressure, vUv).x;
                    float divergence = texture2D(uDivergence, vUv).x;
                    float pressure = (L + R + B + T - divergence) * .25;
                    gl_FragColor = vec4(pressure, 0., 0., 1.);
                }
            `,
            output: output
        })
    }

    subtractGradient(uniforms, output) {
        return this.glsl('subtractGradient', {
            uniforms,
            vs: VS,
            fs: /*glsl*/`
                void main() {
                    float L = texture2D(uPressure, vL).x;
                    float R = texture2D(uPressure, vR).x;
                    float T = texture2D(uPressure, vT).x;
                    float B = texture2D(uPressure, vB).x;
                    vec2 velocity = texture2D(uVelocity, vUv).xy;
                    velocity.xy -= vec2(R - L, T - B) / uAspectRatio;
                    gl_FragColor = vec4(velocity, 0., 1.);
                }
            `,
            output
        })
    }

    render(source) {
        this.glsl('render', {
            uniforms: { source },
            vs: VS,
            fs: /*glsl*/`
                void main() {
                    vec4 color = texture2D(source, vUv);
                    gl_FragColor = vec4(color.rgb * color.a, 1.);
                }
            `
        })
    }

    updateColor(colorUpdateBuffer) {
        let {gl} = this
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
        this.copyKernel.execute({
            uSourceTexture: colorUpdateBuffer.attachments[0],
        }, this.dyeBuffer[0])
        gl.disable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ZERO)
    }

    updateVelocity(velocityUpdateBuffer) {
        let {gl} = this
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ONE)
        this.copyKernel.execute({
            uSourceTexture: velocityUpdateBuffer.attachments[0],
        }, this.velocityBuffer[0])
        gl.disable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ZERO)
    }
    clearPressure() {
        twgl.bindFramebufferInfo(this.gl, this.pressure[0])
        this.gl.clear(this.gl.COLOR_BUFFER_BIT)
        twgl.bindFramebufferInfo(this.gl, this.pressure[1])
        this.gl.clear(this.gl.COLOR_BUFFER_BIT)
    }
    step({dt, pressureSteps, GlobalAlphaDecay, GlobalSpeedDecay}) {
        this.divergenceUpdate({
            uAspectRatio: this.aspectRatio,
            texelSize: this.texelSize,
            velocity: this.velocityBuffer
        }, this.divergence)


        this.clearPressure()
        for (let i = 0; i < pressureSteps; i++) {
            this.pressureUpdate({
                texelSize: this.texelSize,
                uDivergence: this.divergence,
                uPressure: this.pressure,
            }, this.pressure)    
        }
    
        this.subtractGradient({
            uAspectRatio: this.aspectRatio,
            texelSize: this.texelSize,
            uPressure: this.pressure,
            uVelocity: this.velocityBuffer
        }, this.velocityBuffer)

        this.advectionUpdate({
            texelSize: this.texelSize,
            velocity: this.velocityBuffer,
            target: this.velocityBuffer,
            dt: dt,
            uDecay: GlobalSpeedDecay
        })

        this.advectionUpdate({
            texelSize: this.texelSize,
            velocity: this.velocityBuffer,
            target: this.dyeBuffer,
            dt: dt,
            uDecay: GlobalAlphaDecay
        })
    }
    execute({dt, subSteps, pressureSteps, GlobalAlphaDecay, GlobalSpeedDecay, colorUpdateBuffer, velocityUpdateBuffer}) {
        this.updateColor(colorUpdateBuffer)
        this.updateVelocity(velocityUpdateBuffer)
        for (let i = 0; i < Math.floor(subSteps); i++) {
            this.step({
                dt: dt / subSteps,
                GlobalSpeedDecay: GlobalSpeedDecay,
                GlobalAlphaDecay: GlobalAlphaDecay,
                pressureSteps: pressureSteps,
            })            
        }
    }
}