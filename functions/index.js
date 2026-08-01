const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const ICAL = require("ical.js");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

admin.initializeApp();
const db = admin.firestore();

const CACHE_TTL_MINUTES = 30;

/**
 * Função para parsear arquivo ICS em objetos de evento do FullCalendar
 */
function parseICSData(icsText, configInfo = {}) {
    const events = [];
    try {
        const jcalData = ICAL.parse(icsText);
        const comp = new ICAL.Component(jcalData);
        const vevents = comp.getAllSubcomponents("vevent");

        vevents.forEach(vevent => {
            const event = new ICAL.Event(vevent);
            if (!event.startDate) return;

            const startDate = event.startDate.toJSDate().toISOString();
            const endDate = event.endDate ? event.endDate.toJSDate().toISOString() : null;
            const color = configInfo.color || '#2563eb';

            events.push({
                id: `${configInfo.id || 'ext'}_${event.uid || Math.random().toString(36).substring(2, 8)}`,
                title: event.summary || configInfo.name || 'Evento Externo',
                start: startDate,
                end: endDate,
                allDay: event.startDate.isDate,
                backgroundColor: color,
                borderColor: color,
                extendedProps: {
                    sourceId: configInfo.id || 'ext',
                    sourceName: configInfo.name || 'Calendário Externo',
                    description: event.description || '',
                    readonly: true
                }
            });
        });
    } catch (err) {
        console.error("Erro no parseamento ICS na Cloud Function:", err);
    }
    return events;
}

/**
 * Cloud Function HTTP Proxy + Cache Firestore
 */
exports.fetchCalendarFeed = onRequest({ cors: true }, async (req, res) => {
    try {
        const targetUrl = req.query.url;
        const calId = req.query.id || 'default_cal';
        const calName = req.query.name || 'Calendário Externo';
        const calColor = req.query.color || '#2563eb';

        if (!targetUrl) {
            return res.status(400).json({ error: "Parâmetro 'url' é obrigatório." });
        }

        const cacheDocRef = db.collection("calendar_cache").doc(encodeURIComponent(calId));
        const cacheSnap = await cacheDocRef.get();
        const now = Date.now();

        // 1. Verifica se existe cache válido em Firestore
        if (cacheSnap.exists) {
            const cacheData = cacheSnap.data();
            const ageMinutes = (now - (cacheData.updatedAt || 0)) / (1000 * 60);

            if (ageMinutes < CACHE_TTL_MINUTES && Array.isArray(cacheData.events)) {
                const normalizedEvents = cacheData.events.map(evt => ({
                    ...evt,
                    start: evt.start && typeof evt.start === 'object' && typeof evt.start._seconds === 'number'
                        ? new Date(evt.start._seconds * 1000).toISOString()
                        : evt.start,
                    end: evt.end && typeof evt.end === 'object' && typeof evt.end._seconds === 'number'
                        ? new Date(evt.end._seconds * 1000).toISOString()
                        : evt.end
                }));
                res.set('X-Cache-Status', 'HIT');
                return res.json({ events: normalizedEvents, cached: true, updatedAt: cacheData.updatedAt });
            }
        }

        // 2. Se o cache expirou ou não existe, realiza o fetch server-side (Sem CORS)
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MeuCalendarioApp/1.0'
            }
        });

        if (!response.ok) {
            throw new Error(`Falha ao buscar feed ICS: Status HTTP ${response.status}`);
        }

        const icsText = await response.text();
        const parsedEvents = parseICSData(icsText, { id: calId, name: calName, color: calColor });

        // 3. Atualiza o cache no Firestore
        await cacheDocRef.set({
            calendarId: calId,
            url: targetUrl,
            events: parsedEvents,
            updatedAt: now
        }, { merge: true });

        res.set('X-Cache-Status', 'MISS');
        return res.json({ events: parsedEvents, cached: false, updatedAt: now });

    } catch (error) {
        console.error("Erro em fetchCalendarFeed:", error);
        return res.status(500).json({ error: error.message || "Erro interno ao processar feed do calendário." });
    }
});

/**
 * Cloud Function Agendada (Scheduled) para atualizar todos os calendários em cache a cada 2 horas
 */
exports.updateAllCalendarCaches = onSchedule("every 2 hours", async (event) => {
    try {
        const snapshot = await db.collection("calendar_cache").get();
        const promises = snapshot.docs.map(async (doc) => {
            const data = doc.data();
            if (!data.url) return;

            try {
                const res = await fetch(data.url);
                if (res.ok) {
                    const icsText = await res.text();
                    const events = parseICSData(icsText, { id: data.calendarId });
                    await doc.ref.set({
                        events,
                        updatedAt: Date.now()
                    }, { merge: true });
                }
            } catch (err) {
                console.error(`Erro ao atualizar cache de ${data.calendarId}:`, err);
            }
        });

        await Promise.all(promises);
        console.log("Atualização automática dos caches de calendário concluída com sucesso.");
    } catch (e) {
        console.error("Erro na Cloud Function agendada:", e);
    }
});
