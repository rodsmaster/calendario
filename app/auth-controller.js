import { auth, isFirebaseConfigured } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const DEMO_USER_KEY = 'demo_calendar_user';

export const requireAuth = (callback) => {
    if (isFirebaseConfigured && auth) {
        return onAuthStateChanged(auth, (user) => {
            if (user) {
                if (callback) callback(user);
            } else {
                window.location.href = 'login.html';
            }
        });
    } else {
        const demoUser = localStorage.getItem(DEMO_USER_KEY);
        if (demoUser) {
            if (callback) callback(JSON.parse(demoUser));
        } else {
            window.location.href = 'login.html';
        }
        return () => {};
    }
};

export const loginDemoUser = () => {
    const userObj = {
        uid: 'demo_user_123',
        displayName: 'Usuário Demo',
        email: 'demo@calendario.local'
    };
    localStorage.setItem(DEMO_USER_KEY, JSON.stringify(userObj));
    return userObj;
};

export const logoutUser = async () => {
    if (isFirebaseConfigured && auth) {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Erro ao sair", error);
        }
    }
    localStorage.removeItem(DEMO_USER_KEY);
    window.location.href = 'login.html';
};

export const getCurrentUser = () => {
    if (isFirebaseConfigured && auth && auth.currentUser) {
        return auth.currentUser;
    }
    const demoUser = localStorage.getItem(DEMO_USER_KEY);
    return demoUser ? JSON.parse(demoUser) : null;
};