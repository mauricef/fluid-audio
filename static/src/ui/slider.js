import { clamp01 } from "../math.js"

export class Slider {
    constructor({
        label,
        initialValue,
        onValueChanged
    }) {
        this.label = label
        this.position = [initialValue, 0]
        this.onValueChanged = onValueChanged
    }
    get value() {
        return this.position[0]
    }
    onDragUpdate(delta) {
        let [px, py] = this.position
        let [dx, dy] = delta
        console.log([dx, dy])
        px = clamp01(px + dx)
        py = clamp01(py + dy)
        this.position[0] = px
        this.position[1] = py
        this.onValueChanged(this.value)
    }
    render(ctx, {x, y, w, h}) {
        let {value} = this
        let barWidth = .01 * w
        let center = x + value * w
        ctx.fillStyle = 'black'
        ctx.fillRect(x, y, w, h)
        
        ctx.fillStyle = 'white'
        ctx.fillRect(center - barWidth, y, 2 * barWidth, h)

        ctx.fillStyle = 'red'
        ctx.font = "32px mono"
        ctx.textAlign = 'middle'
        ctx.textBaseline = 'middle'
        ctx.fillText(this.label, x + .5 * w, y + .5 * h)

    }
}
