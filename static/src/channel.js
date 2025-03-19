export class SendChannel {
    constructor(name) {
        this.channel = new BroadcastChannel(name)
    }
    send(name, context) {
        this.channel.postMessage({name, context})
    }
}

export class RecieveChannel {
    constructor(name, target) {
        this.channel = new BroadcastChannel(name)
        this.target = target
        this.channel.onmessage = this.onMessage.bind(this)
    }
    onMessage(event) {
        let key = `on${event.data.name}`
        if (key in this.target) {
            this.target[key](event.data.context)
        }
        else {
            console.log(key)
            throw new Error(`Unkown key ${key}`)
        }
    }
}