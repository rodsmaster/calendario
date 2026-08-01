export const initTheme = () => {
    const btnTheme = document.getElementById('btn-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');
    
    const setTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if(btnTheme) btnTheme.innerHTML = `<span class="material-icons">${theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>`;
    };

    setTheme(savedTheme || (prefersDark ? 'dark' : 'light'));

    if(btnTheme) {
        btnTheme.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            setTheme(current === 'dark' ? 'light' : 'dark');
        });
    }
};