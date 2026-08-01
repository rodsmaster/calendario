import { fetchExternalCalendars, fetchFirestoreEvents } from './events.js';
import { createEvent, updateEvent, deleteEventData } from '../app/firestore.js';
import { showToast, toggleLoading, sanitizeHTML } from './utils.js';
import { calendarsConfig } from './calendar-config.js';

let calendarObj = null;
let activeFilters = ['own', ...calendarsConfig.map(c => c.id)];
let currentSearchTerm = '';

export const initCalendar = async () => {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    calendarObj = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        locale: 'pt-br',
        buttonText: { today: 'Hoje', month: 'Mês', week: 'Semana', day: 'Dia' },
        editable: true,
        selectable: true,
        select: handleDateSelect,
        eventClick: handleEventClick,
        eventDrop: handleEventDrop,
        events: loadAllEvents
    });
    calendarObj.render();
    setupFilters();
    setupSearch();
};

const loadAllEvents = async (info, successCallback, failureCallback) => {
    toggleLoading(true);
    try {
        let events = [];
        if (activeFilters.includes('own')) {
            const own = await fetchFirestoreEvents();
            events = [...events, ...own];
        }
        const external = await fetchExternalCalendars(activeFilters);
        events = [...events, ...external];
        successCallback(events);
        applySearchFilter();
    } catch (error) {
        failureCallback(error);
        showToast('Erro ao carregar eventos', 'error');
    } finally {
        toggleLoading(false);
    }
};

export const refreshCalendar = () => {
    if (calendarObj) calendarObj.refetchEvents();
};

const setupFilters = () => {
    const list = document.getElementById('external-calendars-list');
    if (list) {
        list.innerHTML = '';
        calendarsConfig.forEach(cal => {
            const div = document.createElement('div');
            div.className = 'calendar-item';
            div.innerHTML = `
                <input type="checkbox" id="filter-${cal.id}" value="${cal.id}" checked>
                <span class="color-dot" style="background-color: ${cal.cor};"></span>
                <label for="filter-${cal.id}">${sanitizeHTML(cal.nome)}</label>
            `;
            list.appendChild(div);
        });

        document.querySelectorAll('.calendar-item input[type="checkbox"]').forEach(box => {
            box.addEventListener('change', (e) => {
                const val = e.target.id === 'filter-own' ? 'own' : e.target.value;
                if (e.target.checked) activeFilters.push(val);
                else activeFilters = activeFilters.filter(f => f !== val);
                refreshCalendar();
            });
        });
    }
};

const applySearchFilter = () => {
    if (!calendarObj) return;
    const events = calendarObj.getEvents();
    events.forEach(evt => {
        if (!currentSearchTerm || evt.title.toLowerCase().includes(currentSearchTerm)) {
            evt.setProp('display', 'auto');
        } else {
            evt.setProp('display', 'none');
        }
    });
};

const setupSearch = () => {
    const searchInput = document.getElementById('event-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchTerm = e.target.value.toLowerCase().trim();
            applySearchFilter();
        });
    }
};

/* Modal Handling */
const modal = document.getElementById('event-modal');
const form = document.getElementById('event-form');

const openModal = (event = null) => {
    const titleEl = document.getElementById('modal-title');
    const deleteBtn = document.getElementById('btn-delete-event');
    const saveBtn = document.getElementById('btn-save-event');
    const readonlyBadge = document.getElementById('readonly-badge');

    const inputTitle = document.getElementById('event-title');
    const inputStart = document.getElementById('event-start');
    const inputEnd = document.getElementById('event-end');
    const inputDesc = document.getElementById('event-desc');

    const isReadonly = event?.extendedProps?.readonly;

    if (isReadonly) {
        titleEl.textContent = 'Detalhes do Evento';
        if (readonlyBadge) {
            readonlyBadge.style.display = 'inline-block';
            readonlyBadge.textContent = `🔒 ${event.extendedProps.sourceName || 'Calendário Externo'} (Leitura)`;
        }
        if (saveBtn) saveBtn.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'none';

        inputTitle.disabled = true;
        inputStart.disabled = true;
        inputEnd.disabled = true;
        inputDesc.disabled = true;
    } else {
        titleEl.textContent = event && event.id ? 'Editar Evento' : 'Novo Evento';
        if (readonlyBadge) readonlyBadge.style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'inline-block';
        if (deleteBtn) deleteBtn.style.display = event && event.id ? 'inline-block' : 'none';

        inputTitle.disabled = false;
        inputStart.disabled = false;
        inputEnd.disabled = false;
        inputDesc.disabled = false;
    }

    if (event) {
        document.getElementById('event-id').value = event.id || '';
        inputTitle.value = event.title || '';
        inputStart.value = formatDateForInput(event.start);

        let endDate = event.end;
        if (!endDate && event.start) {
            endDate = new Date(event.start);
            endDate.setHours(endDate.getHours() + 1);
        }
        inputEnd.value = formatDateForInput(endDate);
        inputDesc.value = event.extendedProps?.description || '';
    } else {
        form.reset();
        document.getElementById('event-id').value = '';
        const now = new Date();
        const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
        inputStart.value = formatDateForInput(now);
        inputEnd.value = formatDateForInput(nextHour);
    }
    modal.classList.add('active');
};

const closeModal = () => modal.classList.remove('active');

const btnCloseModal = document.getElementById('btn-close-modal');
if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);

const btnNewEvent = document.getElementById('btn-new-event');
if (btnNewEvent) btnNewEvent.addEventListener('click', () => openModal());

function handleDateSelect(info) { openModal({ start: info.start, end: info.end }); }
function handleEventClick(info) { openModal(info.event); }

async function handleEventDrop(info) {
    if (info.event.extendedProps?.readonly) {
        info.revert();
        showToast('Não é possível alterar eventos externos', 'error');
        return;
    }
    try {
        await updateEvent(info.event.id, { start: info.event.start.toISOString(), end: info.event.end?.toISOString() });
        showToast('Evento atualizado com sucesso');
    } catch (e) {
        info.revert();
        showToast('Erro ao atualizar evento', 'error');
    }
}

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('event-id').value;
        const data = {
            title: sanitizeHTML(document.getElementById('event-title').value),
            start: new Date(document.getElementById('event-start').value).toISOString(),
            end: new Date(document.getElementById('event-end').value).toISOString(),
            description: sanitizeHTML(document.getElementById('event-desc').value)
        };

        try {
            if (id) await updateEvent(id, data);
            else await createEvent(data);
            showToast('Evento salvo com sucesso!');
            closeModal();
            refreshCalendar();
        } catch (err) {
            showToast('Erro ao salvar evento', 'error');
        }
    });
}

const btnDeleteEvent = document.getElementById('btn-delete-event');
if (btnDeleteEvent) {
    btnDeleteEvent.addEventListener('click', async () => {
        const id = document.getElementById('event-id').value;
        if (confirm('Deseja realmente excluir este evento?')) {
            try {
                await deleteEventData(id);
                showToast('Evento excluído');
                closeModal();
                refreshCalendar();
            } catch (err) {
                showToast('Erro ao excluir', 'error');
            }
        }
    });
}

const formatDateForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
};