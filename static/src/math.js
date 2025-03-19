export function toLogScale01(x, scale) {
    scale = scale || 1
    scale = Math.max(1, scale)
    let a = 1
    let b = Math.exp(scale) - 1
    return (Math.exp(scale * x) - a) / b
}

export function fromLogScale01(x, scale) {
    scale = scale || 1
    scale = Math.max(1, scale)
    let a = 1
    let b = Math.exp(scale) - 1
    return Math.log(a + b * x)
}

export function clamp01(a) {
    return Math.max(0, Math.min(1, a))
}

export function powerToDb(value) {
    return 20 * Math.log10(value)
}

export function dbToPower(value) {
    return Math.pow(10, value / 20)
}