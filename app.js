const username = "coffe";
const password = "kafe";
const url = "https://crm.skch.cz/ajax0/procedure2.php";
const AUTH_HEADER = make_base_auth(username, password);

function make_base_auth(user, password) {
    return "Basic " + btoa(user + ":" + password);
}

// --- NOTIFIKAČNÍ SYSTÉM ---
function showNotification(message, type = "info") {
    let container = document.getElementById("notification-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "notification-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

// --- DENNÍ PŘEHLED ---
function updateDailySummary(drinks) {
    // Získáme dnešní datum ve formátu YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0]; 
    let summary = JSON.parse(localStorage.getItem("dailySummary") || "{}");

    // Pokud je nový den (nebo data ještě neexistují), vyresetujeme přehled
    if (summary.date !== today) {
        summary = { date: today, drinks: {} };
    }

    // Přičteme nově vypité nápoje k dnešnímu dni
    drinks.forEach(d => {
        if (d.value > 0) {
            summary.drinks[d.type] = (summary.drinks[d.type] || 0) + d.value;
        }
    });

    localStorage.setItem("dailySummary", JSON.stringify(summary));
}

function showDailySummary() {
    const today = new Date().toISOString().split('T')[0];
    const summary = JSON.parse(localStorage.getItem("dailySummary") || "{}");

    // Zobrazíme info pouze pokud máme data ze dneška a něco se vypilo
    if (summary.date === today && Object.keys(summary.drinks).length > 0) {
        let msg = "Dnes jsi vypil(a): ";
        let items = Object.entries(summary.drinks).map(([type, count]) => `${count}x ${type}`);
        showNotification(msg + items.join(", "), "info");
    } else {
        showNotification("Dnes jsi ještě žádné kafe neměl(a)!", "info");
    }
}

// --- OFFLINE FRONTA A SYNCHRONIZACE ---
function saveToOfflineQueue(payload) {
    const queue = JSON.parse(localStorage.getItem("offlineQueue") || "[]");
    queue.push(payload);
    localStorage.setItem("offlineQueue", JSON.stringify(queue));
    showNotification("Jste offline. Uloženo na později.", "warning");
}

async function syncOfflineQueue() {
    if (!navigator.onLine) return;

    const queue = JSON.parse(localStorage.getItem("offlineQueue") || "[]");
    if (queue.length === 0) return;

    showNotification("Obnoveno připojení. Odesílám offline data...", "info");
    const failedQueue = [];
    let successCount = 0;

    for (let payload of queue) {
        try {
            await saveDrinks(url, payload);
            successCount++;
        } catch (e) {
            failedQueue.push(payload); // Pokud to spadne, necháme na další pokus
        }
    }

    localStorage.setItem("offlineQueue", JSON.stringify(failedQueue));
    
    if (successCount > 0) {
        showNotification(`Úspěšně synchronizováno ${successCount} záznamů!`, "success");
    }
}

window.addEventListener('online', syncOfflineQueue);
window.addEventListener('offline', () => showNotification("Ztratili jste připojení k internetu.", "error"));


// --- API FUNKCE ---
async function getPeopleList(apiUrl) {
    const res = await fetch(`${apiUrl}?cmd=getPeopleList`, { 
        method: 'GET', credentials: 'include', headers: { 'Authorization': AUTH_HEADER }
    });
    if (!res.ok) throw new Error(`getPeopleList HTTP ${res.status}`);
    return await res.json();
}

async function getTypesList(apiUrl) {
    const res = await fetch(`${apiUrl}?cmd=getTypesList`, { 
        method: 'GET', credentials: 'include', headers: { 'Authorization': AUTH_HEADER }
    });
    if (!res.ok) throw new Error(`getTypesList HTTP ${res.status}`);
    return await res.json();
}

async function saveDrinks(apiUrl, data) {
    const res = await fetch(`${apiUrl}?cmd=saveDrinks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": AUTH_HEADER },
        body: JSON.stringify(data),
        credentials: 'include'
    });
    if (!res.ok) throw new Error(`saveDrinks HTTP ${res.status}`);
    return await res.json();
}

// --- RENDER FUNKCE ---
function renderPeople(select, people) {
    let blank = document.createElement("option");
    blank.disabled = true; blank.selected = true; blank.textContent = "Vyber uživatele";
    select.append(blank);

    Object.values(people).forEach(p => {
        let option = document.createElement("option");
        option.value = p.ID; option.textContent = p.name;
        select.append(option);
    });
    loadSavedUser(select);
}

function renderTypes(container, types) {
    Object.values(types).forEach(t => {
        const wrapper = document.createElement("div");
        wrapper.classList.add("drink-row");

        let label = document.createElement("label");
        label.textContent = t.typ;

        let minus = document.createElement("button");
        minus.type = "button"; minus.textContent = "-";

        let input = document.createElement("input");
        input.type = "number"; input.min = "0"; input.max = "10"; input.value = "0";
        input.dataset.type = t.typ;

        let plus = document.createElement("button");
        plus.type = "button"; plus.textContent = "+";

        minus.addEventListener("click", () => { if (input.valueAsNumber > 0) input.valueAsNumber--; });
        plus.addEventListener("click", () => { if (input.valueAsNumber < Number(input.max)) input.valueAsNumber++; });

        wrapper.append(label, minus, input, plus);
        container.append(wrapper);
    });
}

function renderSubmit(form) {
    let submit = document.createElement("button");
    submit.type = "submit"; submit.id = "submitButton"; submit.innerHTML = "Uložit";
    form.append(submit);
}

// --- UŽIVATELSKÉ FUNKCE ---
function saveUser(userId) {
    localStorage.setItem("lastUser", userId);
    sessionStorage.setItem("lastUser", userId);
    document.cookie = `lastUser=${userId}; path=/; max-age=31536000`;
}

function loadSavedUser(select) {
    let userId = localStorage.getItem("lastUser") || sessionStorage.getItem("lastUser") || getCookie("lastUser");
    if (userId) select.value = userId;
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
}

// --- INICIALIZACE APLIKACE ---
document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById("myForm");
    const userSelect = document.createElement("select");
    userSelect.id = "userSelect";
    
    const formHeader = document.querySelector(".form-header");
    if(formHeader) formHeader.append(userSelect);
    else form.append(userSelect); 

    const drinksContainer = document.createElement("div");
    drinksContainer.classList.add("drinks-container");
    form.append(drinksContainer);

    try {
        const people = await getPeopleList(url);
        renderPeople(userSelect, people);

        const types = await getTypesList(url);
        renderTypes(drinksContainer, types);
        
        syncOfflineQueue();
    } catch (e) {
        showNotification("Nelze načíst data, zkontrolujte připojení.", "error");
    }

    renderSubmit(form);

    // Tlačítko pro manuální zobrazení denní statistiky
    const statsBtn = document.createElement("button");
    statsBtn.type = "button";
    statsBtn.textContent = "📊 Moje dnešní spotřeba";
    statsBtn.style.marginTop = "10px";
    statsBtn.addEventListener("click", showDailySummary);
    form.append(statsBtn);

    // --- ZPRACOVÁNÍ FORMULÁŘE ---
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const selectedUser = userSelect.value;
        if (!selectedUser || selectedUser === "Vyber uživatele") return alert("Vyberte uživatele!");

        const drinks = [];
        const inputs = form.querySelectorAll("input[type='number']");
        let totalDrank = 0;

        inputs.forEach(input => {
            let val = parseInt(input.value) || 0;
            if (val > 0) {
                drinks.push({ type: input.dataset.type, value: val });
                totalDrank += val;
            }
        });

        if (totalDrank === 0) return alert("Musíte přidat alespoň jeden nápoj!");

        const payload = { user: selectedUser, drinks: drinks };
        const submitButton = document.getElementById("submitButton");
        
        submitButton.innerHTML = "Ukládám...";

        try {
            if (navigator.onLine) {
                await saveDrinks(url, payload);
                submitButton.innerHTML = "Uloženo!";
                showNotification("Káva úspěšně zaznamenána!", "success");
            } else {
                throw new Error("Offline");
            }
        } catch (err) {
            saveToOfflineQueue(payload);
            submitButton.innerHTML = "Uloženo offline";
        }

        // --- AKTUALIZACE A ZOBRAZENÍ DAT ---
        saveUser(selectedUser);
        
        // 1. Uložíme vypité kafe do dnešního přehledu
        updateDailySummary(drinks);
        
        // 2. Hned poté ho zobrazíme uživateli na obrazovce
        showDailySummary();
        
        // Reset formuláře pro další objednávku
        inputs.forEach(i => i.value = 0);
        setTimeout(() => { submitButton.innerHTML = "Uložit"; }, 2500);
    });
});
