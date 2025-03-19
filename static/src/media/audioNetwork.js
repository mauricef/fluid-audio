import { AudioFile } from "./audioFile.js"

export async function loadAudioDeviceSource({deviceId, context}) {
    let constraint = { audio: true}
    if (deviceId != null) {
        constraint[audio] = {deviceId: { exact: deviceId}}
    }
    const audioInputStream = await navigator.mediaDevices.getUserMedia(constraint)
    return context.createMediaStreamSource(audioInputStream)
}

export function loadAudioFileSource({src, context}) {
    return new Promise((resolve, reject) => {
        var source = null
        let audio = new Audio()
        audio.loop = true
        audio.autoplay = true
        audio.addEventListener('canplay', handleCanplay)
        audio.src = src
        audio.load()
        function handleCanplay() {
            if (!source) {
                let stream = audio.captureStream()
                source = context.createMediaStreamSource(stream)
                resolve(source)
            }
        }    
    })
}

export async function connectAudioDeviceOutput({deviceId, destination}) {
    let audioElement = new Audio()
    let stream = destination.stream
    await audioElement.setSinkId(deviceId)
    audioElement.srcObject = stream
    audioElement.play()    
}