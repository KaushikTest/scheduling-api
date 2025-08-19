import { DateTime } from "luxon";
import request from 'supertest';
import { TIME_FORMAT } from "./constants.js";
import app from './index.js';

export async function bookEvent() {

    let currentTime = DateTime.now().setZone('Asia/Kolkata');
    let startTime = currentTime.toFormat(TIME_FORMAT);
    let endTime = currentTime.plus({ hour: 1 }).toFormat(TIME_FORMAT);
    let res = await request(app)
        .post('/events/book')
        .send({
            title: "Meeting 1",
            startTime: startTime,
            endTime: endTime
        });
    return res;

}

export async function bookEventByTime(start, end) {

    let res = await request(app)
        .post('/events/book')
        .send({
            title: "Meeting 1",
            startTime: start,
            endTime: end
        });
    return res;
}

export async function getEvents() {
    let res = await request(app).get('/events');
    return res;
}

export async function UpdateEvent(id) {

    let currentTime = DateTime.now().setZone('Asia/Kolkata');
    let startTime = currentTime.toFormat(TIME_FORMAT);
    let endTime = currentTime.plus({ hour: 1 }).toFormat(TIME_FORMAT);
    let res = await request(app)
        .put(`/events/${id}`)
        .send({
            title: 'Updated Title',
            startTime: startTime,
            endTime: endTime
        });
    return res;
}

export async function DeleteEvent(id) {
    let res = await request(app).delete(`/events/${id}`);
    return res;

}