require("dotenv").config();

const express = require("express");
const path = require("path");
const db = require("./config/db");
const adminRoutes = require("./routes/adminRoutes");
const quizRoutes = require("./routes/quizRoutes");

const app = express();

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.use("/api/quiz", quizRoutes);
app.use("/api/admin", adminRoutes);

app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
});

app.get("/test-db", async (req, res) => {
    try {
        await db.promise().query("SELECT 1");
        res.json({ status: "connected" });
    } catch (error) {
        console.error("Database health check failed:", error.message);
        res.status(503).json({ message: "Database is unavailable." });
    }
});

app.use((req, res) => {
    res.status(404).json({ message: "Resource not found." });
});

app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
        return res.status(400).json({ message: "Request body must be valid JSON." });
    }

    console.error("Request failed:", error.message);
    return res.status(500).json({ message: "An unexpected server error occurred." });
});

if (require.main === module) {
    const port = Number(process.env.PORT) || 5000;
    app.listen(port, () => {
        console.log(`Online Quiz System is available at http://localhost:${port}`);
        db.promise().getConnection()
            .then(connection => {
                console.log("MySQL database connected.");
                connection.release();
            })
            .catch(error => {
                console.error("MySQL connection unavailable:", error.message);
            });
    });
}

module.exports = app;
