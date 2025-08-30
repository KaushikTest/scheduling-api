class Event {
    constructor(id, account_id, title, startTime, endTime, type, status) {
        this.id = id;
        this.account_id = account_id;
        this.title = title;
        this.startTime = startTime;
        this.endTime = endTime;
        this.type = type;
        this.status = status;
    }
}

class EventBuilder {

    constructor() {

    }
    setId(id) {
        this.id = id;
        return this;
    }

    setAccount(account_id) {
        this.account_id = account_id;
        return this
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

    setType(type) {
        this.type = type;
        return this;
    }

    setStatus(status) {
        this.status = status;
        return this;
    }

    build() {
        return new Event(this.id, this.account_id, this.title, this.startTime, this.endTime, this.type, this.status)
    }
}

export { EventBuilder };