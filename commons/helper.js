import { DateTime } from "luxon";
import request from 'supertest';
import { TIME_FORMAT, TIME_ZONE } from "./constants.js";
import app from '../base/index.js';
import { ProfileBuilder } from "../builders/profile-builder.js";
import { Faker, en_IN, ta_IN, fakerEN_IN, fakerEN } from '@faker-js/faker';
import { EventBuilder } from "../builders/event-builder.js";

const faker = new Faker({ locale: [en_IN, ta_IN] });

export async function bookEvent(account_id) {
    let request_body = createEventRequest(account_id);
    let response = await request(app)
        .post('/events/book')
        .send(request_body);
    return { request_body, response };
}

export async function bookEventByTime(start, end, account_id) {
    let request_body = createEventRequestByTime(start, end, account_id);
    let response = await request(app)
        .post('/events/book')
        .send(request_body);
    return { request_body, response };
}

export async function getEvents() {
    let res = await request(app).get('/events');
    return res;
}

export async function UpdateEvent(id, account_id) {
    let request_body = updateEventRequest(id, account_id);
    let response = await request(app)
        .put(`/events/${id}`)
        .send(request_body);
    return { request_body, response };
}

export async function UpdateEventByStartEnd(start, end, id, account_id) {
    let request_body = updateEventRequestByTime(start, end, id, account_id);
    let response = await request(app)
        .put(`/events/${id}`)
        .send(request_body);
    return { request_body, response };
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
    return new ProfileBuilder().setCompanyName(fakerEN_IN.company.name())
        .setTimezone(fakerEN_IN.location.timeZone()).setLocation(fakerEN_IN.location.streetAddress())
        .setEmail(fakerEN_IN.internet.email()).setPhone(fakerEN_IN.phone.number()).build();
}

function createEventRequest(account_id) {
    let currentTime = DateTime.now().setZone(TIME_ZONE);
    let startTime = currentTime.toFormat(TIME_FORMAT);
    let endTime = currentTime.plus({ hour: 1 }).toFormat(TIME_FORMAT);
    return new EventBuilder().setAccount(account_id).setTitle(fakerEN.word.words(3)).setStartTime(startTime).setEndTime(endTime).build();
}

function createEventRequestByTime(start, end, account_id) {
    return new EventBuilder().setAccount(account_id).setTitle(fakerEN.word.words(3)).setStartTime(start).setEndTime(end).build();
}

function updateEventRequest(id, account_id) {
    let currentTime = DateTime.now().setZone(TIME_ZONE);
    let startTime = currentTime.toFormat(TIME_FORMAT);
    return new EventBuilder().setId(id).setAccount(account_id).setTitle(fakerEN.word.words(3)).setStartTime(startTime).setEndTime(endTime).build();
}

function updateEventRequestByTime(start, end, id, account_id) {
    return new EventBuilder().setId(id).setAccount(account_id).setTitle(fakerEN.word.words(3)).setStartTime(start).setEndTime(end).build();
}

export function convertToUTC(time) {
    return DateTime.fromISO(time, { zone: 'utc' }).toISO({ suppressMilliseconds: true });
}

export function UTCToLocal(time, timezone) {
    return DateTime.fromISO(time, { zone: timezone }).toFormat(TIME_FORMAT);
}

export async function fetchEventById(id) {
    let response = await request(app).get(`/events/${id}`);
    return response;
}
