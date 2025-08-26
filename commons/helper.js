import { DateTime } from "luxon";
import request from 'supertest';
import { TIME_FORMAT } from "./constants.js";
import app from '../base/index.js';
import { ProfileBuilder } from "../builders/profile-builder.js";
import { Faker, en_IN, ta_IN, fakerEN_IN } from '@faker-js/faker';

const faker = new Faker({ locale: [en_IN, ta_IN] });

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

export function generateSlots(start, end, slotSizeMinutes) {
    const slots = [];
    let slotStart = start;

    while (slotStart.plus({ minutes: slotSizeMinutes }) <= end) {
        slots.push({
            start: slotStart,
            end: slotStart.plus({ minutes: slotSizeMinutes })
        });
        slotStart = slotStart.plus({ minutes: slotSizeMinutes });
    }

    return slots;
}

export function isOverlapping(slot, unavailableIntervals) {
    return unavailableIntervals.some(interval =>
        slot.start < interval.end && slot.end > interval.start
    );
}


export async function fetchProfile(id) {
    let res = await request(app).get(`/profiles/${id}`);
    return res;
}

export async function createProfile() {
    let request_body = createProfileRequest();
    let res = await request(app).post(`/profiles/create`)
        .send(request_body);
    return { request_body, res };
}

export async function fetchHours(account_id) {
    let res = await request(app).get(`/hours/${account_id}`);
    return res;
}


function createProfileRequest() {
    return new ProfileBuilder().setCompanyName(fakerEN_IN.company.name()).setTimezone(fakerEN_IN.location.timeZone()).setLocation(fakerEN_IN.location.streetAddress()).setEmail(fakerEN_IN.internet.email()).setPhone(fakerEN_IN.phone.number()).build();
}