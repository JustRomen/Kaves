const username = "coffe";
const password = "kafe";
const url = "https://crm.skch.cz/ajax0/procedure2.php";

const AUTH_HEADER = make_base_auth(username, password);

function make_base_auth(user, password) {
    return "Basic " + btoa(user + ":" + password);
}

async function getPeopleList(apiUrl) {
    const res = await fetch(`${apiUrl}?cmd=getPeopleList`, { 
        method: 'GET',
        credentials: 'include',
        headers: { 'Authorization': AUTH_HEADER }
    });
    if (!res.ok) throw new Error(`getPeopleList HTTP ${res.status}`);
    return await res.json();
}

async function getTypesList(apiUrl) {
    const res = await fetch(`${apiUrl}?cmd=getTypesList`, { 
        method: 'GET',
        credentials: 'include',
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
        body: JSON.stringify(data),
        credentials: 'include'
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
    sessionStorage.setItem("lastUser", userId);
    document.cookie = `lastUser=${userId}; path=/; max-age=31536000`;
}

function loadSavedUser(select) {
    let userId =
        localStorage.getItem("lastUser") ||
        sessionStorage.getItem("lastUser") ||
        getCookie("lastUser");

    if (userId) {
        select.value = userId;
    }
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
}

document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById("myForm");

    const userSelect = document.createElement("select");
    userSelect.id = "userSelect";
    document.querySelector(".form-header").append(userSelect);

    const drinksContainer = document.createElement("div");
    drinksContainer.classList.add("drinks-container");
    form.append(drinksContainer);

    const people = await getPeopleList(url);
    renderPeople(userSelect, people);

    const types = await getTypesList(url);
    renderTypes(drinksContainer, types);

    renderSubmit(form);

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const selectedUser = userSelect.value;
        if (!selectedUser) return alert("Vyberte uživatele!");

        const drinks = [];
        const inputs = form.querySelectorAll("input[type='number']");

        inputs.forEach(input => {
            drinks.push({
                type: input.dataset.type,
                value: parseInt(input.value) || 0
            });
        });

        const payload = {
            user: selectedUser,
            drinks: drinks
        };

        const submitButton = document.getElementById("submitButton");

        try {
            await saveDrinks(url, payload);
            submitButton.innerHTML = "Uloženo!";
            saveUser(selectedUser);
            inputs.forEach(i => i.value = 0);
            setTimeout(() => { submitButton.innerHTML = "Uložit"; }, 2500);
        } catch (err) {
            alert(err);
        }
    });
});