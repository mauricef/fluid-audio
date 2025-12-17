async function run() {
    let urlParams = new URLSearchParams(window.location.search)
    let mode = urlParams.get('mode') || 'hud'
    var module = null
    if (mode == 'hud') {
        module = await import('./hud.js')
    }
    else if(mode == 'server') {
        module = await import('./server.js')
    }
    await module.run()
}
run()