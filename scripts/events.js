import { calendarsConfig } from './calendar-config.js';
import { getOwnEvents } from '../app/firestore.js';

/**
 * Parser ICS cliente utilizado como fallback no modo offline / sem Cloud Functions
 */
const parseICSClient = (icsText, configInfo) => {
    const events = [];
    try {
        if (typeof ICAL === 'undefined') return [];

        const jcalData = ICAL.parse(icsText);
        const comp = new ICAL.Component(jcalData);
        const vevents = comp.getAllSubcomponents("vevent");

        vevents.forEach(vevent => {
            const event = new ICAL.Event(vevent);
            if (!event.startDate) return;

            const startDate = event.startDate.toJSDate();
            const endDate = event.endDate ? event.endDate.toJSDate() : null;

            events.push({
                id: `${configInfo.id}_${event.uid || Math.random().toString(36).substring(2, 8)}`,
                title: event.summary || configInfo.nome,
                start: startDate,
                end: endDate,
                allDay: event.startDate.isDate,
                backgroundColor: configInfo.cor,
                borderColor: configInfo.cor,
                extendedProps: {
                    sourceId: configInfo.id,
                    sourceName: configInfo.nome,
                    description: event.description || '',
                    readonly: true
                }
            });
        });
    } catch (e) {
        console.error(`Erro ao parsear ICS no cliente: ${configInfo.nome}`, e);
    }
    return events;
};

const REMOTE_CLOUD_FUNCTION = 'https://us-central1-calendario-65044.cloudfunctions.net/fetchCalendarFeed';

/**
 * Fallback cliente para consumo de ICS quando Cloud Functions não está implantado no ambiente local
 */
const fetchClientSideFallback = async (cal) => {
    const rawUrl = cal.url
        .replace(/^https:\/\/corsproxy\.io\/\?/, '')
        .replace(/^https:\/\/api\.allorigins\.win\/raw\?url=/, '')
        .replace(/^https:\/\/api\.allorigins\.win\/get\?url=/, '');

    try {
        const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(rawUrl)}`);
        if (response.ok) {
            const data = await response.json();
            let text = data.contents || '';
            if (text.startsWith('data:')) {
                const base64Str = text.split(',')[1];
                if (base64Str) {
                    const binaryString = atob(base64Str);
                    const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
                    text = new TextDecoder().decode(bytes);
                }
            }
            if (text && text.includes('BEGIN:VCALENDAR')) {
                return parseICSClient(text, cal);
            }
        }
    } catch (e) {
        console.warn(`Fallback cliente falhou para ${cal.nome}`, e);
    }
    return [];
};

const normalizeDate = (dateVal) => {
    if (!dateVal) return null;
    if (typeof dateVal === 'object') {
        if (typeof dateVal.toMillis === 'function') return new Date(dateVal.toMillis()).toISOString();
        if (typeof dateVal._seconds === 'number') return new Date(dateVal._seconds * 1000).toISOString();
        if (typeof dateVal.seconds === 'number') return new Date(dateVal.seconds * 1000).toISOString();
    }
    try {
        return new Date(dateVal).toISOString();
    } catch (e) {
        return dateVal;
    }
};

const normalizeEvents = (events) => {
    if (!Array.isArray(events)) return [];
    return events.map(evt => ({
        ...evt,
        start: normalizeDate(evt.start),
        end: normalizeDate(evt.end)
    }));
};

/**
 * Busca calendários externos priorizando a Firebase Cloud Function (/api/calendar ou Cloud Function remota)
 */
export const fetchExternalCalendars = async (activeSources) => {
    let allEvents = [];
    for (const cal of calendarsConfig) {
        if (!activeSources.includes(cal.id)) continue;
        let eventsFetched = null;

        const queryParams = `url=${encodeURIComponent(cal.url)}&id=${encodeURIComponent(cal.id)}&name=${encodeURIComponent(cal.nome)}&color=${encodeURIComponent(cal.cor)}`;

        // 1. Tenta via Cloud Function relativa (/api/calendar)
        try {
            const response = await fetch(`/api/calendar?${queryParams}`);
            if (response.ok) {
                const data = await response.json();
                if (data && Array.isArray(data.events)) {
                    eventsFetched = normalizeEvents(data.events);
                }
            }
        } catch (e) {
            console.warn(`Cloud Function relativa /api/calendar indisponível para ${cal.nome}.`, e);
        }

        // 2. Tenta via Cloud Function remota do Firebase se a relativa falhou (ex: ambiente local)
        if (!eventsFetched) {
            try {
                const response = await fetch(`${REMOTE_CLOUD_FUNCTION}?${queryParams}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data && Array.isArray(data.events)) {
                        eventsFetched = normalizeEvents(data.events);
                    }
                }
            } catch (e) {
                console.warn(`Cloud Function remota indisponível para ${cal.nome}.`, e);
            }
        }

        // 3. Fallback cliente local se nenhuma Cloud Function respondeu
        if (!eventsFetched) {
            const rawEvents = await fetchClientSideFallback(cal);
            eventsFetched = normalizeEvents(rawEvents);
        }

        if (eventsFetched) {
            allEvents = [...allEvents, ...eventsFetched];
        }
    }
    return allEvents;
};

export const fetchFirestoreEvents = async () => {
    try {
        const events = await getOwnEvents();
        return events.map(e => ({
            id: e.id,
            title: e.title,
            start: e.start,
            end: e.end,
            backgroundColor: 'var(--primary-color)',
            borderColor: 'var(--primary-hover)',
            extendedProps: {
                description: e.description || '',
                sourceId: 'own',
                readonly: false
            }
        }));
    } catch (error) {
        console.error("Erro ao buscar eventos próprios", error);
        return [];
    }
};