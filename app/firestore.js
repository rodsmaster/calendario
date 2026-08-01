import { db, isFirebaseConfigured } from './firebase.js';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getCurrentUser } from './auth-controller.js';

const LOCAL_EVENTS_KEY = 'demo_calendar_events';

const getLocalEvents = () => {
    try {
        const data = localStorage.getItem(LOCAL_EVENTS_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
};

const saveLocalEvents = (events) => {
    localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(events));
};

export const getOwnEvents = async () => {
    const user = getCurrentUser();
    if (!user) return [];

    if (isFirebaseConfigured && db) {
        try {
            const q = query(collection(db, "events"), where("userId", "==", user.uid));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.warn("Erro ao carregar no Firestore, usando fallback local:", e);
        }
    }

    const all = getLocalEvents();
    return all.filter(e => e.userId === user.uid || !e.userId);
};

export const createEvent = async (eventData) => {
    const user = getCurrentUser();
    if (!user) throw new Error("Usuário não autenticado");

    if (isFirebaseConfigured && db) {
        try {
            const docRef = await addDoc(collection(db, "events"), { ...eventData, userId: user.uid });
            return docRef.id;
        } catch (e) {
            console.warn("Erro ao salvar no Firestore, salvando localmente:", e);
        }
    }

    const newId = 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const newEvt = { id: newId, ...eventData, userId: user.uid };
    const events = getLocalEvents();
    events.push(newEvt);
    saveLocalEvents(events);
    return newId;
};

export const updateEvent = async (id, eventData) => {
    if (isFirebaseConfigured && db) {
        try {
            const docRef = doc(db, "events", id);
            await updateDoc(docRef, eventData);
            return;
        } catch (e) {
            console.warn("Erro ao atualizar no Firestore, atualizando localmente:", e);
        }
    }

    const events = getLocalEvents();
    const idx = events.findIndex(e => e.id === id);
    if (idx !== -1) {
        events[idx] = { ...events[idx], ...eventData };
        saveLocalEvents(events);
    }
};

export const deleteEventData = async (id) => {
    if (isFirebaseConfigured && db) {
        try {
            const docRef = doc(db, "events", id);
            await deleteDoc(docRef);
            return;
        } catch (e) {
            console.warn("Erro ao deletar no Firestore, deletando localmente:", e);
        }
    }

    let events = getLocalEvents();
    events = events.filter(e => e.id !== id);
    saveLocalEvents(events);
};