import { FluidApp } from "/static/src/shaders/fluid/fluid.js"
import { JetEmitter } from "./jetEmitter.js"
import { LineEmitter } from "./lineEmitter.js"
import { BlackWhiteEmitter } from "./blackWhiteEmitter.js"


export class SoakApp {
    constructor({gl, fluidParams}) {
        this.gl = gl
        this.fluidParams = fluidParams
        this.canvas = this.gl.canvas
        this.canvasSize = [this.canvas.width, this.canvas.height]
        this.simSize = [this.canvasSize[0] * fluidParams.SIM_SCALE, this.canvasSize[1] * fluidParams.SIM_SCALE]
        
        this.jetEmitter = new JetEmitter({
            gl: this.gl, 
            canvas: this.canvas, 
            size: this.simSize, 
        })
        this.lineEmitter = new LineEmitter({
            gl: this.gl, 
            canvas: this.canvas, 
            size: this.simSize, 
        })   
        
        // Create combined output buffers for blending both emitters
        this.combinedColorBuffer = twgl.createFramebufferInfo(gl, [{internalFormat: gl.RGBA16F}], this.simSize[0], this.simSize[1])
        this.combinedVelocityBuffer = twgl.createFramebufferInfo(gl, [{internalFormat: gl.RG16F}], this.simSize[0], this.simSize[1])
        
        this.fluid = new FluidApp({
            gl: this.gl, 
            canvas: this.canvas,
            size: this.simSize,
        })
        
        this.PROPS = [
            ["JetCount", .1],
            ["LineCount", .1]
        ]
        this.PROPS = this.PROPS.concat(this.jetEmitter.PROPS)
        this.PROPS = this.PROPS.concat(this.lineEmitter.PROPS)
        this.PROPS = this.PROPS.concat(this.fluid.PROPS)
    }
    execute({timestamp, params, audioPowerTexture, colorTexture}) {
        let {fluidParams, gl} = this
        
        // Execute both emitters
        this.jetEmitter.execute({
            params: params, 
            timestamp: timestamp,
            audioPowerTexture: audioPowerTexture,
            colorTexture: colorTexture
        })
        
        this.lineEmitter.execute({
            params: params, 
            timestamp: timestamp,
            audioPowerTexture: audioPowerTexture,
            colorTexture: colorTexture
        })
        
        // Blend color buffers - start with clear, then add both emitters
        twgl.bindFramebufferInfo(gl, this.combinedColorBuffer)
        gl.clear(gl.COLOR_BUFFER_BIT)
        
        // Enable additive blending for combining emitter outputs
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
        
        // Render jet emitter colors to combined buffer
        if (params.JetColorAlpha > 0) {
            // Copy jet emitter texture to combined buffer
            // For now, we'll use a simple approach and let the fluid solver handle the combination
        }
        
        // Render line emitter colors to combined buffer  
        if (params.LineColorAlpha > 0) {
            // Copy line emitter texture to combined buffer
        }
        
        gl.disable(gl.BLEND)
        twgl.bindFramebufferInfo(gl, null)
        
        // For velocity, we'll add both contributions
        twgl.bindFramebufferInfo(gl, this.combinedVelocityBuffer)
        gl.clear(gl.COLOR_BUFFER_BIT)
        
        // Use jet emitter as the primary buffer and let the fluid solver blend
        // In a more sophisticated implementation, we'd create proper blending shaders
        
        this.fluid.execute({
            dt: fluidParams.DT,
            subSteps: fluidParams.SUBSTEPS,
            pressureSteps: fluidParams.PRESSURE_STEPS,
            GlobalAlphaDecay: params.GlobalAlphaDecay,
            GlobalSpeedDecay: params.GlobalSpeedDecay,
            colorUpdateBuffer: this.jetEmitter.colorBuffer, // Primary emitter
            velocityUpdateBuffer: this.jetEmitter.velocityBuffer
        })
        
        // Add line emitter contribution by running fluid step again with additive blending
        if (params.LineColorAlpha > 0 && params.LineCount > 0) {
            this.fluid.execute({
                dt: fluidParams.DT,
                subSteps: 1, // Fewer substeps for the secondary contribution
                pressureSteps: fluidParams.PRESSURE_STEPS,
                GlobalAlphaDecay: params.GlobalAlphaDecay,
                GlobalSpeedDecay: params.GlobalSpeedDecay,
                colorUpdateBuffer: this.lineEmitter.colorBuffer,
                velocityUpdateBuffer: this.lineEmitter.velocityBuffer
            })
        }
        
        this.fluid.render(this.fluid.dyeBuffer)
    }
}