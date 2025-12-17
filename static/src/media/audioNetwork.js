import { AudioFile } from "./audioFile.js"

export async function loadAudioDeviceSource({deviceId, context}) {
    let constraint = { audio: true }
    if (deviceId != null) {
        constraint.audio = { deviceId: deviceId }
    }
    const audioInputStream = await navigator.mediaDevices.getUserMedia(constraint)

    // Log selected device info
    const audioTrack = audioInputStream.getAudioTracks()[0]
    if (audioTrack) {
        const settings = audioTrack.getSettings()
        console.log('Audio track label:', audioTrack.label)
        console.log('Audio track settings:', settings)
        console.log('Audio track enabled:', audioTrack.enabled)
        console.log('Audio track muted:', audioTrack.muted)
        console.log('Audio track readyState:', audioTrack.readyState)
    }

    // List all available audio devices
    const devices = await navigator.mediaDevices.enumerateDevices()
    const audioInputs = devices.filter(d => d.kind === 'audioinput')
    console.log('Available audio inputs:', audioInputs.map(d => `${d.label} (${d.deviceId.slice(0,8)}...)`))

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