const loginPanel = document.getElementById("loginPanel");
const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const dashboard = document.getElementById("dashboard");
const questionForm = document.getElementById("questionForm");
const questionList = document.getElementById("questionList");
const message = document.getElementById("adminMessage");
const formTitle = document.getElementById("formTitle");
const saveQuestionButton = document.getElementById("saveQuestionButton");
const cancelEditButton = document.getElementById("cancelEditButton");
const logoutButton = document.getElementById("logoutButton");

let editingQuestionId = null;
let requestInProgress = false;

loginForm.addEventListener("submit", login);
questionForm.addEventListener("submit", saveQuestion);
cancelEditButton.addEventListener("click", resetQuestionForm);
logoutButton.addEventListener("click", logout);

async function apiRequest(path, options = {}) {
    const response = await fetch(`/api/admin${path}`, {
        credentials: "same-origin",
        ...options
    });

    let data;
    try {
        data = await response.json();
    } catch (error) {
        throw new Error("The server returned an invalid response.");
    }

    if (!response.ok) {
        if (response.status === 401 && path !== "/login") {
            showLogin();
        }
        throw new Error(data.message || "The request could not be completed.");
    }
    return data;
}

async function initialize() {
    try {
        await apiRequest("/me");
        await showDashboard();
    } catch (error) {
        if (!error.message.includes("authentication is required")) {
            showMessage(error.message, true);
        }
    }
}

async function login(event) {
    event.preventDefault();
    clearMessage();
    if (requestInProgress) {
        return;
    }

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    if (!username || username.length > 50 || !password) {
        showMessage("Enter a valid username and password.", true);
        return;
    }

    requestInProgress = true;
    loginButton.disabled = true;
    try {
        await apiRequest("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        loginForm.reset();
        await showDashboard();
        showMessage("Logged in successfully.", false);
    } catch (error) {
        showMessage(error.message, true);
    } finally {
        requestInProgress = false;
        loginButton.disabled = false;
    }
}

async function showDashboard() {
    loginPanel.hidden = true;
    dashboard.hidden = false;
    await loadQuestions();
}

function showLogin() {
    dashboard.hidden = true;
    loginPanel.hidden = false;
    resetQuestionForm();
}

async function logout() {
    try {
        await apiRequest("/logout", { method: "POST" });
        showLogin();
        questionList.replaceChildren();
        showMessage("You have logged out.", false);
    } catch (error) {
        showMessage(error.message, true);
    }
}

async function loadQuestions() {
    try {
        const questions = await apiRequest("/questions");
        renderQuestions(questions);
    } catch (error) {
        showMessage(error.message, true);
    }
}

function renderQuestions(questions) {
    questionList.replaceChildren();
    if (!questions.length) {
        const empty = document.createElement("p");
        empty.textContent = "No questions have been added yet.";
        questionList.append(empty);
        return;
    }

    questions.forEach(question => {
        const card = document.createElement("article");
        card.className = "question-card";
        const heading = document.createElement("h4");
        heading.textContent = question.question_text;
        const options = document.createElement("ul");

        ["A", "B", "C", "D"].forEach(option => {
            const item = document.createElement("li");
            item.textContent = `${option}. ${question[`option_${option.toLowerCase()}`]}`;
            if (option === question.correct_option) {
                item.className = "correct";
            }
            options.append(item);
        });

        const actions = document.createElement("div");
        actions.className = "question-actions";
        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", () => editQuestion(question));
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "secondary";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => deleteQuestion(question));
        actions.append(editButton, deleteButton);
        card.append(heading, options, actions);
        questionList.append(card);
    });
}

function editQuestion(question) {
    editingQuestionId = question.question_id;
    questionForm.elements.question_text.value = question.question_text;
    questionForm.elements.option_a.value = question.option_a;
    questionForm.elements.option_b.value = question.option_b;
    questionForm.elements.option_c.value = question.option_c;
    questionForm.elements.option_d.value = question.option_d;
    questionForm.elements.correct_option.value = question.correct_option;
    formTitle.textContent = "Edit question";
    saveQuestionButton.textContent = "Save changes";
    cancelEditButton.hidden = false;
    clearMessage();
    document.getElementById("questionText").focus();
}

async function saveQuestion(event) {
    event.preventDefault();
    clearMessage();
    if (requestInProgress) {
        return;
    }

    const question = Object.fromEntries(new FormData(questionForm).entries());
    question.question_text = question.question_text.trim();
    for (const option of ["option_a", "option_b", "option_c", "option_d"]) {
        question[option] = question[option].trim();
    }
    if (
        !question.question_text ||
        !question.option_a ||
        !question.option_b ||
        !question.option_c ||
        !question.option_d
    ) {
        showMessage("Fill in the question and all four options.", true);
        return;
    }

    requestInProgress = true;
    saveQuestionButton.disabled = true;
    try {
        const path = editingQuestionId === null
            ? "/questions"
            : `/questions/${encodeURIComponent(editingQuestionId)}`;
        const result = await apiRequest(path, {
            method: editingQuestionId === null ? "POST" : "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(question)
        });
        resetQuestionForm();
        await loadQuestions();
        showMessage(result.message, false);
    } catch (error) {
        showMessage(error.message, true);
    } finally {
        requestInProgress = false;
        saveQuestionButton.disabled = false;
    }
}

async function deleteQuestion(question) {
    if (!window.confirm("Delete this question? Saved quiz results will be preserved.")) {
        return;
    }

    try {
        const result = await apiRequest(
            `/questions/${encodeURIComponent(question.question_id)}`,
            { method: "DELETE" }
        );
        if (editingQuestionId === question.question_id) {
            resetQuestionForm();
        }
        await loadQuestions();
        showMessage(result.message, false);
    } catch (error) {
        showMessage(error.message, true);
    }
}

function resetQuestionForm() {
    editingQuestionId = null;
    questionForm.reset();
    formTitle.textContent = "Add a question";
    saveQuestionButton.textContent = "Add question";
    cancelEditButton.hidden = true;
}

function showMessage(text, isError) {
    message.textContent = text;
    message.classList.toggle("error", isError);
    message.classList.toggle("success", !isError);
}

function clearMessage() {
    message.textContent = "";
    message.classList.remove("error", "success");
}

initialize();
