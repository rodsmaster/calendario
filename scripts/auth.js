import { auth, provider, isFirebaseConfigured } from '../app/firebase.js';
import { signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { showToast } from './utils.js';
import { initTheme } from './theme.js';
import { loginDemoUser } from '../app/auth-controller.js';

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    
    // Se já estiver logado, redireciona para o app
    if (isFirebaseConfigured && auth) {
        onAuthStateChanged(auth, (user) => {
            if (user || localStorage.getItem('demo_calendar_user')) {
                window.location.href = 'calendario.html';
            }
        });
    } else {
        if (localStorage.getItem('demo_calendar_user')) {
            window.location.href = 'calendario.html';
        }
    }

    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
        btnLogin.addEventListener('click', async () => {
            if (isFirebaseConfigured && auth && provider) {
                try {
                    await signInWithPopup(auth, provider);
                } catch (error) {
                    console.warn("Autenticação com Firebase falhou. Usando sessão local:", error);
                    showToast('Firebase indisponível. Entrando em modo local.', 'success');
                    loginDemoUser();
                    setTimeout(() => window.location.href = 'calendario.html', 500);
                }
            } else {
                loginDemoUser();
                showToast('Entrando em modo de demonstração local...', 'success');
                setTimeout(() => window.location.href = 'calendario.html', 500);
            }
        });
    }
});