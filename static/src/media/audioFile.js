function loadAudioFile(context, src) {
    return new Promise((resolve, reject) => {
        var source = null
        let audio = new Audio()
        audio.loop = true
        audio.autoplay = true
        audio.addEventListener('canplay', handleCanplay.bind(this))
        audio.src = this.src
        audio.load()
        function handleCanplay() {
            if (!source) {
                source = context.createMediaElementSource(audio)
                destination = context.createMediaStreamDestination()
                resolve(source)
            }
        }    
    })
}

export class AudioFile {
    constructor(src) {
        this.src = src
    }
    play() {
        this.context = new AudioContext()
        this.analyser = this.context.createAnalyser()
        this.numPoints = this.analyser.frequencyBinCount
        this.frequencyArray = new Uint8Array(this.numPoints)

        this.audio = new Audio()
        this.audio.loop = true
        this.audio.autoplay = true
        this.source = null

        this.audio.addEventListener('canplay', handleCanplay.bind(this))
        this.audio.src = this.src
        this.audio.load()

        function handleCanplay() {
            if (!this.source) {
                this.source = this.context.createMediaElementSource(this.audio)
                this.destination = this.context.createMediaStreamDestination()
                this.track = this.destination.stream.getTracks()[0]
                this.source.connect(this.destination)
                this.source.connect(this.analyser)
                this.analyser.connect(this.context.destination)
            }
        }    
    }
    get sampleRate() {
        return this.context ? this.context.sampleRate : null
    }
    get channelCount() {
        return this.source ? this.source.channelCount : null
    }
}
