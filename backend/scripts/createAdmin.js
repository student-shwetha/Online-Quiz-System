require("dotenv").config();

const readline = require("readline");
const bcrypt = require("bcryptjs");
const db = require("../config/db");

function ask(question) {
    const prompt = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => {
        prompt.question(question, answer => {
            prompt.close();
            resolve(answer.trim());
        });
    });
}

function askPassword() {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
        return Promise.reject(new Error("Run this command in an interactive terminal."));
    }

    return new Promise((resolve, reject) => {
        let password = "";
        process.stdout.write("Admin password (hidden, at least 12 characters): ");
        process.stdin.setRawMode(true);
        process.stdin.resume();

        const finish = (error) => {
            process.stdin.removeListener("data", onData);
            process.stdin.setRawMode(false);
            process.stdout.write("\n");
            if (error) {
                reject(error);
            } else {
                resolve(password);
            }
        };

        const onData = keyBuffer => {
            const key = keyBuffer.toString("utf8");
            if (key === "\u0003") {
                finish(new Error("Admin creation cancelled."));
            } else if (key === "\r" || key === "\n") {
                finish();
            } else if (key === "\u007f" || key === "\b") {
                password = password.slice(0, -1);
            } else if (!/[\u0000-\u001f\u007f]/.test(key)) {
                password += key;
            }
        };

        process.stdin.on("data", onData);
    });
}

async function createAdmin() {
    const username = await ask("Admin username: ");
    const password = await askPassword();

    if (!username || username.length > 50) {
        throw new Error("Username must contain between 1 and 50 characters.");
    }
    if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
        throw new Error("Password must contain 12-72 UTF-8 bytes.");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await db.promise().execute(
        "INSERT INTO admins (username, password_hash) VALUES (?, ?)",
        [username, passwordHash]
    );
    console.log("Admin account created.");
}

createAdmin()
    .catch(error => {
        if (error.code === "ER_DUP_ENTRY") {
            console.error("That admin username already exists.");
        } else {
            console.error("Could not create admin:", error.message);
        }
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.promise().end();
    });
