export default class Timer {

    private name: string
    private startTime: number
    private endTime: number

    constructor(name: string){
        this.name = name
    }

    start(){
        if(typeof this.startTime === 'number'){
            throw new Error('timer already started: ' + this.name)
        }

        console.log('Timer started:', this.name)
        this.startTime = performance.now()

        return this
    }

    end(){
        if(typeof this.endTime === 'number'){
            throw new Error('timer already stopped: ' + this.name)
        }

        this.endTime = performance.now()
        console.log('Timer ended:', this.name, Math.floor(this.endTime - this.startTime), 'ms')

        return this
    }
}