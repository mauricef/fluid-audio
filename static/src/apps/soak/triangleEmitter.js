import { calculateAspectRatio } from "/static/src/ui/index.js"
import { ShaderProgram } from "/static/src/glHelper.js";
import { GridApp } from "/static/src/apps/gridApp.js";
import { SplatShader } from "./jetEmitter.js";

const VELOCITY_MAGNITUDE_MAX = 1

// Triangle location shader - positions emitters along triangle edges
const locationFS = /*glsl*/`
    #version 300 es
    precision highp float;

    in vec2 uv;
    uniform float uTriangleSize;
    uniform float uTriangleRotation;
    uniform vec2 uTriangleCenter;
    out vec4 location;

    void main() 
    {
        // Create triangle with vertices at 120 degree intervals
        float t = uv.x * 3.0; // Map to 3 sides of triangle
        int side = int(floor(t));
        float s = fract(t); // Position along current side (0-1)
        
        // Triangle vertices (equilateral triangle)
        float angle1 = uTriangleRotation + float(side) * 2.094395; // 120 degrees in radians
        float angle2 = uTriangleRotation + float(side + 1) * 2.094395;
        
        vec2 vertex1 = uTriangleSize * vec2(cos(angle1), sin(angle1));
        vec2 vertex2 = uTriangleSize * vec2(cos(angle2), sin(angle2));
        
        // Interpolate along the edge
        vec2 pt = mix(vertex1, vertex2, s) + uTriangleCenter;
        
        location = vec4(pt, 0., 1.);
    }
`

const colorRadiusFS = /*glsl*/`
    #version 300 es
    precision highp float;

    in vec2 uv;
    uniform sampler2D uAudioPowerTexture;
    uniform float uMax;
    out vec4 outRadius;

    void main() 
    {   
        float frequencyStrength = texture(uAudioPowerTexture, uv).r;
        float radius = uMax * frequencyStrength;
        outRadius = vec4(vec3(radius), 1.);
    }
`

const velocityRadiusFS = /*glsl*/`
    #version 300 es
    precision highp float;
    in vec2 uv;

    uniform float uScale;
    uniform sampler2D uRadiusTexture;
    out vec4 outRadius;

    void main() 
    {   
        float baseRadius = texture(uRadiusTexture, uv).r;
        float radius = uScale * baseRadius;
        outRadius = vec4(vec3(radius), 1.);
    }
`

const colorFS = /*glsl*/`
    #version 300 es
    precision highp float;

    in vec2 uv;
    out vec4 color;

    vec3 hsv2rgb(vec3 c)
    {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    void main() 
    {   
        vec3 hsv = vec3(uv.x, 1., 1.);
        vec3 rgb = hsv2rgb(hsv);
        color = vec4(rgb, 1.);
    }
`

const velocityVectorFS = /*glsl*/`
    #version 300 es
    precision highp float;

    #define PI 3.1415927
    in vec2 uv;
    uniform sampler2D uAudioPowerTexture;
    uniform float uMagnitude;
    uniform float uDirection;
    uniform float uTriangleSize;
    uniform float uTriangleRotation;
    uniform vec2 uTriangleCenter;

    out vec4 velocity;

    void main() 
    {   
        float frequencyStrength = texture(uAudioPowerTexture, uv).r;
        float magnitude = .1 * uMagnitude * frequencyStrength;
        
        // Calculate position on triangle to determine outward normal
        float t = uv.x * 3.0;
        int side = int(floor(t));
        float s = fract(t);
        
        float angle1 = uTriangleRotation + float(side) * 2.094395;
        float angle2 = uTriangleRotation + float(side + 1) * 2.094395;
        
        vec2 vertex1 = uTriangleSize * vec2(cos(angle1), sin(angle1));
        vec2 vertex2 = uTriangleSize * vec2(cos(angle2), sin(angle2));
        
        // Edge direction
        vec2 edge = normalize(vertex2 - vertex1);
        // Outward normal (rotate edge 90 degrees)
        vec2 normal = vec2(-edge.y, edge.x);
        
        // Blend between outward normal and custom direction
        float directionRadians = 2. * PI * uDirection;
        vec2 customDir = vec2(cos(directionRadians), sin(directionRadians));
        vec2 finalDir = mix(normal, customDir, 0.5); // 50% normal, 50% custom
        
        vec2 vXY = magnitude * finalDir;
        velocity = vec4(vXY, 0., 1.);
    }
`

const MAX_TRIANGLE_COUNT = 256

export class TriangleEmitter {
    constructor({gl, canvas, size}) {
        this.gridApp = new GridApp({gl})
        
        this.PROPS = [
            ['TriangleColorAlpha', 1.],
            ['TriangleSourceSize', .5],
            ['TriangleSize', .5],
            ['TriangleRotation', 0.5], // Animation speed (0.5 = no rotation)
            ['TriangleAngle', 0.], // Static rotation offset (0-1, where 0.33 ≈ base down)
            ['TriangleCenterX', 0.5],
            ['TriangleCenterY', 0.5],
            ['TriangleLength', .25],
            ['TriangleSpeed', .5],
            ['TriangleDirection', 0.] // 0=outward normal, 0.25=right, 0.5=inward, 0.75=left
        ]
        this.PROPS = this.PROPS.concat(this.gridApp.PROPS)

        let aspectRatio = calculateAspectRatio(size)
        this.gl = gl
        
        this.locationShader = new ShaderProgram({gl, fs: locationFS})
        this.colorRadiusShader = new ShaderProgram({gl, fs: colorRadiusFS})
        this.colorShader = new ShaderProgram({gl, fs: colorFS})
        this.colorFbi = twgl.createFramebufferInfo(gl, [{}], MAX_TRIANGLE_COUNT, 1)
        this.velocityRadiusShader = new ShaderProgram({gl, fs: velocityRadiusFS})
        this.velocityVectorShader = new ShaderProgram({gl, fs: velocityVectorFS})

        this.colorBuffer = twgl.createFramebufferInfo(gl, [{internalFormat: gl.RGBA16F}], size[0], size[1])
        this.velocityBuffer = twgl.createFramebufferInfo(gl, [{internalFormat: gl.RG16F}], size[0], size[1])

        this.colorEmitter = new SplatShader({
            gl, 
            blend: gl.ONE_MINUS_SRC_ALPHA,
            aspectRatio, 
        })

        this.velocityEmitter = new SplatShader({
            gl, 
            blend: gl.ONE,
            aspectRatio, 
        })   

        this.triangleRotationOffset = 0
    }
    
    ensureBuffers(triangleCount) {
        let {gl} = this
        if (this.lastCount != triangleCount) {
            this.locationFbi = twgl.createFramebufferInfo(gl, [{internalFormat: gl.RG32F}], triangleCount, 1)
            this.colorRadiusFbi = twgl.createFramebufferInfo(gl, [{internalFormat: gl.R32F}], triangleCount, 1)
            this.colorFbi = twgl.createFramebufferInfo(gl, [{}], triangleCount, 1)
            this.velocityRadiusFbi = twgl.createFramebufferInfo(gl, [{internalFormat: gl.R32F}], triangleCount, 1)
            this.velocityVectorFbi = twgl.createFramebufferInfo(gl, [{internalFormat: gl.RG32F}], triangleCount, 1)
            this.lastCount = triangleCount
        }
    }
    
    execute({timestamp, params, audioPowerTexture, colorTexture}) {
        let TRIANGLE_COUNT = params.TriangleCount * MAX_TRIANGLE_COUNT
        this.ensureBuffers(TRIANGLE_COUNT)
        let {gl} = this

        // Animate triangle rotation if desired
        let rotationFreq = -1 * (2 * params.TriangleRotation - 1)
        rotationFreq = (Math.abs(rotationFreq) < .1) ? 0 : rotationFreq
        this.triangleRotationOffset += rotationFreq * .01
        this.triangleRotationOffset = this.triangleRotationOffset - Math.floor(this.triangleRotationOffset)

        // Combine static angle with animated rotation
        let totalRotation = (params.TriangleAngle + this.triangleRotationOffset) * 6.28318 // Convert to radians

        let triangleCenter = [
            (params.TriangleCenterX - 0.5) * 2, // Convert from 0-1 to -1 to 1
            (params.TriangleCenterY - 0.5) * 2
        ]

        this.locationShader.execute({
            uTriangleSize: params.TriangleSize,
            uTriangleRotation: totalRotation,
            uTriangleCenter: triangleCenter,
        }, this.locationFbi)

        this.colorShader.execute({}, this.colorFbi)

        let maxTriangleRadius = .5 * params.TriangleSize / Math.sqrt(TRIANGLE_COUNT)
        this.colorRadiusShader.execute({
            uMax: maxTriangleRadius * params.TriangleSourceSize,
            uAudioPowerTexture: audioPowerTexture
        }, this.colorRadiusFbi)

        this.velocityRadiusShader.execute({
            uScale: params.TriangleLength,
            uRadiusTexture: this.colorRadiusFbi.attachments[0],
        }, this.velocityRadiusFbi)

        this.velocityVectorShader.execute({
            uMagnitude: VELOCITY_MAGNITUDE_MAX * params.TriangleSpeed,
            uAudioPowerTexture: audioPowerTexture,
            uDirection: params.TriangleDirection,
            uTriangleSize: params.TriangleSize,
            uTriangleRotation: totalRotation,
            uTriangleCenter: triangleCenter,
        }, this.velocityVectorFbi)
       
        twgl.bindFramebufferInfo(this.gl, this.colorBuffer)
        this.gl.clear(gl.COLOR_BUFFER_BIT)
        twgl.bindFramebufferInfo(this.gl, null)
        
        if (params.TriangleColorAlpha > 0) {
            this.colorEmitter.render({
                radiusTexture: this.colorRadiusFbi.attachments[0],
                locationTexture: this.locationFbi.attachments[0],
                valueTexture: colorTexture
            }, this.colorBuffer, params.TriangleColorAlpha, Math.ceil(TRIANGLE_COUNT))
        }

        if (params.BlockAlpha > 0) {
            this.gridApp.execute({
                timestamp, 
                params,
                audioPowerTexture: audioPowerTexture,
                colorTexture: colorTexture
            }, this.colorBuffer)
        }

        this.velocityEmitter.render({
            radiusTexture: this.velocityRadiusFbi.attachments[0],
            locationTexture: this.locationFbi.attachments[0],
            valueTexture: this.velocityVectorFbi.attachments[0],
        }, this.velocityBuffer, 1., Math.ceil(TRIANGLE_COUNT))
    }
}
