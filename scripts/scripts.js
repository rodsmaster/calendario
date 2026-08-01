import { requireAuth, logoutUser } from '../app/auth-controller.js';
import { initTheme } from './theme.js';
import { initCalendar } from './calendar.js';

// Inicializa a aplicação
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    
    // Protege a rota e inicia o calendário se autenticado
    requireAuth((user) => {
        initCalendar();
    });

    // Event listeners base da UI
    document.getElementById('btn-logout').addEventListener('click', logoutUser);
    
    document.getElementById('btn-toggle-sidebar').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });
});