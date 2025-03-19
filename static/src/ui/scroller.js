import { MouseInput } from "./mouse.js"
import { ShaderProgram } from "/static/src/glHelper.js"

export class GLScroller {
    vs = /*glsl*/`
        #version 300 es

        in vec2 position;
        uniform float scroll;
        out vec2 uv;

        void main() 
        {   
            uv = position.xy * .5 + .5;
            uv += vec2(0., scroll);
            gl_Position = vec4(position, 0., 1.);
        }
    `

    fs = /*glsl*/`
        #version 300 es
        precision highp float;
        uniform sampler2D tex0;
        uniform sampler2D tex1;
        uniform sampler2D tex2;
        in vec2 uv;
        out vec4 color;

        void main() 
        {
            vec4 textureColor = vec4(0.);
            if (uv.y < 0.) {
                textureColor = texture(tex2, vec2(uv.x, -uv.y));
            }
            else if (uv.y > 0. && uv.y <= 1.) {
                textureColor = texture(tex1, vec2(uv.x, -uv.y));
            }
            else if (uv.y > 1.) {
                textureColor = texture(tex0, vec2(uv.x, 1. - uv.y));
            }
            color = vec4(textureColor.rgb, 1.);
        }
    `
    constructor({gl, pages}) {
        let canvas = gl.canvas
        this.gl = gl
        this.pages = pages
        this.canvas = canvas
        this.size = [canvas.width, canvas.height]
        this.scrollStep = .1
        this.scrollTarget = 0
        this.scrollThreshold = .1
        this.pageIndex = 0
        this.scroll = 0
        this.pg = new ShaderProgram({gl, vs: this.vs, fs: this.fs})
        this.fbi0 = twgl.createFramebufferInfo(gl, [{ minMag: gl.NEAREST, wrap: gl.REPEAT }], this.size[0], this.size[1])
        this.fbi1 = twgl.createFramebufferInfo(gl, [{ minMag: gl.NEAREST, wrap: gl.REPEAT }], this.size[0], this.size[1])
        this.fbi2 = twgl.createFramebufferInfo(gl, [{ minMag: gl.NEAREST, wrap: gl.REPEAT }], this.size[0], this.size[1])
        
        this.dragManager = new MouseInput(canvas)
        this.dragManager.onDragStart = this.onDragStart.bind(this)    
        this.dragManager.onDragUpdate = this.onDragUpdate.bind(this)
        this.dragManager.onDragEnd = this.onDragEnd.bind(this)
    }
    onDragStart() {
        return this.scrollTarget == 0
    }
    onDragUpdate() {
        this.scroll = this.dragManager.dragOffset[1] / this.canvas.height
        this.scrollTarget = this.scroll
    }
    onDragEnd() {
        if (this.scroll > this.scrollThreshold) {
            this.scrollTarget = 1
        }
        else if (-this.scroll > this.scrollThreshold) {
            this.scrollTarget = -1
        }
        else {
            this.scrollTarget = 0
        }
    }
    changePage(direction) {
        this.pageIndex = this.getOffsetIndex(direction)
    }
    getPageAtIndex(index) {
        let c = this.pages[index]
        return c
    }
    getOffsetIndex(offset) {
        let {pageIndex, pages} = this
        pageIndex += offset
        if (pageIndex >= pages.length) {
            pageIndex = 0
        }
        else if(pageIndex < 0) {
            pageIndex = pages.length - 1
        }
        return pageIndex
    }
    getPageAtOffset(offset) {
        let index = this.getOffsetIndex(offset)
        return this.getPageAtIndex(index)
    }
    renderPageAtOffset(offset, ctx) {
        let {gl} = this
        let c = this.getPageAtOffset(offset)
        let fbi = this[`fbi${offset + 1}`]
        twgl.bindFramebufferInfo(gl, fbi)        
        gl.clear(gl.COLOR_BUFFER_BIT)
        c.render(ctx)
        twgl.bindFramebufferInfo(gl, null)
        return fbi
    }
    render(ctx) {
        let fbi0 = this.renderPageAtOffset(-1, ctx)
        let fbi1 = this.renderPageAtOffset(0, ctx)
        let fbi2 = this.renderPageAtOffset(1, ctx)
        
        let scrollDelta = this.scrollTarget - this.scroll
        let scrollDirection = 0
        if (scrollDelta > 0) {
            scrollDirection = 1
        }
        else if (scrollDelta < 0) {
            scrollDirection = -1
        }
        if (scrollDelta != 0) {
            this.scroll += scrollDirection * Math.min(Math.abs(scrollDelta), this.scrollStep)
        }
        else {
            if (this.scroll == 1) {
                this.changePage(-1)
                this.scroll = 0
                this.scrollTarget = 0
            }
            else if (this.scroll == -1) {
                this.changePage(1)
                this.scroll = 0
                this.scrollTarget = 0
            }
        }
        this.pg.execute({
            scroll: this.scroll,
            tex0: fbi0.attachments[0],
            tex1: fbi1.attachments[0],
            tex2: fbi2.attachments[0],
        })        
    }
}
