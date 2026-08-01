import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import { firebaseConfig } from "../scripts/firebase-config.js";

export const isFirebaseConfigured = firebaseConfig && 
    firebaseConfig.apiKey && 
    firebaseConfig.apiKey !== "SUA_API_KEY" &&
    firebaseConfig.projectId !== "SEU_PROJETO";

let app = null;
let auth = null;
let db = null;
let provider = null;
let functions = null;

if (isFirebaseConfigured) {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        provider = new GoogleAuthProvider();
        functions = getFunctions(app);
    } catch (e) {
        console.warn("Falha na inicialização do Firebase. Ativando modo local.", e);
    }
}

export { auth, db, provider, functions };