
function getAspectRatio(canvas) {
    if (canvas.width > canvas.height) {
        return [1., canvas.height / canvas.width]
    }
    else {
        return [canvas.width / canvas.height, 1.]
    }
}
export class Pointer {
    constructor(canvas) {
        this.pixelRatio = canvas.width / canvas.clientWidth
        this.canvas = canvas
        this.canvasSize = [this.canvas.width, this.canvas.height]
        this.aspectRatio = getAspectRatio(canvas)
        this.buttons = 0
        this.pos = null
        this.delta = null
        canvas.addEventListener('mousedown', this.onMouseDown.bind(this))
        canvas.addEventListener('mousemove', this.onMouseMove.bind(this))
        canvas.addEventListener('mouseup', this.onMouseUp.bind(this))
    }
    get uv() {
        return this.posToUV(this.pos)
    }
    scaleByPixelRatio (input) {
        return Math.floor(input * this.pixelRatio)
    }
    getPos(e) {
        return [
            this.scaleByPixelRatio(e.offsetX), 
            this.scaleByPixelRatio(e.offsetY)
        ]
    }
    posToUV(pos) {
        return [
            pos[0] / this.canvas.width,
            1 - pos[1] / this.canvas.height
        ]
    }
    onMouseDown(e) {
        this.buttons = e.buttons
        this.pos = this.getPos(e)
        this.delta = [0, 0]
        this.lastEventTime = Date.now()
    }
    onMouseMove(e) {
        let aspectRatio = this.aspectRatio
        let eventTime = Date.now()
        let dt = (eventTime - this.lastEventTime) / 1000
        this.lastEventTime = eventTime
        this.prevPos = this.pos
        this.pos = this.getPos(e)
        let uv = this.posToUV(this.pos)
        let prevUV = this.posToUV(this.prevPos || this.pos)
        let deltaX = uv[0] - prevUV[0]
        let deltaY = uv[1] - prevUV[1]
        this.delta = [deltaX * aspectRatio[0] / dt, deltaY * aspectRatio[1] / dt]
    }
    onMouseUp(e) {
        this.buttons = 0
        this.pos = null
        this.prevPos = null
        this.delta = null
    }
}