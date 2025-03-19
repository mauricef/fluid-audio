function getAspectRatio(canvas) {
    if (canvas.width > canvas.height) {
        return [1., canvas.height / canvas.width]
    }
    else {
        return [canvas.width / canvas.height, 1.]
    }
}

function HSVtoRGB (h, s, v) {
    let r, g, b, i, f, p, q, t;
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }

    return [r, g, b]
}

const SplatVS = /*glsl*/`
    attribute vec2 aVertex;
    attribute float aScale;
    attribute vec2 aOffset;
    attribute vec4 aValue;

    uniform vec2 uAspectRatio;
    uniform float uPixelSize;

    varying vec2 vXY;
    varying vec4 vValue;
    varying float vBlur; 

    void main() {
        vec2 position = uAspectRatio * (aVertex * aScale + aOffset);
        vValue = aValue;
        vXY = aVertex;
        vBlur = uPixelSize * aScale;
        gl_Position = vec4(position, 0., 1.);
    }
`

const SplatFS = /*glsl*/`
    precision highp float;
    varying vec2 vXY;
    varying vec4 vValue;
    varying float vBlur;

    float sigmoid(float x) {
        return 1. / (1. + exp(-x));
    }

    void main() {        
        float weight = sigmoid(vBlur * (1. - length(vXY)));
        gl_FragColor = vValue * weight;
    }
`

const scaleDataStride = 1
const offsetDataStride = 2
const valueDataStride = 4

class SplatBrush {
    constructor(gl, splatCount, aspectRatio, pixelSize) {
        let numInstances = splatCount
        this.gl = gl
        this.aspectRatio = [1/aspectRatio[0], 1/aspectRatio[1]]
        this.pixelSize = pixelSize
        this.numInstances = numInstances
        this.scaleData = new Float32Array(numInstances * scaleDataStride)
        this.offsetData = new Float32Array(numInstances * offsetDataStride)
        this.valueData = new Float32Array(numInstances * valueDataStride)
        this.programInfo = twgl.createProgramInfo(gl, [SplatVS, SplatFS])
    }
    updateData(splats) {      
        let {gl} = this
        for (let i = 0; i < this.numInstances; i++) {
            let {scale, offset, value} = splats[i]
            this.scaleData[i*scaleDataStride] = scale
            this.offsetData[i*offsetDataStride] = offset[0]
            this.offsetData[i*offsetDataStride + 1] = offset[1]
            this.valueData[i*valueDataStride] = value[0]
            this.valueData[i*valueDataStride+1] = value[1]
            this.valueData[i*valueDataStride+2] = value[2]
            this.valueData[i*valueDataStride+3] = value[3]
        }
    
        let bufferInfo = twgl.createBufferInfoFromArrays(gl, {
            aVertex: {
                numComponents: 2, 
                data: [
                    -1, -1, 
                    -1, 1, 
                    1, -1,
                    1, -1, 
                    1, 1, 
                    -1, 1
                ]
            },
            aScale: {
                numComponents: scaleDataStride, 
                data: this.scaleData,
                divisor: 1
            },
            aOffset: {
                numComponents: offsetDataStride, 
                data: this.offsetData,
                divisor: 1
            },
            aValue: {
                numComponents: valueDataStride, 
                data: this.valueData,
                divisor: 1
            }
            
        })
        return twgl.createVertexArrayInfo(this.gl, this.programInfo, bufferInfo)
    }
    render(splats, fbi) {
        let {gl, numInstances} = this
        let programInfo = this.programInfo
        let vertexArrayInfo = this.updateData(splats)
        let uniforms = {
            uAspectRatio: this.aspectRatio,
            uPixelSize: this.pixelSize
        }

        gl.useProgram(programInfo.program)
        twgl.setUniforms(programInfo, uniforms)
        twgl.bindFramebufferInfo(gl, fbi)
        twgl.setBuffersAndAttributes(gl, programInfo, vertexArrayInfo)
        twgl.drawBufferInfo(gl, vertexArrayInfo, gl.TRIANGLES, vertexArrayInfo.numElements, 0, numInstances) 
    }
}

export class CircleEmitter {
    constructor({gl, canvas, simSize, splatCount}) {
        this.VELOCITY_SCALE_MAX = .01
        this.VELOCITY_MAGNITUDE_MAX = .1
        this.DYE_SCALE_MAX = .1

        let pixelSize = Math.max(simSize[0], simSize[1]) / 2.
        let aspectRatio = getAspectRatio(canvas)
        this.gl = gl
        this.dyeBrush = new SplatBrush(gl, splatCount, aspectRatio, pixelSize)
        this.velocityBrush = new SplatBrush(gl, splatCount, aspectRatio, pixelSize)   
        this.splats = this.generateSplats(splatCount)
    }
    generateSplats(splatCount) {
        let radius = .25
        let splats = []
        for (let i = 0; i < splatCount; i++) {
            let theta = 2 * Math.PI * i / splatCount
            let location = [
                radius * Math.cos(theta),
                radius * Math.sin(theta)
            ]
            splats.push({
                hue: i/splatCount,
                location: location,
                theta: theta
            })
        }
        return splats
    }
    render({params, frequencyArray, dyeBuffer, velocityBuffer}) {
        let {gl} = this
        let velocitySplats = []
        let dyeSplats = []
        var frequencyStrengths = frequencyArray
        for (let i = 0; i < this.splats.length; i++) {
            let frequencyStrenght = frequencyStrengths[i]
            let {hue, location, theta} = this.splats[i]
            let a = frequencyStrenght
            let [r,g,b] = HSVtoRGB(hue, 1, 1)
            let magnitude = params.VELOCITY_MAGNITUDE * this.VELOCITY_MAGNITUDE_MAX * frequencyStrenght
            dyeSplats.push({
                offset: location,
                scale: params.DYE_SCALE * this.DYE_SCALE_MAX * frequencyStrenght,
                value: [r * a, g * a, b * a, a]
            })
            velocitySplats.push({
                offset: location,
                scale: params.VELOCITY_SCALE * this.VELOCITY_SCALE_MAX,
                value: [magnitude * Math.cos(theta), magnitude * Math.sin(theta), 0., 1.]
            })
        }
        
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
        this.dyeBrush.render(dyeSplats, dyeBuffer)
        gl.disable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ZERO)
        this.velocityBrush.render(velocitySplats, velocityBuffer)    
    }
}