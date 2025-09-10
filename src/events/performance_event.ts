export default class PerformanceEvent extends Event {
    public static readonly NAME = "performance";

    constructor() {
        super(PerformanceEvent.NAME);
    }

    ping() {
        console.log('ping')
    }
}