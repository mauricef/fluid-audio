
export class MouseInput {
    constructor(target) {
        this.isDragging = false
        this.dragStartPos = [0, 0]
        this.mousePos = [0, 0]
        this.lastPosition = [0, 0]
        this.target = target

        target.onmousedown = (e) => {
            this.handleDragStart(e)
        }
    
        target.onmousemove = (e) => {
            this.handleDragMove(e)
        }
    
        target.onmouseup = (e) => {
            this.handleDragEnd(e)
        }
    
        target.ontouchstart = (e) => {
            e.preventDefault()
            this.handleDragStart(e.changedTouches[0])
        }
    
        target.ontouchmove = (e) => {
            this.handleDragMove(e.changedTouches[0])
        }
        
        target.ontouchend = (e) => {
            this.handleDragEnd(e.changedTouches[0])
        }
    }
    get mouseDelta() {
        return [this.mousePos[0] - this.lastPosition[0], this.mousePos[1] - this.lastPosition[1]]
    }
    get dragPos() {
        return this.mousePos
    }
    get dragDelta() {
        return this.mouseDelta
    }
    get dragOffset() {
        return [this.dragPos[0] - this.dragStartPos[0],  this.dragPos[1] - this.dragStartPos[1]]
    }
    getPositionFromEvent(e) {
        return [e.clientX, e.clientY]
    }
    handleDragStart(e) {
        this.mousePos = this.getPositionFromEvent(e)
        this.lastPosition = this.mousePos
        var canDrag = true
        if (this.onDragStart) {
            canDrag = this.onDragStart()
        }
        if (canDrag) {
            this.isDragging = true
            this.dragStartPos = this.getPositionFromEvent(e)
        }
    }
    handleDragMove(e) {
        this.lastPosition = this.mousePos
        this.mousePos =  this.getPositionFromEvent(e)
        if (this.isDragging) {
            if (this.onDragUpdate) {
                this.onDragUpdate()
            }    
        }
    }
    handleDragEnd(e) {
        if (this.isDragging && this.onDragEnd) {
            this.onDragEnd()
        }
        this.isDragging = false
        this.mousePos = [0, 0]
        this.dragStartPos = [0, 0]
        this.lastPosition = [0, 0]
    }
}