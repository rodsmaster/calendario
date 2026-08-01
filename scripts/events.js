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

/**
 * Fallback cliente para consumo de ICS quando Cloud Functions não está implantado no ambiente local
 */
const fetchClientSideFallback = async (cal) => {
    const rawUrl = cal.url
        .replace(/^https:\/\/corsproxy\.io\/\?/, '')
        .replace(/^https:\/\/api\.allorigins\.win\/raw\?url=/, '');

    const urlsToTry = [
        `https://corsproxy.io/?${encodeURIComponent(rawUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(rawUrl)}`,
        rawUrl
    ];

    for (const url of urlsToTry) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                const text = await response.text();
                if (text && text.includes('BEGIN:VCALENDAR')) {
                    return parseICSClient(text, cal);
                }
            }
        } catch (e) {
            // Tenta próxima URL
        }
    }
    return [];
};

/**
 * Busca calendários externos priorizando a Firebase Cloud Function (/api/calendar)
 */
export const fetchExternalCalendars = async (activeSources) => {
    let allEvents = [];
    for (const cal of calendarsConfig) {
        if (!activeSources.includes(cal.id)) continue;
        let eventsFetched = null;

        // 1. Tenta via Cloud Function com cache no Firestore (/api/calendar)
        try {
            const apiUrl = `/api/calendar?url=${encodeURIComponent(cal.url)}&id=${encodeURIComponent(cal.id)}&name=${encodeURIComponent(cal.nome)}&color=${encodeURIComponent(cal.cor)}`;
            const response = await fetch(apiUrl);
            if (response.ok) {
                const data = await response.json();
                if (data && Array.isArray(data.events)) {
                    eventsFetched = data.events;
                }
            }
        } catch (e) {
            console.warn(`Cloud Function /api/calendar indisponível para ${cal.nome}. Usando fallback local.`, e);
        }

        // 2. Fallback local se a Cloud Function não respondeu
        if (!eventsFetched) {
            eventsFetched = await fetchClientSideFallback(cal);
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