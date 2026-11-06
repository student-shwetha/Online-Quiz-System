const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const {
    clearAdminCookie,
    createAdminCookie,
    requireAdmin
} = require("../middleware/adminAuth");

const router = express.Router();
const VALID_OPTIONS = new Set(["A", "B", "C", "D"]);
const QUESTION_FIELDS = [
    "question_text",
    "option_a",
    "option_b",
    "option_c",
    "option_d",
    "correct_option"
];

function validateQuestion(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return null;
    }

    const values = {};
    for (const field of QUESTION_FIELDS.slice(0, 5)) {
        if (typeof body[field] !== "string") {
            return null;
        }
        values[field] = body[field].trim();
    }

    if (
        !values.question_text ||
        values.question_text.length > 2000 ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(values.question_text) ||
        QUESTION_FIELDS.slice(1, 5).some(field =>
            !values[field] ||
            values[field].length > 500 ||
            /[\u0000-\u001f\u007f]/.test(values[field])
        ) ||
        typeof body.correct_option !== "string" ||
        !VALID_OPTIONS.has(body.correct_option.toUpperCase())
    ) {
        return null;
    }

    values.correct_option = body.correct_option.toUpperCase();
    return values;
}

function getQuestionId(value) {
    const questionId = Number(value);
    return Number.isSafeInteger(questionId) && questionId > 0
        ? questionId
        : null;
}

router.post("/login", async (req, res) => {
    const { username, password } = req.body || {};
    if (
        typeof username !== "string" ||
        !username.trim() ||
        username.trim().length > 50 ||
        typeof password !== "string" ||
        !password ||
        Buffer.byteLength(password, "utf8") > 72
    ) {
        return res.status(400).json({ message: "Enter a valid username and password." });
    }

    try {
        const [admins] = await db.promise().execute(
            "SELECT admin_id, password_hash FROM admins WHERE username = ? LIMIT 1",
            [username.trim()]
        );
        const admin = admins[0];
        const passwordMatches = admin
            ? await bcrypt.compare(password, admin.password_hash)
            : false;

        if (!passwordMatches) {
            return res.status(401).json({ message: "Invalid username or password." });
        }

        res.setHeader("Set-Cookie", createAdminCookie(admin.admin_id));
        return res.json({ message: "Admin login successful." });
    } catch (error) {
        console.error("Admin login failed:", error.message);
        const notConfigured = error.message.includes("ADMIN_SESSION_SECRET");
        return res.status(notConfigured ? 503 : 500).json({
            message: notConfigured
                ? "Admin authentication is not configured."
                : "Could not log in. Please try again."
        });
    }
});

router.post("/logout", (req, res) => {
    res.setHeader("Set-Cookie", clearAdminCookie());
    return res.json({ message: "Logged out successfully." });
});

router.use(requireAdmin);

router.get("/me", (req, res) => {
    res.json({ admin_id: req.adminId });
});

router.get("/questions", async (req, res) => {
    try {
        const [questions] = await db.promise().execute(`
            SELECT question_id, question_text, option_a, option_b, option_c, option_d,
                   correct_option
            FROM questions
            ORDER BY question_id
        `);
        return res.json(questions);
    } catch (error) {
        console.error("Could not fetch admin questions:", error.message);
        return res.status(500).json({ message: "Could not load questions." });
    }
});

router.post("/questions", async (req, res) => {
    const question = validateQuestion(req.body);
    if (!question) {
        return res.status(400).json({
            message: "Provide a question, four options, and a correct option (A-D)."
        });
    }

    try {
        const [result] = await db.promise().execute(
            `INSERT INTO questions
                (question_text, option_a, option_b, option_c, option_d, correct_option)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                question.question_text,
                question.option_a,
                question.option_b,
                question.option_c,
                question.option_d,
                question.correct_option
            ]
        );
        return res.status(201).json({
            message: "Question added successfully.",
            question_id: result.insertId
        });
    } catch (error) {
        console.error("Could not add question:", error.message);
        return res.status(500).json({ message: "Could not add the question." });
    }
});

router.put("/questions/:id", async (req, res) => {
    const questionId = getQuestionId(req.params.id);
    const question = validateQuestion(req.body);
    if (!questionId || !question) {
        return res.status(400).json({
            message: "Provide a valid question ID, question, four options, and correct option."
        });
    }

    try {
        const [result] = await db.promise().execute(
            `UPDATE questions
             SET question_text = ?, option_a = ?, option_b = ?, option_c = ?,
                 option_d = ?, correct_option = ?
             WHERE question_id = ?`,
            [
                question.question_text,
                question.option_a,
                question.option_b,
                question.option_c,
                question.option_d,
                question.correct_option,
                questionId
            ]
        );
        if (result.affectedRows === 0) {
            const [existing] = await db.promise().execute(
                "SELECT question_id FROM questions WHERE question_id = ?",
                [questionId]
            );
            if (existing.length === 0) {
                return res.status(404).json({ message: "Question not found." });
            }
        }
        return res.json({ message: "Question updated successfully." });
    } catch (error) {
        console.error("Could not update question:", error.message);
        return res.status(500).json({ message: "Could not update the question." });
    }
});

router.delete("/questions/:id", async (req, res) => {
    const questionId = getQuestionId(req.params.id);
    if (!questionId) {
        return res.status(400).json({ message: "Provide a valid question ID." });
    }

    try {
        const [result] = await db.promise().execute(
            "DELETE FROM questions WHERE question_id = ?",
            [questionId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Question not found." });
        }
        return res.json({ message: "Question deleted successfully." });
    } catch (error) {
        console.error("Could not delete question:", error.message);
        if (error.code === "ER_ROW_IS_REFERENCED_2") {
            return res.status(409).json({
                message: "This question is part of a saved quiz result and cannot be deleted."
            });
        }
        return res.status(500).json({ message: "Could not delete the question." });
    }
});

module.exports = router;