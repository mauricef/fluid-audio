export class Mp4Recorder {
    constructor({canvas, fps, audioSource}) {
        this.canvas = canvas
        this.fps = fps
        this.audioSource = audioSource
        this.frameNumber = 0
    }
    async init() {
        let {canvas, fps, audioSource} = this
        this.muxer = new Mp4Muxer.Muxer({
            target: new Mp4Muxer.ArrayBufferTarget(),
            video: {
                // If you change this, make sure to change the VideoEncoder codec as well
                codec: "avc",
                width: canvas.width,
                height: canvas.height,
            },
            audio: audioSource ? {
                codec: 'aac',
                sampleRate: this.audioSampleRate,
                numberOfChannels: this.audioChannelCount,
            } : null,
            fastStart: "in-memory",
            firstTimestampBehavior: 'offset'
        })

        this.videoEncoder = new VideoEncoder({
            output: (chunk, meta) => this.muxer.addVideoChunk(chunk, meta),
            error: function(e) { 
                console.error(e)
            },
        })
        this.videoEncoder.configure({
            //https://dmnsgn.github.io/media-codecs
            codec: "avc1.64003e",
            width: canvas.width,
            height: canvas.height,
            hardwareAcceleration: "prefer-hardware",
            bitrate: 20_000_000,
            bitrateMode: "variable",
        })
        await this.videoEncoder.flush()

        if (this.audioSource) {
            this.audioEncoder = new AudioEncoder({
                output: this.onAudioAddChunk.bind(this),
                error: this.onAudioEncodingError.bind(this)
            })
            let audioEncoderConfig = {
                codec: 'aac',
                numberOfChannels: this.audioChannelCount,
                sampleRate: this.audioSampleRate,
                bitrate: 128_000,
                bitrateMode: 'constant'
            }
            this.audioEncoder.configure(audioEncoderConfig)
            await this.audioEncoder.flush()
        
            let trackProcessor = new MediaStreamTrackProcessor({track: this.audioTrack})
            trackProcessor.readable.pipeTo(new WritableStream({
                write: this.onWriteAudioData.bind(this)
            }))
        }
    }
    get audioSampleRate() {
        return this.audioSource.context.sampleRate
    }
    get audioChannelCount() {
        return this.audioSource.channelCount
    }
    get audioTrack() {
        return this.audioSource.mediaStream.getTracks()[0]
    }
    onAudioAddChunk(chunk, meta) {
        this.muxer.addAudioCHunk(chunk, meta)
    }
    onAudioEncodingError(message) {
        console.error(message)
    }
    onWriteAudioData(audioData) {
        this.audioEncoder.encode(audioData)
        audioData.close()
    }
    captureFrame() {
        let frame = new VideoFrame(this.canvas, {
            timestamp: (this.frameNumber * 1e6) / this.fps,
            duration: 1e6 / this.fps
        })
        this.videoEncoder.encode(frame)
        this.frameNumber++
        frame.close()
    }

    async finish() {
        const {audioEncoder, videoEncoder, muxer} = this
        if (videoEncoder) await videoEncoder.flush()
        if (audioEncoder) await audioEncoder.flush()
        muxer.finalize()
        let buffer = muxer.target.buffer
        return new Blob([buffer])
    }
}