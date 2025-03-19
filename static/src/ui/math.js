
export function calculateAspectRatio(size) {
    let [w, h] = size
    let divisor = Math.min(w, h)
    return [w / divisor, h / divisor]
}
