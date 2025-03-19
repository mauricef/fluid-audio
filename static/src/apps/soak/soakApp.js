import { FluidApp } from "/static/src/shaders/fluid/fluid.js"
import { JetEmitter } from "./jetEmitter.js"
import { BlackWhiteEmitter } from "./blackWhiteEmitter.js"


export class SoakApp {
    constructor({gl, fluidParams}) {
        this.gl = gl
        this.fluidParams = fluidParams
        this.canvas = this.gl.canvas
        this.canvasSize = [this.canvas.width, this.canvas.height]
        this.simSize = [this.canvasSize[0] * fluidParams.SIM_SCALE, this.canvasSize[1] * fluidParams.SIM_SCALE]
        this.emitter = new JetEmitter({
            gl: this.gl, 
            canvas: this.canvas, 
            size: this.simSize, 
        })   
        this.fluid = new FluidApp({
            gl: this.gl, 
            canvas: this.canvas,
            size: this.simSize,
        })
        this.PROPS = [
            ["JetCount", .1]
        ]
        this.PROPS = this.PROPS.concat(this.emitter.PROPS)
        this.PROPS = this.PROPS.concat(this.fluid.PROPS)
    }
    execute({timestamp, params, audioPowerTexture, colorTexture}) {
        let {fluidParams} = this
        this.emitter.execute({
            params: params, 
            timestamp: timestamp,
            audioPowerTexture: audioPowerTexture,
            colorTexture: colorTexture
        })
        this.fluid.execute({
            dt: fluidParams.DT,
            subSteps: fluidParams.SUBSTEPS,
            pressureSteps: fluidParams.PRESSURE_STEPS,
            colorDecay: params.colorDecay,
            velocityDecay: params.velocityDecay,
            colorUpdateBuffer: this.emitter.colorBuffer,
            velocityUpdateBuffer: this.emitter.velocityBuffer
        })
        this.fluid.render(this.fluid.dyeBuffer)
    }
}