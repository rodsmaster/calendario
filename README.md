# 📅 Meu Calendário Web

Calendário web inspirado no Google Calendar, construído com Vanilla JS, HTML5, CSS3, e alimentado por **Firebase Hosting**, **Firebase Authentication**, **Firestore Database** e **Firebase Cloud Functions**.

---

## ⚡ Recursos Principais

- ✅ **Firebase Hosting**: Hospedagem rápida, segura e com certificado SSL automático.
- ✅ **Firebase Authentication**: Autenticação com Google com suporte a modo Demo/Local em desenvolvimento.
- ✅ **Firestore Database**: Banco de dados NoSQL em tempo real para sincronização dos eventos próprios.
- ✅ **Firebase Cloud Functions (Proxy Server-Side)**:
  - **Zero Restrições de CORS**: O download e parsing dos arquivos `.ics` é realizado no servidor.
  - **Compatibilidade Total**: Suporta Google Agenda, Outlook, Apple iCloud e qualquer URL de feed iCal (`.ics`).
- ✅ **Sistema de Cache Inteligente (Firestore Cache)**:
  - Guarda os eventos parseados na coleção `calendar_cache` com TTL configurável.
  - Reduz drasticamente as requisições externas e torna o carregamento instantâneo.
- ✅ **Atualização Automática Agendada**:
  - Scheduled Function que renova o cache dos calendários em segundo plano periodicamente.
- ✅ **Design System Moderno**: Efeito glassmorphism, suporte a temas Claro e Escuro, animações suaves e tipografia Google Fonts *Inter*.

---

## 🏗️ Estrutura do Arquitetura

```
Calendario/
├── app/                        # Controladores Firebase
│   ├── firebase.js             # Inicialização de Auth, Firestore e Functions
│   ├── auth-controller.js      # Gestão de Login/Logout (Firebase + Fallback Demo)
│   └── firestore.js           # CRUD de Eventos no Firestore (com LocalStorage fallback)
├── functions/                  # Backend Firebase Cloud Functions
│   ├── index.js                # Proxy ICS, Firestore Cache & Scheduled Update
│   └── package.json            # Dependências Node.js 18 (ical.js, firebase-admin)
├── scripts/                    # Lógica da Aplicação Frontend
│   ├── calendar-config.js      # Configuração dos Calendários ICS (Google, Outlook, Apple, etc)
│   ├── events.js               # Integração com /api/calendar e fallback
│   ├── calendar.js             # Inicialização do FullCalendar e controle dos Modais
│   ├── auth.js                 # Event listeners da página de login
│   ├── theme.js                # Alternância de tema claro/escuro
│   └── utils.js                # Toasts, sanitização e utilitários
├── styles/                     # Arquivos CSS
│   ├── variables.css           # Tokens de Design System
│   ├── style.css               # Estilos da aplicação principal e FullCalendar
│   └── login.css               # Estilos da página de login
├── calendario.html             # Aplicação Principal
├── login.html                  # Tela de Login
├── firebase.json               # Configurações de Hosting, Functions e Rewrites
└── readme.md                   # Documentação do projeto
```

---

## 🚀 Como Executar e Implantar

### 1. Teste Local
Abra `index.html` diretamente no navegador ou utilize um servidor local de desenvolvimento (ex: Live Server). O aplicativo iniciará em **Modo Demo Local** caso as credenciais em `scripts/firebase-config.js` permaneçam com os valores padrão.

### 2. Implantação no Firebase

1. Instale o Firebase CLI (caso não tenha):
   ```bash
   npm install -g firebase-tools
   ```
2. Faça login e selecione seu projeto:
   ```bash
   firebase login
   firebase use --add
   ```
3. Instale as dependências da pasta de funções:
   ```bash
   cd functions && npm install && cd ..
   ```
4. Realize o deploy completo:
   ```bash
   firebase deploy
   ```
fim
