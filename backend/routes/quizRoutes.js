const express = require("express");
const db = require("../config/db");

const router = express.Router();
const VALID_OPTIONS = new Set(["A", "B", "C", "D"]);

router.get("/questions", async (req, res) => {
    try {
        const [questions] = await db.promise().execute(`
            SELECT question_id, question_text, option_a, option_b, option_c, option_d
            FROM questions
            ORDER BY question_id
        `);
        return res.json(questions);
    } catch (error) {
        console.error("Could not fetch quiz questions:", error.message);
        return res.status(500).json({ message: "Could not load quiz questions." });
    }
});

router.post("/submit", async (req, res) => {
    const { participant_name: participantName, answers } = req.body || {};
    const name = typeof participantName === "string" ? participantName.trim() : "";

    if (
        !name ||
        name.length > 100 ||
        /[\u0000-\u001f\u007f]/.test(name) ||
        !Array.isArray(answers) ||
        answers.length === 0 ||
        answers.length > 500
    ) {
        return res.status(400).json({
            message: "Enter a valid participant name and provide answers for the quiz."
        });
    }

    const normalizedAnswers = [];
    const answerIds = new Set();
    for (const answer of answers) {
        const questionId = Number(answer && answer.question_id);
        const selectedOption = answer && answer.selected_option;
        if (
            !Number.isSafeInteger(questionId) ||
            questionId <= 0 ||
            typeof selectedOption !== "string" ||
            !VALID_OPTIONS.has(selectedOption)
        ) {
            return res.status(400).json({ message: "One or more answers are invalid." });
        }
        if (answerIds.has(questionId)) {
            return res.status(400).json({ message: "Duplicate question answers are not allowed." });
        }
        answerIds.add(questionId);
        normalizedAnswers.push({ questionId, selectedOption });
    }

    let connection;
    let transactionStarted = false;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        transactionStarted = true;

        const [questions] = await connection.execute(
            "SELECT question_id, correct_option FROM questions ORDER BY question_id"
        );
        if (
            questions.length !== normalizedAnswers.length ||
            questions.some(question => !answerIds.has(Number(question.question_id)))
        ) {
            await connection.rollback();
            transactionStarted = false;
            return res.status(400).json({
                message: "Answer every current quiz question exactly once before submitting."
            });
        }

        const questionById = new Map(
            questions.map(question => [Number(question.question_id), question])
        );
        let score = 0;
        const responseRows = normalizedAnswers.map(answer => {
            const question = questionById.get(answer.questionId);
            const isCorrect = question.correct_option === answer.selectedOption;
            if (isCorrect) {
                score++;
            }
            return [answer.questionId, answer.selectedOption, isCorrect];
        });

        const [attemptResult] = await connection.execute(
            `INSERT INTO quiz_attempts (participant_name, score, total_questions)
             VALUES (?, ?, ?)`,
            [name, score, questions.length]
        );

        for (const [questionId, selectedOption, isCorrect] of responseRows) {
            await connection.execute(
                `INSERT INTO responses
                    (attempt_id, question_id, selected_option, is_correct)
                 VALUES (?, ?, ?, ?)`,
                [attemptResult.insertId, questionId, selectedOption, isCorrect]
            );
        }

        await connection.commit();
        transactionStarted = false;
        return res.json({
            message: "Quiz submitted successfully.",
            attempt_id: attemptResult.insertId,
            participant_name: name,
            score,
            total_questions: questions.length,
            result: score === questions.length
                ? "Perfect score!"
                : score >= Math.ceil(questions.length / 2)
                    ? "Well done!"
                    : "Keep practicing!"
        });
    } catch (error) {
        if (transactionStarted && connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error("Could not roll back quiz submission:", rollbackError.message);
            }
        }
        console.error("Could not submit quiz:", error.message);
        return res.status(500).json({ message: "Could not save your quiz result. Please try again." });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

module.exports = router;
