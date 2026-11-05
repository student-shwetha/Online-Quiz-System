const quizContainer = document.getElementById("quiz");
const participantForm = document.getElementById("participantForm");
const participantNameInput = document.getElementById("participantName");
const message = document.getElementById("quizMessage");
const startButton = document.getElementById("startBtn");

let questions = [];
let currentQuestion = 0;
let selectedAnswers = [];
let participantName = "";
let isSubmitting = false;

participantForm.addEventListener("submit", startQuiz);

async function readJsonResponse(response) {
    let data;
    try {
        data = await response.json();
    } catch (error) {
        throw new Error("The server returned an invalid response.");
    }

    if (!response.ok) {
        throw new Error(data.message || "The request could not be completed.");
    }
    return data;
}

async function startQuiz(event) {
    event.preventDefault();
    clearMessage();

    participantName = participantNameInput.value.trim();
    if (
        !participantName ||
        participantName.length > 100 ||
        /[\u0000-\u001f\u007f]/.test(participantName)
    ) {
        showMessage("Enter a valid name (1-100 characters).");
        participantNameInput.focus();
        return;
    }

    startButton.disabled = true;
    startButton.textContent = "Loading...";
    try {
        const response = await fetch("/api/quiz/questions");
        questions = await readJsonResponse(response);
        if (!Array.isArray(questions) || questions.length === 0) {
            showMessage("There are no quiz questions available yet.");
            return;
        }

        currentQuestion = 0;
        selectedAnswers = new Array(questions.length).fill(null);
        participantForm.hidden = true;
        displayQuestion();
    } catch (error) {
        showMessage(`Could not load the quiz: ${error.message}`);
    } finally {
        startButton.disabled = false;
        startButton.textContent = "Start Quiz";
    }
}

function displayQuestion() {
    const question = questions[currentQuestion];
    quizContainer.replaceChildren();

    const progress = document.createElement("p");
    progress.id = "progress";
    progress.textContent = `Question ${currentQuestion + 1} of ${questions.length}`;
    quizContainer.append(progress);

    const heading = document.createElement("h2");
    heading.textContent = question.question_text;
    quizContainer.append(heading);

    const options = document.createElement("fieldset");
    options.className = "options";
    const legend = document.createElement("legend");
    legend.textContent = "Choose one answer";
    options.append(legend);

    ["A", "B", "C", "D"].forEach(option => {
        const label = document.createElement("label");
        label.className = "option";
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "answer";
        radio.value = option;
        radio.checked = selectedAnswers[currentQuestion] === option;
        radio.addEventListener("change", () => {
            selectedAnswers[currentQuestion] = option;
            clearMessage();
        });

        const optionText = document.createElement("span");
        optionText.textContent = question[`option_${option.toLowerCase()}`];
        label.append(radio, optionText);
        options.append(label);
    });
    quizContainer.append(options);

    const navigation = document.createElement("div");
    navigation.className = "navigation";
    const previousButton = document.createElement("button");
    previousButton.type = "button";
    previousButton.textContent = "Previous";
    previousButton.disabled = currentQuestion === 0 || isSubmitting;
    previousButton.addEventListener("click", previousQuestion);

    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.textContent = currentQuestion === questions.length - 1
        ? "Submit Quiz"
        : "Next";
    nextButton.disabled = isSubmitting;
    nextButton.addEventListener("click", nextQuestion);

    navigation.append(previousButton, nextButton);
    quizContainer.append(navigation);
}

function previousQuestion() {
    if (currentQuestion > 0) {
        currentQuestion--;
        displayQuestion();
    }
}

function nextQuestion() {
    if (currentQuestion < questions.length - 1) {
        currentQuestion++;
        clearMessage();
        displayQuestion();
        return;
    }
    submitQuiz();
}

async function submitQuiz() {
    if (isSubmitting) {
        return;
    }

    const unansweredIndex = selectedAnswers.findIndex(answer => answer === null);
    if (unansweredIndex !== -1) {
        currentQuestion = unansweredIndex;
        displayQuestion();
        showMessage(`Please answer question ${unansweredIndex + 1} before submitting.`);
        const firstRadio = quizContainer.querySelector('input[name="answer"]');
        if (firstRadio) {
            firstRadio.focus();
        }
        return;
    }

    isSubmitting = true;
    clearMessage();
    displayQuestion();
    try {
        const response = await fetch("/api/quiz/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                participant_name: participantName,
                answers: questions.map((question, index) => ({
                    question_id: question.question_id,
                    selected_option: selectedAnswers[index]
                }))
            })
        });
        const result = await readJsonResponse(response);
        displayResult(result);
    } catch (error) {
        isSubmitting = false;
        displayQuestion();
        showMessage(`Quiz submission failed: ${error.message}`);
    }
}

function displayResult(result) {
    quizContainer.replaceChildren();
    const heading = document.createElement("h2");
    heading.textContent = "Quiz completed!";
    const name = document.createElement("p");
    name.textContent = `Participant: ${result.participant_name}`;
    const score = document.createElement("p");
    score.className = "score";
    score.textContent = `Your score: ${result.score} / ${result.total_questions}`;
    const resultText = document.createElement("p");
    resultText.textContent = result.result || "Thank you for taking the quiz.";
    const restartButton = document.createElement("button");
    restartButton.type = "button";
    restartButton.textContent = "Start another quiz";
    restartButton.addEventListener("click", resetQuiz);

    quizContainer.append(heading, name, score, resultText, restartButton);
}

function resetQuiz() {
    questions = [];
    selectedAnswers = [];
    currentQuestion = 0;
    participantName = "";
    isSubmitting = false;
    participantNameInput.value = "";
    participantForm.hidden = false;
    quizContainer.replaceChildren();
    clearMessage();
    participantNameInput.focus();
}

function showMessage(text) {
    message.textContent = text;
    message.classList.add("error");
}

function clearMessage() {
    message.textContent = "";
    message.classList.remove("error");
}
