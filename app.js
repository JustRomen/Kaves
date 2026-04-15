const username = "coffe";
const password = "kafe";
const url = "https://crm.skch.cz/ajax0/procedure2.php";

const AUTH_HEADER = make_base_auth(username, password);
const QUEUE_KEY = "offline_drinks_queue";
const CACHE_TYPES_KEY = "cached_drink_types";

function make_base_auth(user, password) {
    return "Basic " + btoa(user + ":" + password);
}

function showNotification(message, type = "info") {
    let container = document.getElementById("notification-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "notification-container";
        container.style.cssText = "position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.textContent = message;
    
    const bgColor = type === "success" ? "#4caf50" : type === "error" ? "#f44336" : "#2196f3";
    toast.style.cssText = `background-color: ${bgColor}; color: white; padding: 12px 20px; border-radius: 5px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-family: sans-serif; transition: opacity 0.5s ease; opacity: 1;`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}


async function checkApiAndUpdates() {
    if (!navigator.onLine) return; 

    try {
        const newTypes = await getTypesList(url);
        const storedTypes = localStorage.getItem(CACHE_TYPES_KEY);

        if (storedTypes !== JSON.stringify(newTypes)) {
            localStorage.setItem(CACHE_TYPES_KEY, JSON.stringify(newTypes));
            
            if (storedTypes !== null) {
                showNotification("Nabídka kávy byla aktualizována z API!", "success");
                
                
                const drinksContainer = document.querySelector(".drinks-container");
                if (drinksContainer) {
                    drinksContainer.innerHTML = ""; // Vyčistíme staré
                    renderTypes(drinksContainer, newTypes); // Vykreslíme nové
                }
            }
        }
    } catch (err) {
        console.error("API check selhal:", err);
        showNotification("Varování: API je momentálně nedostupné.", "error");
    }
}



function addToOfflineQueue(payload) {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    queue.push(payload);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    showNotification("Jste offline. Uloženo do fronty.", "info");
}

async function syncOfflineData() {
    if (!navigator.onLine) return;

    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    if (queue.length === 0) return;

    showNotification(`Synchronizuji ${queue.length} offline záznamů...`, "info");
    const remainingQueue = [];
    let successCount = 0;

    for (const payload of queue) {
        try {
            await saveDrinks(url, payload);
            successCount++;
        } catch (err) {
            remainingQueue.push(payload);
        }
    }

    localStorage.setItem(QUEUE_KEY, JSON.stringify(remainingQueue));
    if (successCount > 0) {
        showNotification(`${successCount} záznamů úspěšně odesláno na server!`, "success");
    }
}

window.addEventListener('online', () => {
    showNotification("Připojení obnoveno!", "success");
    syncOfflineData();
    checkApiAndUpdates();
});

window.addEventListener('offline', () => {
    showNotification("Ztratili jste připojení k internetu.", "error");
});



async function getPeopleList(apiUrl) {
    const res = await fetch(`${apiUrl}?cmd=getPeopleList`, { 
        method: 'GET',
        headers: { 'Authorization': AUTH_HEADER }
    });
    if (!res.ok) throw new Error(`getPeopleList HTTP ${res.status}`);
    return await res.json();
}

async function getTypesList(apiUrl) {
    const res = await fetch(`${apiUrl}?cmd=getTypesList`, { 
        method: 'GET',
        headers: { 'Authorization': AUTH_HEADER }
    });
    if (!res.ok) throw new Error(`getTypesList HTTP ${res.status}`);
    return await res.json();
}

async function saveDrinks(apiUrl, data) {
    const res = await fetch(`${apiUrl}?cmd=saveDrinks`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": AUTH_HEADER
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`saveDrinks HTTP ${res.status}`);
    return await res.json();
}

function renderPeople(select, people) {
    let blank = document.createElement("option");
    blank.disabled = true;
    blank.selected = true;
    blank.textContent = "Vyber uživatele";
    select.append(blank);

    Object.values(people).forEach(p => {
        let option = document.createElement("option");
        option.value = p.ID;
        option.textContent = p.name;
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
        minus.type = "button";
        minus.textContent = "-";

        let input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.max = "10";
        input.value = "0";
        input.dataset.type = t.typ;

        let plus = document.createElement("button");
        plus.type = "button";
        plus.textContent = "+";

        minus.addEventListener("click", () => {
            if (input.valueAsNumber > 0) input.valueAsNumber--;
        });
        plus.addEventListener("click", () => {
            if (input.valueAsNumber < Number(input.max)) input.valueAsNumber++;
        });

        wrapper.append(label, minus, input, plus);
        container.append(wrapper);
    });
}

function renderSubmit(form) {
    let submit = document.createElement("button");
    submit.type = "submit";
    submit.id = "submitButton";
    submit.innerHTML = "Uložit";
    form.append(submit);
}

function saveUser(userId) {
    localStorage.setItem("lastUser", userId);
}

function loadSavedUser(select) {
    let userId = localStorage.getItem("lastUser");
    if (userId) select.value = userId;
}


document.addEventListener('DOMContentLoaded', async () => {
    syncOfflineData();
    checkApiAndUpdates(); 
    
    setInterval(checkApiAndUpdates, 60000); 

    const form = document.getElementById("myForm");
    const userSelect = document.createElement("select");
    userSelect.id = "userSelect";
    
    const header = document.querySelector(".form-header");
    if(header) header.append(userSelect);
    else form.append(userSelect);

    const drinksContainer = document.createElement("div");
    drinksContainer.classList.add("drinks-container");
    form.append(drinksContainer);

    try {
        const people = await getPeopleList(url);
        renderPeople(userSelect, people);
        
        const types = await getTypesList(url);
        localStorage.setItem(CACHE_TYPES_KEY, JSON.stringify(types)); // Prvotní uložení pro porovnávání
        renderTypes(drinksContainer, types);
    } catch (e) {
        showNotification("Nepodařilo se načíst počáteční data z API.", "error");
    }

    renderSubmit(form);

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const selectedUser = userSelect.value;
        const drinks = [];
        const inputs = form.querySelectorAll("input[type='number']");

        inputs.forEach(input => {
            let amount = parseInt(input.value) || 0;
            if (amount > 0) {
                drinks.push({ type: input.dataset.type, value: amount });
            }
        });

        const submitButton = document.getElementById("submitButton");

        if(selectedUser === "Vyber uživatele" || drinks.length === 0) {
            submitButton.innerHTML = "Vyber uživatele a aspoň jeden drink!";
            setTimeout(() => { submitButton.innerHTML = "Uložit" }, 2000);
            return;
        }

        const payload = { user: selectedUser, drinks: drinks };

        try {
            if (!navigator.onLine) {
                throw new Error("Jste offline");
            }

            await saveDrinks(url, payload);
            submitButton.innerHTML = "Uloženo!";
            showNotification("Káva byla úspěšně zaznamenána na server.", "success");
            saveUser(selectedUser);
            inputs.forEach(i => i.value = 0);
        } catch (err) {
            addToOfflineQueue(payload);
            submitButton.innerHTML = "Uloženo do fronty (offline)";
            saveUser(selectedUser);
            inputs.forEach(i => i.value = 0);
        }

        setTimeout(() => { submitButton.innerHTML = "Uložit" }, 3000);
    });
});
