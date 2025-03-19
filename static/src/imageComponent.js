import { ShaderProgram } from "./glHelper.js";

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}

const vs = /*glsl*/`
    #version 300 es

    in vec2 position;
    uniform vec2 scale;
    out vec2 uv;

    void main() 
    {   
        uv = position.xy * .5 + .5;
        vec2 p = scale * position;
        gl_Position = vec4(p, 0., 1.);
    }
`

const fs = /*glsl*/`
    #version 300 es
    precision highp float;

    uniform sampler2D tex;
    in vec2 uv;
    out vec4 color;

    void main() 
    {
        vec4 textureColor = texture(tex, uv);
        color = vec4(textureColor.rgb, 1.);
    }
`

export class ImageComponent {
    constructor({gl, src}){
        this.size = [gl.canvas.width, gl.canvas.height]
        this.gl = gl
        this.src = src
        this.pg = new ShaderProgram({gl, vs, fs})
        this.scale = [0, 0]
    }
    async load() {
        if (!this.loaded) {
            let {gl, src} = this
            let image = await loadImage(src)
            let imageSize = [image.width, image.height]
            this.scale = [imageSize[0] / this.size[0], imageSize[1] / this.size[1]]
            this.imageTexture = twgl.createTexture(gl, {src: image}) 
            this.loaded = true    
        }
    }
    render() {
        if (this.loaded) {
            this.pg.execute({
                scale: this.scale,
                tex: this.imageTexture
            })    
        }
    }
    unload() {
        let {gl, imageTexture} = this
        gl.deleteTexture(imageTexture)
        this.pg.release()
        this.pg = null
        this.texture = null
        this.image = null
        this.loaded = false
    }
}
