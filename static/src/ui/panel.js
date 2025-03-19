
import { MouseInput } from "./mouse.js"

export class Panel {
    constructor({canvas, controls}){
        this.ctx = canvas.getContext('2d')
        this.canvas = canvas
        this.mouse = new MouseInput(this.canvas)
        this.mouse.onDragStart = this.onDragStart.bind(this)
        this.mouse.onDragUpdate = this.onDragUpdate.bind(this)
        this.mouse.onDragEnd = this.onDragEnd.bind(this)
        this.controls = controls
        this.selectedControl = null
    }
    get controlCount() {
        return this.controls.length
    }
    get canvasSize() {
        let {canvas} = this
        return [canvas.width, canvas.height]
    }
    get aspectScale() {
        let [w, h] = this.canvasSize
        return Math.min(w, h)
    }
    get aspectRatio() {
        let [w, h] = this.canvasSize
        let aspectScale = this.aspectScale
        return [w / aspectScale, h / aspectScale]
    }
    onDragStart() {
        let [w, h] = this.canvasSize
        let y = this.mouse.mousePos[1]
        let controlIndex = Math.floor(y * this.controlCount / h)
        let control = this.controls[controlIndex]
        let canDrag = true
        if (control.onDragStart) {
            canDrag = selectedControl.onDragStart()
        }
        this.selectedControl = canDrag ? control : null
        return canDrag
    }

    onDragUpdate() {
        let {selectedControl} = this
        if (this.mouse.isDragging && selectedControl.onDragUpdate) {
            let [dx, dy] = this.mouse.dragDelta
            let [w, h] = this.canvasSize
            let [u, v] = [dx / w, dy / h]
            return selectedControl.onDragUpdate([u, v])
        }
    }
    onDragEnd() {
        let {selectedControl} = this
        if (this.mouse.isDragging && selectedControl.onDragEnd) {
            selectedControl.onDragEnd(this.mouse)
        }
        this.selectedControl = null
    }
    
    render() {
        let {ctx, canvas, controls} = this
        let [w, h] = this.canvasSize
        let controlCount = controls.length
        for (let i = 0; i < controlCount; i++) {
            let control = controls[i]
            control.render(ctx, {
                x: 0, y: h * (i / controlCount), 
                w: w, h: h/ controlCount
            })
        }
    }
}