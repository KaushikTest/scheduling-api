class Event {
    constructor(id, title, startTime, endTime, status) {
        this.id = id;
        this.title = title;
        this.startTime = startTime;
        this.endTime = endTime;
    }
}

class EventBuilder {

    constructor() {

    }
    setId(id) {
        this.id = id;
        return id;
    }
    setTitle(title) {
        this.title = title;
        return this;
    }

    setStartTime(startTime) {
        this.startTime = startTime;
        return this;
    }

    setEndTime(endTime) {
        this.endTime = endTime;
        return this;
    }

    setStatus(status) {
        this.status = status;
        return this;
    }

    build() {
        return new Event(this.id, this.title, this.startTime, this.endTime, this.status)
    }
}