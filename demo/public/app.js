const element = id => document.getElementById(id);
const dateInput = element('date');
const titleInput = element('title');
const state = { config: null, slots: [], bookings: [], selected: null, loadedDate: null, loading: true, pending: null };
let readVersion = 0;
let readController;

class ApiError extends Error {
    constructor(status) { super(`API returned ${status}`); this.status = status; }
}

async function request(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
    if (!response.ok) throw new ApiError(response.status);
    return response.json();
}

function message(id, text = '') {
    element(id).textContent = text;
    element(id).hidden = !text;
}

function time(iso) {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(new Date(iso));
}

function timeRange(start, end) { return `${time(start)}–${time(end)}`; }
function dateLabel(date) {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).format(new Date(`${date}T12:00:00+05:30`));
}

function node(tag, className, text) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== undefined) item.textContent = text;
    return item;
}

function controls() {
    const pending = Boolean(state.pending);
    const usable = state.config && state.loadedDate === dateInput.value && !state.loading;
    dateInput.disabled = !state.config || pending;
    titleInput.disabled = !state.config || pending;
    element('weekday').disabled = !state.config || pending;
    element('closed-day').disabled = !state.config || pending;
    element('refresh').disabled = !state.config || pending || state.loading;
    element('slots').disabled = !usable || pending;
    for (const button of element('bookings').querySelectorAll('button')) button.disabled = !usable || pending;
    element('confirm').disabled = !usable || pending || !state.selected || !titleInput.value.trim();
    element('confirm').firstChild.textContent = state.pending?.kind === 'book' ? 'Confirming… ' : 'Confirm booking ';
    element('booking-form').setAttribute('aria-busy', String(pending));
    element('slots-region').setAttribute('aria-busy', String(state.loading));
    element('bookings').setAttribute('aria-busy', String(state.loading));
    element('loading').hidden = !state.loading && !pending;
    if (pending && !state.loading) element('loading').textContent = state.pending.kind === 'book'
        ? 'Confirming booking…' : 'Cancelling booking…';
}

function selection() {
    element('selection').textContent = state.selected
        ? `${timeRange(state.selected.start, state.selected.end)} IST · ${dateLabel(dateInput.value)}`
        : 'Select an available time above.';
    element('selection').classList.toggle('chosen', Boolean(state.selected));
    controls();
}

function renderSlots() {
    const slots = element('slots');
    slots.replaceChildren(node('legend', 'sr-only', 'Available times, Asia/Kolkata'));
    for (const slot of state.slots) {
        const label = node('label', 'slot');
        const input = node('input');
        input.type = 'radio';
        input.name = 'slot';
        input.value = slot.start;
        input.addEventListener('change', () => {
            if (state.pending || state.loading) return;
            state.selected = slot;
            message('notice');
            message('error');
            selection();
        });
        label.append(input, node('span', '', `${timeRange(slot.start, slot.end)} IST`));
        slots.append(label);
    }
    element('slot-count').textContent = `${state.slots.length} available`;
    const empty = state.slots.length === 0;
    element('slots-empty').hidden = !empty;
    element('empty-title').textContent = 'No availability on this date';
    element('empty-detail').textContent = 'This day is closed or fully booked. Try another date or the seeded Wednesday.';
}

function renderBookings() {
    const container = element('bookings');
    container.replaceChildren();
    for (const booking of state.bookings) {
        const card = node('article', 'booking-card');
        card.setAttribute('aria-label', booking.title);
        card.dataset.eventId = booking.id;
        const bottom = node('div', 'booking-bottom');
        const cancel = node('button', 'cancel-button', 'Cancel booking');
        cancel.type = 'button';
        cancel.addEventListener('click', () => cancelBooking(booking));
        bottom.append(node('span', 'event-status', booking.status), cancel);
        card.append(node('p', 'booking-time', `${timeRange(booking.startTime, booking.endTime)} IST`),
            node('h3', '', booking.title), bottom);
        container.append(card);
    }
    element('booking-count').textContent = String(state.bookings.length);
    element('bookings-empty').hidden = state.bookings.length !== 0;
}

async function loadDate() {
    const version = ++readVersion;
    readController?.abort();
    readController = new AbortController();
    state.selected = null;
    state.loadedDate = null;
    state.loading = true;
    state.slots = [];
    state.bookings = [];
    element('slots').replaceChildren();
    element('bookings').replaceChildren();
    element('slots-empty').hidden = true;
    element('bookings-empty').hidden = true;
    element('slot-count').textContent = '—';
    element('booking-count').textContent = '—';
    message('error');
    message('notice');
    selection();
    const date = dateInput.value;
    if (!date || !dateInput.validity.valid) {
        state.loading = false;
        element('bookings-date').textContent = 'Choose a valid date to see your day.';
        message('error', 'Choose a valid date to load availability.');
        controls();
        return false;
    }
    element('bookings-date').textContent = dateLabel(date);
    element('loading').textContent = 'Loading availability…';
    const query = new URLSearchParams({ account_id: state.config.accountId, date });
    try {
        const [slots, events] = await Promise.all([
            request(`/slots?${query}&slot_size_minutes=60`, { signal: readController.signal }),
            request(`/events?${query}`, { signal: readController.signal }),
        ]);
        // Aborting alone is insufficient if an older response already completed.
        if (version !== readVersion) return false;
        if (!Array.isArray(slots.available_slots) || !Array.isArray(events.events)) throw new Error('Invalid API response');
        state.slots = slots.available_slots;
        state.bookings = events.events.filter(event => !['cancelled', 'released'].includes(event.status));
        state.loadedDate = date;
        renderSlots();
        renderBookings();
        return true;
    } catch (error) {
        if (version !== readVersion) return false;
        readController.abort();
        message('error', 'Could not load this date. Check that the local demo is running, then select Refresh to try again.');
        return false;
    } finally {
        if (version === readVersion) {
            state.loading = false;
            controls();
        }
    }
}

async function mutate(kind, path, options) {
    if (state.pending || state.loading || state.loadedDate !== dateInput.value) return;
    state.pending = { kind };
    message('error');
    message('notice');
    controls(); // Synchronous guard before awaiting: repeated clicks cannot submit twice.
    try {
        const result = await request(path, options);
        if (kind === 'book' && !result.event?.id) throw new Error('Invalid booking response');
        const refreshed = await loadDate();
        if (refreshed) message('notice', kind === 'book'
            ? 'Booking confirmed. Your time is reserved in this local demo.'
            : 'Booking cancelled. Availability has been refreshed.');
        else message('error', kind === 'book'
            ? 'Booking saved, but the latest availability could not be loaded. Select Refresh to check your day.'
            : 'Cancellation saved, but the latest availability could not be loaded. Select Refresh to check your day.');
    } catch (error) {
        // Never retry a write automatically: a lost response may follow a saved write.
        await loadDate();
        message('error', error.status === 409
            ? 'That time was just booked. Check availability and choose another slot.'
            : kind === 'book'
                ? 'Booking could not be confirmed. Refresh availability and check your bookings before trying again.'
                : 'Cancellation could not be confirmed. Refresh availability and check your bookings before trying again.');
    } finally {
        state.pending = null;
        controls();
    }
}

element('booking-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!state.selected || !titleInput.value.trim()) return;
    const slot = state.selected;
    mutate('book', '/events/book', {
        method: 'POST', body: JSON.stringify({ account_id: state.config.accountId, title: titleInput.value.trim(),
            startTime: slot.start, endTime: slot.end }),
    });
});

function cancelBooking(booking) {
    mutate('cancel', `/events/${encodeURIComponent(booking.id)}`, { method: 'DELETE' });
}

dateInput.addEventListener('change', loadDate);
titleInput.addEventListener('input', controls);
element('refresh').addEventListener('click', loadDate);
element('weekday').addEventListener('click', () => { dateInput.value = state.config.weekday; loadDate(); });
element('closed-day').addEventListener('click', () => { dateInput.value = state.config.closedDay; loadDate(); });

try {
    state.config = await request('/demo/config.json');
    if (state.config.timezone !== 'Asia/Kolkata' || !state.config.accountId || !state.config.weekday) {
        throw new Error('Unsupported demo configuration');
    }
    dateInput.value = state.config.weekday;
    await loadDate();
} catch (error) {
    state.config = null;
    state.loading = false;
    message('error', 'Could not prepare the local demo. Restart it with npm run demo, then reload this page.');
    controls();
}
