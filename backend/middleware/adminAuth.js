const crypto = require("crypto");

const COOKIE_NAME = "quiz_admin";
const SESSION_DURATION_SECONDS = 8 * 60 * 60;

function getSessionSecret() {
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
        throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters.");
    }
    return secret;
}

function signPayload(payload) {
    return crypto
        .createHmac("sha256", getSessionSecret())
        .update(payload)
        .digest("base64url");
}

function createAdminCookie(adminId) {
    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
    const payload = `${adminId}.${expiresAt}`;
    const signature = signPayload(payload);
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

    return `${COOKIE_NAME}=${payload}.${signature}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DURATION_SECONDS}${secure}`;
}

function clearAdminCookie() {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    return `${COOKIE_NAME}=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

function readAdminId(req) {
    const cookieHeader = req.headers.cookie || "";
    const cookie = cookieHeader.split(";")
        .map(part => part.trim())
        .find(part => part.startsWith(`${COOKIE_NAME}=`));

    if (!cookie) {
        return null;
    }

    const token = cookie.slice(COOKIE_NAME.length + 1);
    const parts = token.split(".");
    if (parts.length !== 3) {
        return null;
    }

    const [adminId, expiresAt, signature] = parts;
    if (!/^[1-9]\d*$/.test(adminId) || !/^\d+$/.test(expiresAt)) {
        return null;
    }

    const payload = `${adminId}.${expiresAt}`;
    const expectedSignature = signPayload(payload);
    const provided = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);

    if (
        provided.length !== expected.length ||
        !crypto.timingSafeEqual(provided, expected) ||
        Number(expiresAt) <= Math.floor(Date.now() / 1000)
    ) {
        return null;
    }

    return Number(adminId);
}

function requireAdmin(req, res, next) {
    try {
        const adminId = readAdminId(req);
        if (!adminId) {
            return res.status(401).json({ message: "Admin authentication is required." });
        }

        req.adminId = adminId;
        return next();
    } catch (error) {
        console.error("Admin session validation failed:", error.message);
        return res.status(503).json({ message: "Admin authentication is not configured." });
    }
}

module.exports = {
    clearAdminCookie,
    createAdminCookie,
    requireAdmin
};
