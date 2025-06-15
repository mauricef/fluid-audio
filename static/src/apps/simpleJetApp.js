
import { FluidApp } from "/static/src/shaders/fluid/fluid.js"
import { SimpleEmitterKernel } from "/static/src/emitters/simpleEmitter.js"


export class SimpleJetApp {
    constructor({gl, fluidParams}) {
        this.gl = gl
        this.canvas = this.gl.canvas
        this.canvasSize = [this.canvas.width, this.canvas.height]
        this.simSize = [this.canvasSize[0] * fluidParams.SIM_SCALE, this.canvasSize[1] * fluidParams.SIM_SCALE]
        this.emitter = new SimpleEmitterKernel({
            gl: this.gl, 
            size: this.simSize
        })
        this.fluid = new FluidApp({
            gl: this.gl, 
            canvas: this.canvas,
            size: this.simSize,
        })
        this.PROPS = []
        this.PROPS = this.PROPS.concat(this.emitter.PROPS)
        this.PROPS = this.PROPS.concat(this.fluid.PROPS)
    }
    execute({timestamp, params, audioPowerTexture}) {
        this.emitter.execute({
            params: params, 
        })
        this.fluid.execute({
            dt: fluidParams.DT,
            subSteps: fluidParams.SUBSTEPS,
            pressureSteps: fluidParams.PRESSURE_STEPS,
            GlobalAlphaDecay: params.GlobalAlphaDecay,
            GlobalSpeedDecay: params.GlobalSpeedDecay,
            colorUpdateBuffer: this.emitter.colorBuffer,
            velocityUpdateBuffer: this.emitter.velocityBuffer
        })
        this.fluid.render(this.fluid.dyeBuffer)
    }
}