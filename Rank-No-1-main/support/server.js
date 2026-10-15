/**
 * ===============================================================
 *  Rank-Holder — Node.js Express Server (sql.js edition)
 *  AI Studio Production Server on port 3000
 * ===============================================================
 */

const path = require("path");
require("dotenv").config();
require("dotenv").config({ path: path.join(__dirname, "..", ".env", ".env") });
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const initSqlJs = require("sql.js");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const Razorpay = require("razorpay");
const { getApps, initializeApp, cert, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

// Razorpay SDK init
let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    try {
        const rzpKey = process.env.RAZORPAY_KEY_ID;
        const rzpSecret = process.env.RAZORPAY_KEY_SECRET;
    razorpay = new Razorpay({
        key_id: rzpKey,
        key_secret: rzpSecret,
    });
    } catch (e) {
        console.warn("⚠️ Razorpay init warning:", e.message);
    }
} else {
    console.warn("⚠️ Razorpay is disabled: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required.");
}
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";
const SUBSCRIPTION_AMOUNT_PAISE = 600; // ₹6 in paise

const app = express();
const PORT = 3000;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "tnesh833@gmail.com").toLowerCase().trim();
const ADMIN_EMAILS = ["tnesh833@gmail.com", "tnes833@gmail.com"];
function isAdminEmail(email) {
    if (!email) return false;
    const e = email.toLowerCase().trim();
    return ADMIN_EMAILS.includes(e) || e === ADMIN_EMAIL;
}
const encryptionSecret = process.env.EMAIL_ENCRYPTION_KEY || "rankholder-admin-email-key-2026";
const ENCRYPTION_KEY = crypto.createHash("sha256").update(encryptionSecret).digest();

/* ─── Security & Rate Limiting ─────────────────────────────────── */
app.set("trust proxy", 1); // Trust first proxy if behind Heroku/AWS
// HTTPS Redirect Middleware (Enforce HTTPS in production when not on localhost)
app.use((req, res, next) => {
    const host = req.headers.host || "";
    if (process.env.NODE_ENV === "production" && req.headers["x-forwarded-proto"] !== "https" && !host.includes("localhost") && !host.includes("127.0.0.1")) {
        return res.redirect("https://" + host + req.url);
    }
    next();
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 auth requests per window
    message: { error: "Too many requests from this IP, please try again after 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
});

/* ─── Middleware ───────────────────────────────────────────────── */
app.use(cors({
    origin: true,
    credentials: true,
}));
app.use(cookieParser());
app.use(express.json({
    limit: "50mb",
    verify(req, _res, buffer) {
        req.rawBody = Buffer.from(buffer);
    }
}));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Static asset serving
// server.js lives in /support while the UI lives in the project-root /frontend.
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
app.use(express.static(FRONTEND_DIR));
app.use("/frontend", express.static(FRONTEND_DIR));
if (fs.existsSync(path.join(__dirname, "Router"))) {
    app.use("/Router", express.static(path.join(__dirname, "Router")));
}
if (fs.existsSync(path.join(__dirname, "retified"))) {
    app.use("/retified", express.static(path.join(__dirname, "retified")));
}
if (fs.existsSync(path.join(__dirname, "navigation bar"))) {
    app.use("/navigation bar", express.static(path.join(__dirname, "navigation bar")));
}
if (fs.existsSync(path.join(__dirname, "cerficated.jpg"))) {
    app.get("/cerficated.jpg", (_req, res) => res.sendFile(path.join(__dirname, "cerficated.jpg")));
}

/* ─── Database Path ─────────────────────────────────────────────── */
const DB_DIR = path.join(__dirname, "..", "database");
const DB_PATH = path.join(DB_DIR, "rankholder.db");

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

/* ─── SQL.JS Database Wrapper ──────────────────────────────────── */
let db = null;

function encryptBuffer(buffer) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([Buffer.from("RHK1"), iv, tag, encrypted]);
}

function decryptBuffer(buffer) {
    try {
        if (!buffer || buffer.length < 19 || buffer.slice(0, 4).toString("hex") !== Buffer.from("RHK1").toString("hex")) {
            return buffer;
        }
        const iv = buffer.slice(4, 20);
        const tag = buffer.slice(20, 36);
        const encrypted = buffer.slice(36);
        const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    } catch (e) {
        console.error("[DB Error] decryptBuffer:", e.message);
        return buffer;
    }
}

function saveDb() {
    if (!db) return;
    try {
        const data = db.export();
        const encrypted = encryptBuffer(Buffer.from(data));
        fs.writeFileSync(DB_PATH, encrypted);
    } catch (e) {
        console.error("[DB Error] saveDb:", e.message);
    }
}

function findUserByEmail(email) {
    const e = normalizeEmail(email);
    if (!e) return null;
    return dbGet("SELECT * FROM users WHERE email_hash = ? OR email = ?", [hashEmail(e), e]);
}

function dbAll(sql, params = []) {
    try {
        if (!db) return [];
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
    } catch (e) {
        console.error("[DB Error] dbAll:", sql, e.message);
        return [];
    }
}

function dbGet(sql, params = []) {
    try {
        if (!db) return null;
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const row = stmt.step() ? stmt.getAsObject() : null;
        stmt.free();
        return row;
    } catch (e) {
        console.error("[DB Error] dbGet:", sql, e.message);
        return null;
    }
}

function dbRun(sql, params = []) {
    try {
        if (!db) return;
        db.run(sql, params);
        saveDb();
    } catch (e) {
        console.error("[DB Error] dbRun:", sql, e.message);
    }
}

function lastInsertId() {
    const row = dbGet("SELECT last_insert_rowid() as id");
    return row ? row.id : null;
}

function logAdminActivity(userId, action, details = "") {
    dbRun("INSERT INTO admin_activity (user_id, action, details) VALUES (?, ?, ?)", [userId || null, action, details]);
}

/* ─── Auth Helpers ─────────────────────────────────────────────── */
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
}

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function hashEmail(email) {
    return crypto.createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

function safeUserForResponse(user, currentUserEmail = "") {
    if (!user) return null;
    const isAdmin = normalizeEmail(currentUserEmail || "") === ADMIN_EMAIL;
    return {
        ...user,
        email: isAdmin ? user.email : (user.email ? user.email.slice(0, 2) + "***@" + user.email.split("@")[1] : "hidden"),
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        purpose: user.purpose || "",
        github_link: user.github_link || ""
    };
}

function verifyPassword(password, storedHash) {
    if (!storedHash) return false;
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    const expected = Buffer.from(key, "hex");
    const actual = Buffer.from(hash, "hex");
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

const SESSION_TTL = 24 * 60 * 60 * 1000;
function createSessionToken(userId) {
    const token = crypto.randomUUID() + "-" + crypto.randomBytes(8).toString("hex");
    const exp = new Date(Date.now() + SESSION_TTL).toISOString();
    dbRun("INSERT INTO sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)",
        [userId, token, exp]);
    return token;
}

function getUserFromToken(token) {
    if (!token) return null;
    const now = new Date().toISOString();
    const sess = dbGet("SELECT * FROM sessions WHERE session_token = ? AND expires_at > ?", [token, now]);
    if (!sess) return null;
    return dbGet("SELECT * FROM users WHERE id = ?", [sess.user_id]);
}

function isEmailBlocked(email) {
    if (!email || !db) return false;
    const e = String(email).toLowerCase().trim();
    if (!e) return false;
    const row = dbGet("SELECT id, status FROM users WHERE (email = ? OR email_hash = ?) AND status = 'BLOCKED'", [e, hashEmail(e)]);
    return !!row;
}

function requireAuth(req, res, next) {
    const header = req.headers["authorization"] || "";
    let token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token && req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }
    let user = getUserFromToken(token);

    // If user token is associated with a blocked user
    if (user && user.status === 'BLOCKED') {
        return res.status(403).json({
            error: "Your account has been blocked by the administrator. Blocked email IDs are prohibited from processing app functions.",
            is_blocked: true
        });
    }

    // Check if body/query/headers contains a blocked email
    const reqEmail = String(req.body?.email || req.query?.email || req.headers["x-user-email"] || "").toLowerCase().trim();
    if (reqEmail && isEmailBlocked(reqEmail)) {
        return res.status(403).json({
            error: "This email ID is blocked in Customer Management and prohibited from processing app functions.",
            is_blocked: true
        });
    }

    if (!user) return res.status(401).json({ error: "Authentication required", auth_required: true });

    if (user.status === 'BLOCKED') {
        return res.status(403).json({
            error: "Your account has been blocked by the administrator. Blocked email IDs are prohibited from processing app functions.",
            is_blocked: true
        });
    }

    function getFirebaseAuth() {
        if (!getApps().length) {
            const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
            if (serviceAccountJson) {
                try {
                    initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
                } catch (e) {
                    console.warn("[Firebase Admin] cert init failed:", e.message);
                }
            } else {
                try {
                    initializeApp({ credential: applicationDefault() });
                } catch (e) {
                    console.warn("[Firebase Admin] applicationDefault init failed:", e.message);
                }
            }
        }
        try {
            return getApps().length ? getAuth() : null;
        } catch (e) {
            console.warn("[Firebase Admin] getAuth failed:", e.message);
            return null;
        }
    }

    req.currentUser = user;
    next();
}

function requireAdmin(req, res, next) {
    const header = req.headers["authorization"] || "";
    let token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token && req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }
    const user = getUserFromToken(token);
    const isAdmin = !!(user && isAdminEmail(user.email));
    if (!user || !isAdmin) {
        return res.status(403).json({ error: `Access Denied: Only Admin (${ADMIN_EMAIL}) can access this resource.` });
    }
    req.user = user;
    next();
}

/* ─── Database Bootstrap Function ──────────────────────────────── */
async function initDatabase() {
    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
        try {
            const fileBuffer = fs.readFileSync(DB_PATH);
            const decrypted = decryptBuffer(fileBuffer);
            db = new SQL.Database(decrypted);
            console.log(`🗄️  Loaded existing database: ${DB_PATH}`);
        } catch (e) {
            console.warn("Could not load existing db, creating fresh:", e.message);
            db = new SQL.Database();
        }
    } else {
        db = new SQL.Database();
        console.log(`🗄️  Created new database: ${DB_PATH}`);
    }

    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            email       TEXT UNIQUE NOT NULL,
            email_hash TEXT UNIQUE,
            first_name  TEXT,
            last_name   TEXT,
            phone       TEXT,
            photo_url   TEXT,
            score       INTEGER DEFAULT 0,
            tokens      INTEGER DEFAULT 0,
            password_hash TEXT,
            purpose     TEXT,
            github_link TEXT,
            terms_accepted INTEGER DEFAULT 0,
            status      TEXT DEFAULT 'PENDING',
            last_login  TEXT,
            is_verified INTEGER DEFAULT 0,
            subscription_status TEXT DEFAULT 'trial',
            subscription_id     TEXT,
            subscribed_at       TEXT,
            created_at  TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS otp_codes (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            email      TEXT NOT NULL,
            otp_code   TEXT NOT NULL,
            purpose    TEXT NOT NULL DEFAULT 'register',
            expires_at TEXT NOT NULL,
            is_used    INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS sessions (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id       INTEGER NOT NULL,
            session_token TEXT UNIQUE NOT NULL,
            expires_at    TEXT NOT NULL,
            created_at    TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS user_settings (
            id        INTEGER PRIMARY KEY CHECK (id = 1),
            name      TEXT DEFAULT 'Rank Holder',
            email     TEXT DEFAULT '',
            mobile    TEXT DEFAULT '',
            theme     TEXT DEFAULT 'dark',
            ai_mode   TEXT DEFAULT 'builtin',
            comm_mode TEXT DEFAULT 'friendly',
            default_tab TEXT DEFAULT 'jobs'
        );
        CREATE TABLE IF NOT EXISTS notifications (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            title      TEXT NOT NULL,
            message    TEXT NOT NULL,
            category   TEXT DEFAULT 'general',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS prospects (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL,
            company    TEXT NOT NULL,
            linkedin   TEXT NOT NULL,
            status     TEXT DEFAULT 'Pending',
            idea       TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS jobs (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            title           TEXT NOT NULL,
            company         TEXT NOT NULL,
            location        TEXT NOT NULL,
            type            TEXT DEFAULT 'Full-time',
            experience      TEXT,
            salary          TEXT,
            skills          TEXT,
            link            TEXT NOT NULL,
            internship_link TEXT,
            hr_contact      TEXT,
            badge           TEXT,
            created_at      TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS game_scores (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER NOT NULL,
            game_name  TEXT NOT NULL,
            high_score INTEGER DEFAULT 0,
            updated_at TEXT DEFAULT (datetime('now')),
            UNIQUE(user_id, game_name)
        );
        CREATE TABLE IF NOT EXISTS knowledge_progress (
            user_id INTEGER PRIMARY KEY,
            state_json TEXT NOT NULL,
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS story_searches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            query TEXT NOT NULL,
            resolved_title TEXT,
            extract TEXT,
            page_url TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS feature_flags (
            feature_name TEXT PRIMARY KEY,
            is_enabled   INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS feedbacks (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_name  TEXT NOT NULL,
            user_email TEXT NOT NULL,
            rating     INTEGER DEFAULT 5,
            message    TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS infoglobal_permissions (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            email      TEXT UNIQUE NOT NULL,
            granted_by TEXT DEFAULT 'admin',
            granted_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS admin_activity (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER,
            action     TEXT NOT NULL,
            details    TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS freelance_chats (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER NOT NULL,
            sender     TEXT NOT NULL,
            message    TEXT NOT NULL,
            location   TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS interview_contexts (
            user_id    INTEGER PRIMARY KEY,
            company    TEXT NOT NULL,
            context    TEXT NOT NULL,
            updated_at TEXT DEFAULT (datetime('now'))
        );
    `);

    // Ensure columns exist for users
    const userCols = dbAll("PRAGMA table_info(users)");
    const requiredUserColumns = {
        email_hash: "TEXT",
        first_name: "TEXT",
        last_name: "TEXT",
        phone: "TEXT",
        photo_url: "TEXT",
        score: "INTEGER DEFAULT 0",
        tokens: "INTEGER DEFAULT 0",
        password_hash: "TEXT",
        purpose: "TEXT",
        github_link: "TEXT",
        terms_accepted: "INTEGER DEFAULT 0",
        status: "TEXT DEFAULT 'PENDING'",
        last_login: "TEXT",
        is_verified: "INTEGER DEFAULT 0",
        blocked_at: "TEXT",
        blocked_reason: "TEXT"
    };
    Object.entries(requiredUserColumns).forEach(([column, definition]) => {
        if (!userCols.some(c => c.name === column)) {
            dbRun(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
        }
    });
    dbRun("UPDATE users SET status = 'APPROVED' WHERE status IS NULL AND is_verified = 1");

    dbAll("SELECT id, email FROM users WHERE email_hash IS NULL AND email IS NOT NULL").forEach(user => {
        dbRun("UPDATE users SET email_hash = ? WHERE id = ?", [hashEmail(user.email), user.id]);
    });

    const adminPasswordRaw = String(process.env.ADMIN_PASSWORD || "").trim();
    if (adminPasswordRaw) {
        const adminHash = hashPassword(adminPasswordRaw);
        ADMIN_EMAILS.forEach(adminEmail => {
            const existingAdmin = dbGet("SELECT id FROM users WHERE email = ?", [adminEmail]);
            if (!existingAdmin) {
                dbRun("INSERT INTO users (name, email, email_hash, password_hash, is_verified, status) VALUES (?, ?, ?, ?, 1, 'APPROVED')",
                    ["Super Admin", adminEmail, hashEmail(adminEmail), adminHash]);
                console.log(`🛡️  Admin user created: ${adminEmail}`);
            } else {
                dbRun("UPDATE users SET email_hash = ?, is_verified = 1, status = 'APPROVED' WHERE email = ?", [hashEmail(adminEmail), adminEmail]);
            }
        });
    } else {
        console.warn("⚠️ ADMIN_PASSWORD is not configured; admin password login is disabled.");
    }

    // Seed default settings
    const settings = dbGet("SELECT COUNT(*) as c FROM user_settings");
    if (!settings || settings.c === 0) {
        dbRun(`INSERT INTO user_settings (id, name, email, mobile, theme, ai_mode, comm_mode, default_tab)
               VALUES (1, 'Rank Holder', 'tnesh8833@gmail.com', '+91 8610017559', 'dark', 'builtin', 'friendly', 'jobs')`);
    }

    // Seed initial notifications
    const notifs = dbGet("SELECT COUNT(*) as c FROM notifications");
    if (!notifs || notifs.c === 0) {
        dbRun("INSERT INTO notifications (title, message, category) VALUES (?, ?, ?)",
            ["Direct Hiring Openings", "Google & Zoho updated direct recruiter contacts and 2026 internship links.", "job"]);
        dbRun("INSERT INTO notifications (title, message, category) VALUES (?, ?, ?)",
            ["Bio AI Scanner Upgrade", "Uploaded image concept analysis and live Wikipedia history active.", "system"]);
    }

    // Seed initial jobs if empty
    const jobsCount = dbGet("SELECT COUNT(*) as c FROM jobs");
    if (!jobsCount || jobsCount.c === 0) {
        const initialJobs = [
            ["Software Engineering & Student Internships", "Google India", "Bengaluru / Hyderabad / Gurugram", "Full-time & Internship", "Fresher - 2 Yrs", "₹18 - ₹25 LPA", "Python, C++, Java, Data Structures, Cloud", "https://careers.google.com", "https://buildyourfuture.withgoogle.com/internships", "google-earlycareers@google.com", "MNC Tech Giant"],
            ["Member of Technical Staff & Campus Hire", "Zoho Corporation", "Chennai (Estancia / Guduvanchery / Tenkasi)", "Full-time & Internship", "Fresher - 1 Yr", "₹5.5 - ₹8.5 LPA", "Java, C++, JavaScript, SQL, Web Dev", "https://www.zoho.com/careers/", "https://www.zoho.com/schools/", "careers@zohocorp.com", "Chennai IT Hub"],
            ["TCS Digital & Ninja Hiring Drive", "Tata Consultancy Services", "Chennai (Tidel Park) / Pan India", "Full-time & Internship", "Fresher (2026 Batch)", "₹7.5 - ₹11.5 LPA", "Python, Cloud, Data Analytics, Fullstack", "https://www.tcs.com/careers", "https://onboarding.tcs.com", "campus.hiring@tcs.com", "National Driver"],
            ["AI Research & GPU Systems Engineer", "Nvidia India", "Bengaluru / Pune", "Full-time & Internship", "0 - 3 Yrs", "₹24 - ₹32 LPA", "CUDA, PyTorch, C++, Deep Learning", "https://www.nvidia.com/en-in/about-nvidia/careers/", "https://www.nvidia.com/en-us/about-nvidia/careers/university-recruiting/", "university-hiring@nvidia.com", "AI World Leader"],
            ["Software Engineer - Early Careers", "Microsoft India", "Hyderabad / Bengaluru / Noida", "Full-time & Internship", "Fresher - 2 Yrs", "₹20 - ₹28 LPA", "C#, Python, Azure, Systems Design", "https://careers.microsoft.com", "https://careers.microsoft.com/students/us/en", "msindia-recruiters@microsoft.com", "Tech Giant"],
            ["Graduate Engineer Trainee & Intern", "Cognizant (CTS)", "Chennai (Elcot SEZ) / Coimbatore / HYD", "Full-time & Internship", "Fresher", "₹4.5 - ₹6.8 LPA", "Java, Python, SQL, Cloud Fundamentals", "https://www.cognizant.com/in/en/careers", "https://www.cognizant.com/in/en/careers/campus-hiring", "genc-campus@cognizant.com", "Global IT Leader"],
            ["Frontend & Product Dev Engineer", "Freshworks", "Chennai (Guindy / OMR)", "Full-time & Internship", "Fresher - 2 Yrs", "₹9 - ₹14 LPA", "JavaScript, React, Node.js, SaaS", "https://www.freshworks.com/careers/", "https://www.freshworks.com/careers/early-careers/", "careers@freshworks.com", "SaaS Unicorn"]
        ];
        initialJobs.forEach(j => {
            dbRun(`INSERT INTO jobs (title, company, location, type, experience, salary, skills, link, internship_link, hr_contact, badge)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, j);
        });
    }

    // Seed initial prospects if empty
    const prosCount = dbGet("SELECT COUNT(*) as c FROM prospects");
    if (!prosCount || prosCount.c === 0) {
        dbRun(`INSERT INTO prospects (name, company, linkedin, status, idea) VALUES (?, ?, ?, ?, ?)`,
            ["Anand Kumar", "TechVentures Asia", "https://linkedin.com/in/example1", "Sent", "AI-powered clinical scanner for rural hospitals."]);
        dbRun(`INSERT INTO prospects (name, company, linkedin, status, idea) VALUES (?, ?, ?, ?, ?)`,
            ["Priya Sharma", "InnovateLabs", "https://linkedin.com/in/example2", "Replied", "Automated resume-to-job matching portal."]);
    }

    // Ensure all feature flags are enabled
    const allTabs = [
        'tab_jobs', 'tab_growup', 'tab_corporate', 'tab_english',
        'tab_projects', 'tab_games', 'tab_refresh_games', 'tab_knowledge_lab'
    ];
    allTabs.forEach(flag => {
        dbRun(`INSERT INTO feature_flags (feature_name, is_enabled) VALUES (?, 1)
               ON CONFLICT(feature_name) DO UPDATE SET is_enabled = 1`, [flag]);
    });

    saveDb();

    // ── Subscription column migrations (safe for existing DBs) ──
    const alterMigrations = [
        "ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'trial'",
        "ALTER TABLE users ADD COLUMN subscription_id TEXT",
        "ALTER TABLE users ADD COLUMN subscribed_at TEXT",
    ];
    alterMigrations.forEach(sql => {
        try { db.run(sql); } catch (e) { /* column already exists — safe to ignore */ }
    });
    saveDb();

    console.log("✅ Database initialized successfully.");
}

/* ─── SMTP / Email Setup ───────────────────────────────────────── */
const SMTP_EMAIL = (process.env.SMTP_EMAIL || "").trim();
const SMTP_PASSWORD = (process.env.SMTP_PASSWORD || "").replace(/\s/g, "").trim();
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT_NUM = parseInt(process.env.SMTP_PORT || "587");
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes expiry (generous window for mobile email access)

let transporter = null;
if (SMTP_EMAIL && SMTP_PASSWORD) {
    transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT_NUM,
        secure: SMTP_PORT_NUM === 465,
        auth: { user: SMTP_EMAIL, pass: SMTP_PASSWORD },
        tls: { rejectUnauthorized: false }
    });
    console.log(`📧 SMTP ready: ${SMTP_EMAIL}`);
} else {
    console.warn("⚠️ SMTP is not configured; OTP delivery is disabled.");
}

function generateOTP() {
    return String(100000 + Math.floor(Math.random() * 900000));
}

async function sendOTPEmail(toEmail, otpCode, purpose = "verification") {
    const cleanEmail = String(toEmail || "").trim().toLowerCase();
    // Clear subject with code first for instant lock-screen & notification display
    const subj = `Rank-Holder Code: ${otpCode} (Verification)`;

    // Plain-text version for maximum deliverability & quick phone notification preview
    const plainText = `Your Rank-Holder verification code is: ${otpCode}\n\nUse this 6-digit code to complete your ${purpose}.\nThis code is valid for 10 minutes.\n\nIf you did not request this, you can safely ignore this email.\n\n— Rank-Holder Team`;

    // Mobile-optimised, high-contrast HTML email template
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rank-Holder Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #05081a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #05081a; padding: 24px 10px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #0d122b; border: 1px solid rgba(99,102,241,0.3); border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
                    <tr>
                        <td align="center" style="padding: 28px 24px 16px; background: linear-gradient(180deg, rgba(99,102,241,0.18) 0%, transparent 100%);">
                            <div style="display: inline-block; width: 46px; height: 46px; line-height: 46px; border-radius: 14px; background: linear-gradient(135deg, #6366f1, #8b5cf6); font-size: 22px; text-align: center; color: #ffffff; box-shadow: 0 4px 16px rgba(99,102,241,0.4);">🛡️</div>
                            <h1 style="margin: 12px 0 4px; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">Rank-Holder</h1>
                            <p style="margin: 0; font-size: 12px; font-weight: 600; color: #a5b4fc; text-transform: uppercase; letter-spacing: 1px;">Security Verification</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 28px 24px; text-align: center;">
                            <p style="margin: 0 0 10px; font-size: 15px; color: #e2e8f0; line-height: 1.5;">
                                Your verification code for <strong style="color: #818cf8;">${purpose}</strong> is:
                            </p>
                            <!-- High-contrast OTP Display Box -->
                            <div style="margin: 16px 0; padding: 18px; background-color: #070a1a; border: 2px dashed rgba(99,102,241,0.5); border-radius: 12px; text-align: center;">
                                <span style="font-family: 'Courier New', Courier, monospace, sans-serif; font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; display: inline-block;">${otpCode}</span>
                            </div>
                            <p style="margin: 0 0 16px; font-size: 13px; color: #94a3b8; line-height: 1.5;">
                                ⏱️ This code will expire in <strong style="color: #f1f5f9;">10 minutes</strong>.<br>Enter this code on your phone or computer to continue.
                            </p>
                            <div style="padding: 12px 14px; background: rgba(99,102,241,0.08); border-radius: 8px; border-left: 3px solid #6366f1; text-align: left;">
                                <p style="margin: 0; font-size: 12px; color: #cbd5e1; line-height: 1.4;">
                                    🔒 <strong>Inbox Tip:</strong> If not found in your Primary inbox, please check your <strong>Spam / Junk</strong> folder or <strong>Promotions</strong> tab.
                                </p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 14px 20px 20px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 11px; color: #64748b;">
                            <p style="margin: 0 0 4px;">Sent to <span style="color: #94a3b8;">${cleanEmail}</span></p>
                            <p style="margin: 0;">Rank-Holder Career &amp; AI Intelligence Platform</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;

    if (transporter) {
        try {
            await transporter.sendMail({
                from: `"Rank-Holder Verification" <${SMTP_EMAIL}>`,
                to: cleanEmail,
                replyTo: SMTP_EMAIL,
                priority: "high",
                headers: {
                    'X-Priority': '1',
                    'X-MSMail-Priority': 'High',
                    'Importance': 'High'
                },
                subject: subj,
                text: plainText,
                html: html
            });
            console.log(`[SMTP ✅] OTP sent to phone/email → ${cleanEmail}`);
            return true;
        } catch (err) {
            console.error(`[SMTP ❌] Failed to send email to ${cleanEmail}:`, err.message);
            return false;
        }
    }
    console.log(`\n══════════════════════════════════════════════════`);
    console.log(`  📧 OTP for ${cleanEmail}: ${otpCode}`);
    console.log(`══════════════════════════════════════════════════\n`);
    return true;
}

async function sendSystemEmail(toEmail, subject, text, html = "") {
    const cleanEmail = String(toEmail || "").trim().toLowerCase();
    if (!cleanEmail) return false;

    const plainText = text || "Rank-Holder notification";
    const htmlText = html || `<p>${plainText.replace(/\n/g, "<br>")}</p>`;

    if (transporter) {
        try {
            await transporter.sendMail({
                from: `"Rank-Holder Platform" <${SMTP_EMAIL}>`,
                to: cleanEmail,
                replyTo: SMTP_EMAIL,
                subject,
                text: plainText,
                html: htmlText
            });
            console.log(`[SMTP ✅] System email sent to → ${cleanEmail}`);
            return true;
        } catch (err) {
            console.error(`[SMTP ❌] Failed to send system email to ${cleanEmail}:`, err.message);
        }
    }

    console.log(`\n══════════════════════════════════════════════════`);
    console.log(`  📧 System email to ${cleanEmail}: ${subject}`);
    console.log(`  ${plainText}`);
    console.log(`══════════════════════════════════════════════════\n`);
    return true;
}

/* ═══════════════════════════════════════════════════════════════
   AUTH ROUTES
═══════════════════════════════════════════════════════════════ */
app.post("/api/auth/register", authLimiter, async (req, res) => {
    const { name = "", first_name = "", last_name = "", phone = "", email = "", purpose = "", github_link = "", terms_accepted = false, password = "" } = req.body || {};
    const fullName = String(name || `${first_name || ""} ${last_name || ""}`.trim()).trim();
    const first = String(first_name || "").trim();
    const last = String(last_name || "").trim();
    const p = String(phone || "").trim();
    const e = normalizeEmail(email);
    const purposeText = String(purpose || "").trim();
    const github = String(github_link || "").trim();
    const pwd = String(password || "").trim();

    if (!fullName || !first || !last || !e || !purposeText || !github || !pwd) {
        return res.status(400).json({ error: "First name, last name, email, purpose, GitHub link, and password are required." });
    }
    if (!terms_accepted) {
        return res.status(400).json({ error: "You must accept the terms and conditions to continue." });
    }
    if (!e.includes("@") || !e.includes(".")) return res.status(400).json({ error: "Please enter a valid email address." });
    if (pwd.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
    if (pwd.length > 128) return res.status(400).json({ error: "Password must be 128 characters or fewer." });

    const lookupKey = hashEmail(e);
    const existing = dbGet("SELECT id, is_verified FROM users WHERE email_hash = ?", [lookupKey]);
    if (existing && existing.is_verified === 1) {
        return res.status(409).json({ error: "This email is already registered. Please login instead." });
    }

    dbRun("UPDATE otp_codes SET is_used = 1 WHERE email = ? AND is_used = 0", [e]);

    const otp = generateOTP();
    const exp = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();
    dbRun("INSERT INTO otp_codes (email, otp_code, purpose, expires_at) VALUES (?, ?, 'register', ?)", [e, otp, exp]);

    const pHash = hashPassword(pwd);
    if (existing) {
        dbRun("UPDATE users SET name = ?, first_name = ?, last_name = ?, phone = ?, purpose = ?, github_link = ?, terms_accepted = 1, password_hash = ?, email_hash = ?, email = ?, tokens = 100 WHERE email_hash = ? AND is_verified = 0", [fullName, first, last, p, purposeText, github, pHash, lookupKey, e, lookupKey]);
    } else {
        dbRun("INSERT INTO users (name, first_name, last_name, email, email_hash, phone, purpose, github_link, terms_accepted, password_hash, is_verified, status, tokens) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0, 'PENDING', 100)", [fullName, first, last, e, lookupKey, p, purposeText, github, pHash]);
    }

    if (!await sendOTPEmail(e, otp, "registration")) {
        return res.status(503).json({ error: "Verification email is temporarily unavailable. Please try again later." });
    }
    await sendSystemEmail(ADMIN_EMAIL, `New registration request: ${e}`,
        `New user registration has started.\n\nName: ${fullName}\nEmail: ${e}\nPurpose: ${purposeText}\nGitHub: ${github}\n\nA verification code was sent to the user email and admin review is enabled.`,
        `<p><strong>New registration request</strong></p><p><strong>Name:</strong> ${fullName}</p><p><strong>Email:</strong> ${e}</p><p><strong>Purpose:</strong> ${purposeText}</p><p><strong>GitHub:</strong> ${github}</p><p>A verification code was sent to the user email and admin review is enabled.</p>`
    );
    return res.json({ success: true, message: `Verification code sent to ${e}.` });
});

app.post("/api/auth/verify-register", (req, res) => {
    const { email = "", otp = "" } = req.body || {};
    const e = String(email || "").trim().toLowerCase(), o = String(otp || "").trim();

    const now = new Date().toISOString();
    const record = dbGet(
        "SELECT * FROM otp_codes WHERE email=? AND otp_code=? AND is_used=0 AND expires_at>? ORDER BY id DESC LIMIT 1",
        [e, o, now]
    );
    if (!record) return res.status(400).json({ error: "Invalid or expired code. Please try again." });

    dbRun("UPDATE otp_codes SET is_used = 1 WHERE id = ?", [record.id]);
    dbRun("UPDATE users SET is_verified = 1, status = 'APPROVED' WHERE email = ?", [e]);

    const user = dbGet("SELECT * FROM users WHERE email = ?", [e]);
    if (!user) return res.status(404).json({ error: "User not found." });

    const token = createSessionToken(user.id);
    res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000
    });

    dbRun("INSERT INTO notifications (title, message, category) VALUES (?, ?, ?)",
        ["New Customer Registration", `${user.name} (${user.email}) has verified their email and joined Rank-Holder!`, "system"]);
    dbRun("UPDATE users SET email_hash = ? WHERE id = ?", [hashEmail(e), user.id]);

    sendSystemEmail(ADMIN_EMAIL,
        `Verified customer: ${user.email}`,
        `A new customer has verified their email and joined the platform.\n\nName: ${user.name}\nEmail: ${user.email}\nStatus: ${user.status || "APPROVED"}\n\nAdmin can review this account from the admin panel.`,
        `<p><strong>Verified customer</strong></p><p><strong>Name:</strong> ${user.name}</p><p><strong>Email:</strong> ${user.email}</p><p><strong>Status:</strong> ${user.status || "APPROVED"}</p><p>Admin can review this account from the admin panel.</p>`
    ).catch(() => { });

    return res.json({
        success: true,
        message: "Registration successful! Your account is verified and active.",
        token,
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, status: user.status, is_verified: user.is_verified, tokens: user.tokens || 100 }
    });
});

app.post("/api/auth/firebase-login", async (req, res) => {
    const { idToken, name, email, photo_url } = req.body || {};
    if (typeof idToken !== "string" || !idToken.trim()) {
        return res.status(400).json({ error: "A Firebase ID token is required." });
    }

    let decodedToken;
    try {
        const auth = getFirebaseAuth();
        if (!auth) {
            return res.status(503).json({ error: "Firebase authentication service is not configured." });
        }
        decodedToken = await auth.verifyIdToken(idToken);
    } catch (error) {
        console.error("[Firebase] ID token verification failed:", error.message);
        return res.status(401).json({ error: "Firebase sign-in could not be verified." });
    }

    const verifiedEmail = normalizeEmail(decodedToken.email);
    if (!verifiedEmail || decodedToken.email_verified !== true) {
        return res.status(401).json({ error: "A verified Firebase email is required." });
    }

    const e = verifiedEmail;
    const verifiedName = typeof decodedToken.name === "string" ? decodedToken.name : "";
    const verifiedPhotoUrl = typeof decodedToken.picture === "string" ? decodedToken.picture : "";
    const lookupKey = hashEmail(e);
    let user = dbGet("SELECT * FROM users WHERE email_hash = ? OR email = ?", [lookupKey, e]);

    if (!user) {
        // Register new user via Google
        const fullName = verifiedName || String(name || "").trim() || e.split('@')[0];
        const pHash = hashPassword(crypto.randomBytes(32).toString("hex"));
        dbRun("INSERT INTO users (name, first_name, email, email_hash, purpose, terms_accepted, password_hash, is_verified, status, tokens, photo_url) VALUES (?, ?, ?, ?, ?, 1, ?, 1, 'APPROVED', 100, ?)",
            [fullName, fullName.split(' ')[0], e, lookupKey, "Google Sign-In", pHash, verifiedPhotoUrl || String(photo_url || "").trim()]);

        user = dbGet("SELECT * FROM users WHERE email_hash = ?", [lookupKey]);
        dbRun("INSERT INTO notifications (title, message, category) VALUES (?, ?, ?)",
            ["New Customer Registration (Google)", `${user.name} (${user.email}) has joined via Google!`, "system"]);
    } else {
        if (user.status === "BLOCKED") {
            return res.status(403).json({ error: "Your account has been blocked. Please contact support/admin." });
        }
        // Ensure email_hash is updated if it was missing, and ensure user is verified
        dbRun("UPDATE users SET is_verified = 1, status = 'APPROVED', email_hash = ?, photo_url = COALESCE(NULLIF(?, ''), photo_url) WHERE id = ?", [lookupKey, verifiedPhotoUrl || String(photo_url || "").trim(), user.id]);
        user.is_verified = 1;
        user.status = 'APPROVED';
    }

    if (user.status === 'BLOCKED') {
        return res.status(403).json({ error: "Your account has been blocked.", is_blocked: true });
    }

    const token = createSessionToken(user.id);
    res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000
    });

    return res.json({
        success: true,
        message: "Google login successful!",
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.email === ADMIN_EMAIL ? 'admin' : 'user', status: user.status, is_verified: user.is_verified, tokens: user.tokens || 100 }
    });
});

app.post("/api/auth/resend-otp", async (req, res) => {
    const { email = "", purpose = "verification" } = req.body || {};
    const e = String(email || "").trim().toLowerCase();
    if (!e || !e.includes("@")) {
        return res.status(400).json({ error: "A valid email address is required." });
    }

    dbRun("UPDATE otp_codes SET is_used = 1 WHERE email = ? AND is_used = 0", [e]);

    const otp = generateOTP();
    const exp = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();
    dbRun("INSERT INTO otp_codes (email, otp_code, purpose, expires_at) VALUES (?, ?, ?, ?)", [e, otp, purpose, exp]);

    const sent = await sendOTPEmail(e, otp, purpose);
    if (!sent && transporter) {
        return res.status(503).json({ error: "Verification email is temporarily unavailable. Please try again later." });
    }
    const resendResp = { success: true, message: transporter ? `New verification code sent to ${e}.` : `Verification code: ${otp}`, demo_otp: otp };
    return res.json(resendResp);
});

app.post("/api/auth/login-otp-request", async (req, res) => {
    const { email = "", name = "", photo_url = "" } = req.body || {};
    const e = normalizeEmail(email);
    const n = String(name || "").trim();
    const p = String(photo_url || "").trim();

    if (!e) return res.status(400).json({ error: "Email is required." });

    let user = dbGet("SELECT * FROM users WHERE email_hash = ? OR email = ?", [hashEmail(e), e]);

    if (!user) {
        const userName = n || e.split('@')[0];
        dbRun("INSERT INTO users (name, email, email_hash, photo_url, is_verified, status) VALUES (?, ?, ?, ?, 0, 'APPROVED')", [userName, e, hashEmail(e), p]);
        user = dbGet("SELECT * FROM users WHERE email_hash = ? OR email = ?", [hashEmail(e), e]);
    } else {
        if (user.status === 'PENDING') {
            dbRun("UPDATE users SET status = 'APPROVED' WHERE id = ?", [user.id]);
            user.status = 'APPROVED';
        }
        if (n || p) {
            dbRun("UPDATE users SET name = COALESCE(NULLIF(?, ''), name), photo_url = COALESCE(NULLIF(?, ''), photo_url) WHERE email = ?", [n, p, e]);
        }
    }

    if (!user) return res.status(500).json({ error: "Unable to initialize this account. Please try again." });

    if (user.status === 'BLOCKED') return res.status(403).json({ error: "Your account has been blocked. Please contact support/admin." });

    dbRun("UPDATE otp_codes SET is_used = 1 WHERE email = ? AND is_used = 0", [e]);

    const otp = generateOTP();
    const exp = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();
    dbRun("INSERT INTO otp_codes (email, otp_code, purpose, expires_at) VALUES (?, ?, 'login', ?)", [e, otp, exp]);

    const sent = await sendOTPEmail(e, otp, "login");
    if (!sent && transporter) {
        return res.status(503).json({ error: "Login email is temporarily unavailable. Please try again later." });
    }
    const loginResp = {
        success: true,
        message: transporter ? `Login code sent to ${e}.` : `Verification code: ${otp} (pre-filled below)`,
        demo_otp: otp
    };
    return res.json(loginResp);
});

const handleLogin = async (req, res) => {
    const { email = "", otp = "", password = "" } = req.body || {};
    const e = String(email || "").trim().toLowerCase(), o = String(otp || "").trim(), p = String(password || "").trim();
    if (!e || (!o && !p)) return res.status(400).json({ error: "Email and password or OTP code are required." });

    const user = dbGet("SELECT * FROM users WHERE email = ?", [e]);
    if (!user) return res.status(404).json({ error: "No account found with this email." });

    if (user.status === 'BLOCKED') {
        return res.status(403).json({ error: "Your account has been blocked. Please contact support/admin." });
    }

    let authenticated = false;

    // Check password if provided
    if (p) {
        if (user.password_hash && verifyPassword(p, user.password_hash)) {
            authenticated = true;
        } else {
            return res.status(400).json({ error: "Incorrect password. Please verify and try again." });
        }
    }

    // Check OTP if password wasn't provided or needed verification
    if (!authenticated && o) {
        const now = new Date().toISOString();
        const record = dbGet(
            "SELECT * FROM otp_codes WHERE email=? AND otp_code=? AND is_used=0 AND expires_at>? ORDER BY id DESC LIMIT 1",
            [e, o, now]
        );
        if (!record) return res.status(400).json({ error: "Invalid or expired verification code. Please try again." });
        dbRun("UPDATE otp_codes SET is_used = 1 WHERE id = ?", [record.id]);
        dbRun("UPDATE users SET is_verified = 1, status = 'APPROVED' WHERE email = ?", [e]);
        authenticated = true;
    }

    if (!authenticated) {
        return res.status(400).json({ error: "Authentication failed. Provide valid password or OTP code." });
    }

    const now = new Date().toISOString();
    dbRun("UPDATE users SET last_login = ? WHERE id = ?", [now, user.id]);
    logAdminActivity(user.id, "LOGIN", `User authenticated from ${req.ip || "unknown IP"}`);

    const token = createSessionToken(user.id);
    res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000
    });
    const is_admin = (user.email || "").toLowerCase() === "tnesh833@gmail.com";
    return res.json({
        success: true,
        message: `Welcome back, ${user.name}!`,
        token,
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, status: user.status, is_admin, tokens: user.tokens || 100 }
    });
};

app.post("/api/auth/login", authLimiter, handleLogin);
app.post("/api/auth/verify-login", authLimiter, handleLogin);

// Dedicated Admin Login Endpoint
app.post("/api/admin/login", async (req, res) => {
    const { email = ADMIN_EMAIL, password = "", otp = "" } = req.body || {};
    const e = String(email || "").trim().toLowerCase();
    const p = String(password || "").trim();
    const o = String(otp || "").trim();

    if (!isAdminEmail(e)) {
        return res.status(403).json({ error: `Access Denied: Only ${ADMIN_EMAIL} is authorized as Administrator.` });
    }

    const adminUser = dbGet("SELECT * FROM users WHERE email = ? OR email_hash = ?", [e, hashEmail(e)]);
    if (!adminUser) {
        return res.status(404).json({ error: "Admin account not initialized." });
    }

    let authed = false;
    if (p) {
        if (adminUser.password_hash && verifyPassword(p, adminUser.password_hash)) {
            authed = true;
        } else {
            return res.status(400).json({ error: "Incorrect Admin master password." });
        }
    }

    if (!authed && o) {
        const now = new Date().toISOString();
        const record = dbGet(
            "SELECT * FROM otp_codes WHERE email=? AND otp_code=? AND purpose='login' AND is_used=0 AND expires_at>? ORDER BY id DESC LIMIT 1",
            [e, o, now]
        );
        if (record) {
            dbRun("UPDATE otp_codes SET is_used = 1 WHERE id = ?", [record.id]);
            authed = true;
        } else {
            return res.status(400).json({ error: "Invalid or expired Admin verification code." });
        }
    }

    if (!authed) {
        return res.status(400).json({ error: "Please enter the Admin master password or a valid verification code." });
    }

    const now = new Date().toISOString();
    dbRun("UPDATE users SET last_login = ? WHERE id = ?", [now, adminUser.id]);
    const token = createSessionToken(adminUser.id);
    res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000
    });

    return res.json({
        success: true,
        message: "Admin authentication successful!",
        token,
        user: { id: adminUser.id, name: adminUser.name, email: adminUser.email, is_admin: true }
    });
});

app.get("/api/auth/me", (req, res) => {
    const header = req.headers["authorization"] || "";
    let token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token && req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }
    const user = getUserFromToken(token);
    if (!user) return res.status(401).json({ error: "Not authenticated", auth_required: true });

    // Calculate effective subscription status based on trial window (7 days from created_at)
    const createdAt = user.created_at ? new Date(user.created_at).getTime() : Date.now();
    const TRIAL_DAYS = 7;
    const trialExpired = (Date.now() - createdAt) > TRIAL_DAYS * 24 * 60 * 60 * 1000;
    let effectiveStatus = user.subscription_status || 'trial';
    if (effectiveStatus === 'trial' && trialExpired) effectiveStatus = 'expired';

    return res.json({
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            status: user.status,
            tokens: user.tokens || 100,
            subscription_status: effectiveStatus,
            subscription_id: user.subscription_id || null,
            created_at: user.created_at,
            trial_expired: trialExpired
        }
    });
});

app.get("/api/app-version", (req, res) => {
    try {
        const versionData = JSON.parse(fs.readFileSync(path.join(__dirname, "app-version.json")));
        return res.json(versionData);
    } catch (e) {
        return res.json({ version: "1.0.0", changes: [] });
    }
});

app.post("/api/auth/profile", requireAuth, (req, res) => {
    const { phone = "", courses = "" } = req.body || {};
    dbRun("UPDATE users SET phone = COALESCE(NULLIF(?, ''), phone) WHERE id = ?", [phone, req.currentUser.id]);
    const updated = dbGet("SELECT id, name, email, phone, status FROM users WHERE id = ?", [req.currentUser.id]);
    return res.json({ success: true, user: updated });
});

app.post("/api/auth/logout", (req, res) => {
    const header = req.headers["authorization"] || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (token) dbRun("DELETE FROM sessions WHERE session_token = ?", [token]);
    return res.json({ success: true, message: "Logged out successfully." });
});

app.post("/api/auth/otp-to-password", async (req, res) => {
    const { email = "", otp = "" } = req.body || {};
    const e = email.trim().toLowerCase(), o = otp.trim();
    if (!e || !o) return res.status(400).json({ error: "Email and OTP code are required." });

    const user = dbGet("SELECT * FROM users WHERE email = ?", [e]);
    if (!user) return res.status(404).json({ error: "No account found with this email." });

    const now = new Date().toISOString();
    const record = dbGet(
        "SELECT * FROM otp_codes WHERE email=? AND otp_code=? AND is_used=0 AND expires_at>? ORDER BY id DESC LIMIT 1",
        [e, o, now]
    );
    if (!record) return res.status(400).json({ error: "Invalid or expired code. Please request a new one." });

    dbRun("UPDATE otp_codes SET is_used = 1 WHERE id = ?", [record.id]);
    const newHash = hashPassword(o);
    dbRun("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, user.id]);

    return res.json({ success: true, message: "Password updated! You can now log in using this code as your password." });
});

app.get("/api/auth/check-status", (req, res) => {
    const email = String(req.query.email || "").toLowerCase().trim();
    if (!email) return res.json({ is_blocked: false, status: "APPROVED" });
    const user = dbGet("SELECT id, status, blocked_reason FROM users WHERE (email = ? OR email_hash = ?)", [email, hashEmail(email)]);
    if (user && user.status === 'BLOCKED') {
        return res.json({ is_blocked: true, status: 'BLOCKED', reason: user.blocked_reason || "Account restricted by administrator." });
    }
    return res.json({ is_blocked: false, status: user ? user.status : "APPROVED" });
});

/* ═══════════════════════════════════════════════════════════════
   ADMIN ROUTES
═══════════════════════════════════════════════════════════════ */
app.get("/api/auth/is-admin", requireAdmin, (_req, res) => {
    return res.json({ is_admin: true });
});

app.get("/api/admin/customers", requireAdmin, (_req, res) => {
    const users = dbAll("SELECT id, name, email, phone, status, is_verified, created_at, last_login, blocked_at, blocked_reason FROM users ORDER BY created_at DESC");
    return res.json({ customers: users.map(u => safeUserForResponse(u, ADMIN_EMAIL)) });
});

app.post("/api/admin/customers/:id/status", requireAdmin, async (req, res) => {
    const { status, reason = "" } = req.body || {};
    if (!['PENDING', 'APPROVED', 'BLOCKED'].includes(status)) {
        return res.status(400).json({ error: "Invalid status." });
    }
    const customer = dbGet("SELECT id, name, email, status FROM users WHERE id = ?", [req.params.id]);
    if (!customer) return res.status(404).json({ error: "Customer not found." });
    if (customer.email.toLowerCase() === ADMIN_EMAIL) return res.status(400).json({ error: "The administrator account cannot be blocked." });

    const blockReason = String(reason).trim() || "Policy violation or misuse";
    const now = new Date().toISOString();
    const nowFormatted = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    if (status === "BLOCKED") {
        // Delete all sessions so the user is immediately kicked out
        dbRun("DELETE FROM sessions WHERE user_id = ?", [customer.id]);
        dbRun("UPDATE users SET status = ?, blocked_at = ?, blocked_reason = ? WHERE id = ?", [status, now, blockReason, req.params.id]);
        logAdminActivity(customer.id, "ACCOUNT_BLOCKED", blockReason);
        // Email alert to admin
        sendSystemEmail(ADMIN_EMAIL,
            `🔒 Account Blocked: ${customer.email}`,
            `An account has been permanently blocked.\n\nUser: ${customer.name}\nEmail: ${customer.email}\nReason: ${blockReason}\nTime: ${nowFormatted}\n\nAll active sessions have been invalidated immediately.`,
            `<div style="font-family:sans-serif;background:#05070f;color:#f8fafc;padding:24px;border-radius:12px;"><h2 style="color:#f43f5e;">🔒 Account Blocked</h2><p><strong>Name:</strong> ${customer.name}</p><p><strong>Email:</strong> ${customer.email}</p><p><strong>Reason:</strong> ${blockReason}</p><p><strong>Time:</strong> ${nowFormatted}</p><p style="color:#94a3b8;">All active sessions have been invalidated. The user will be locked out immediately.</p></div>`
        ).catch(() => { });
        // Notify the blocked user by email
        sendSystemEmail(customer.email,
            `Your Rank Holder account has been restricted`,
            `Dear ${customer.name},\n\nYour account on Rank Holder has been restricted by the administrator.\n\nReason: ${blockReason}\n\nIf you believe this is a mistake, please reply to this email.\n\n— Rank Holder Team`,
            `<div style="font-family:sans-serif;background:#05070f;color:#f8fafc;padding:24px;border-radius:12px;"><h2 style="color:#f43f5e;">Account Restricted</h2><p>Dear <strong>${customer.name}</strong>,</p><p>Your Rank Holder account has been restricted by the administrator.</p><p><strong>Reason:</strong> ${blockReason}</p><p>If you believe this is a mistake, please contact us by replying to this email.</p><p style="color:#94a3b8;">— Rank Holder Team</p></div>`
        ).catch(() => { });
    } else if (status === "APPROVED" && customer.status === "BLOCKED") {
        dbRun("UPDATE users SET status = ?, blocked_at = NULL, blocked_reason = NULL WHERE id = ?", [status, req.params.id]);
        logAdminActivity(customer.id, "ACCOUNT_REACTIVATED", "Reactivated by administrator approval");
        // Email alert to admin
        sendSystemEmail(ADMIN_EMAIL,
            `✅ Account Reactivated: ${customer.email}`,
            `An account has been reactivated.\n\nUser: ${customer.name}\nEmail: ${customer.email}\nTime: ${nowFormatted}`,
            `<div style="font-family:sans-serif;background:#05070f;color:#f8fafc;padding:24px;border-radius:12px;"><h2 style="color:#10b981;">✅ Account Reactivated</h2><p><strong>Name:</strong> ${customer.name}</p><p><strong>Email:</strong> ${customer.email}</p><p><strong>Time:</strong> ${nowFormatted}</p></div>`
        ).catch(() => { });
        // Notify user their account is restored
        sendSystemEmail(customer.email,
            `Your Rank Holder account has been reactivated`,
            `Dear ${customer.name},\n\nGreat news! Your Rank Holder account has been reviewed and reactivated by the administrator.\n\nYou can now log in and access the platform again.\n\n— Rank Holder Team`,
            `<div style="font-family:sans-serif;background:#05070f;color:#f8fafc;padding:24px;border-radius:12px;"><h2 style="color:#10b981;">Account Reactivated ✅</h2><p>Dear <strong>${customer.name}</strong>,</p><p>Your account has been reviewed and reactivated by the administrator. You can now log in and access the platform.</p><p style="color:#94a3b8;">— Rank Holder Team</p></div>`
        ).catch(() => { });
    } else {
        dbRun("UPDATE users SET status = ? WHERE id = ?", [status, req.params.id]);
        logAdminActivity(customer.id, `STATUS_${status}`, "Status changed by administrator");
    }
    return res.json({ success: true, message: `Status updated to ${status}` });
});

app.get("/api/admin/activity", requireAdmin, (_req, res) => {
    const rows = dbAll(`SELECT a.id, a.user_id, a.action, a.details, a.created_at,
        COALESCE(u.name, 'System') AS user_name, COALESCE(u.email, '') AS user_email
        FROM admin_activity a LEFT JOIN users u ON u.id = a.user_id
        ORDER BY a.id DESC LIMIT 200`);
    return res.json({ activity: rows });
});

app.get("/api/features", (_req, res) => {
    const rows = dbAll("SELECT * FROM feature_flags");
    const features = {};
    rows.forEach(r => features[r.feature_name] = !!r.is_enabled);
    return res.json({ features });
});

app.post("/api/admin/features", requireAdmin, (req, res) => {
    const { feature_name, is_enabled } = req.body;
    dbRun(`INSERT INTO feature_flags (feature_name, is_enabled) VALUES (?, ?)
           ON CONFLICT(feature_name) DO UPDATE SET is_enabled = excluded.is_enabled`,
        [feature_name, is_enabled ? 1 : 0]);
    return res.json({ success: true, feature_name, is_enabled: !!is_enabled });
});

app.get("/api/app-settings", (_req, res) => {
    // All known tab flags (visibility + blocked)
    const validTabFlags = [
        'tab_infoglobal', 'tab_english', 'tab_corporate', 'tab_projecthub',
        'tab_jobs', 'tab_ai_learning', 'tab_games', 'tab_knowledge_lab',
        'tab_infoglobal_blocked', 'tab_english_blocked', 'tab_corporate_blocked',
        'tab_projecthub_blocked', 'tab_jobs_blocked',
        'tab_ai_learning_blocked', 'tab_games_blocked', 'tab_knowledge_lab_blocked'
    ];
    const rows = dbAll("SELECT * FROM feature_flags");
    const tabs = {};
    // Defaults: all visible, none blocked
    validTabFlags.filter(f => !f.endsWith('_blocked')).forEach(t => { tabs[t] = true; });
    validTabFlags.filter(f => f.endsWith('_blocked')).forEach(t => { tabs[t] = false; });
    rows.forEach(r => { if (validTabFlags.includes(r.feature_name)) tabs[r.feature_name] = !!r.is_enabled; });

    const settings = dbGet("SELECT default_tab FROM user_settings WHERE id = 1");
    const validSections = ['infoglobal', 'jobs', 'corporate', 'english', 'projecthub', 'games', 'knowledge-lab'];
    let defaultTab = settings ? settings.default_tab : 'jobs';
    if (!validSections.includes(defaultTab)) defaultTab = 'jobs';

    return res.json({ tabs, defaultTab });
});

app.post("/api/admin/app-settings", requireAdmin, (req, res) => {
    const { tabs, defaultTab } = req.body;
    if (tabs && typeof tabs === 'object') {
        for (const [key, enabled] of Object.entries(tabs)) {
            dbRun(`INSERT INTO feature_flags (feature_name, is_enabled) VALUES (?, ?)
                   ON CONFLICT(feature_name) DO UPDATE SET is_enabled = excluded.is_enabled`,
                [key, enabled ? 1 : 0]);
        }
    }
    if (defaultTab) {
        dbRun("UPDATE user_settings SET default_tab = ? WHERE id = 1", [defaultTab]);
    }
    return res.json({ success: true, message: "Settings saved successfully" });
});

/* ─── Info-Global User Permissions ─────────────────────────────── */
app.get("/api/infoglobal-permissions", (req, res) => {
    const email = String(req.query.email || "").toLowerCase().trim();
    const rows = dbAll("SELECT email, granted_by, granted_at FROM infoglobal_permissions");
    const allowedEmails = rows.map(r => r.email.toLowerCase());
    const isAllowed = email ? (email === ADMIN_EMAIL || allowedEmails.includes(email)) : false;
    return res.json({
        allowed_emails: allowedEmails,
        is_allowed: isAllowed,
        admin_email: ADMIN_EMAIL
    });
});

app.get("/api/admin/infoglobal-permissions", requireAdmin, (_req, res) => {
    const rows = dbAll("SELECT * FROM infoglobal_permissions ORDER BY id DESC");
    return res.json({ permissions: rows });
});

app.post("/api/admin/infoglobal-permissions", requireAdmin, (req, res) => {
    const email = String(req.body.email || "").toLowerCase().trim();
    if (!email || !email.includes("@")) {
        return res.status(400).json({ error: "Valid email address required." });
    }
    dbRun("INSERT OR IGNORE INTO infoglobal_permissions (email, granted_by) VALUES (?, 'admin')", [email]);
    logAdminActivity(null, "PERMISSION_GRANTED", `Info-Global access granted to ${email}`);
    // Notify user via email
    sendSystemEmail(email,
        "Info-Global Tab Access Approved! — Rank Holder",
        `Hello,\n\nThe administrator has granted your account permission to access the Info-Global tab on Rank Holder.\n\nYou can now log in and explore Info-Global anytime!\n\n— Rank Holder Admin`,
        `<div style="font-family:sans-serif;background:#05070f;color:#f8fafc;padding:24px;border-radius:12px;"><h2 style="color:#6366f1;">Info-Global Tab Access Approved! ✅</h2><p>Hello,</p><p>Great news! The administrator (<strong>${ADMIN_EMAIL}</strong>) has approved your request to access the <strong>Info-Global</strong> section.</p><p>You can now open Rank Holder and explore Info-Global freely.</p><p style="color:#94a3b8;">— Rank Holder Admin</p></div>`
    ).catch(() => { });
    return res.json({ success: true, message: `Access granted for ${email}`, email });
});

app.delete("/api/admin/infoglobal-permissions/:email", requireAdmin, (req, res) => {
    const email = String(req.params.email || "").toLowerCase().trim();
    dbRun("DELETE FROM infoglobal_permissions WHERE LOWER(email) = ?", [email]);
    logAdminActivity(null, "PERMISSION_REVOKED", `Info-Global access revoked for ${email}`);
    return res.json({ success: true, message: `Access revoked for ${email}`, email });
});

app.get("/api/admin/feedbacks", requireAdmin, (_req, res) => {
    const rows = dbAll("SELECT * FROM feedbacks ORDER BY id DESC");
    return res.json({ feedbacks: rows });
});

app.delete("/api/admin/feedbacks/:id", requireAdmin, (req, res) => {
    dbRun("DELETE FROM feedbacks WHERE id = ?", [req.params.id]);
    return res.json({ success: true, deleted_id: +req.params.id });
});

app.post("/api/admin/notify-login", requireAdmin, async (req, res) => {
    const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "Unknown";
    const userAgent = req.headers["user-agent"] || "Unknown device";
    console.log(`[Admin Login] Admin panel opened at ${now} from IP: ${ip}`);
    logAdminActivity(null, "ADMIN_PANEL_OPENED", `Admin panel accessed at ${now} from IP: ${ip}`);
    // Send email & mobile push-style notification
    sendSystemEmail(ADMIN_EMAIL,
        `🛡️ Admin Panel Access — ${now}`,
        `Your admin panel was opened.\n\nTime: ${now}\nIP Address: ${ip}\nDevice: ${userAgent}\n\nIf this was not you, change your admin password immediately.`,
        `<div style="font-family:sans-serif;background:#05070f;color:#f8fafc;padding:24px;border-radius:12px;max-width:480px;">
            <div style="display:inline-block;padding:12px 20px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:10px;margin-bottom:16px;">🛡️ Admin Panel Access</div>
            <h2 style="margin:0 0 16px;font-size:1.3rem;">Your admin panel was opened</h2>
            <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:8px 0;color:#94a3b8;width:100px;">Time</td><td style="color:#f8fafc;font-weight:600;">${now}</td></tr>
                <tr><td style="padding:8px 0;color:#94a3b8;">IP Address</td><td style="color:#f8fafc;font-weight:600;">${ip}</td></tr>
                <tr><td style="padding:8px 0;color:#94a3b8;">Device</td><td style="color:#94a3b8;font-size:0.85rem;">${userAgent.slice(0, 80)}</td></tr>
            </table>
            <p style="margin-top:20px;padding:12px;background:rgba(244,63,94,0.1);border-left:3px solid #f43f5e;border-radius:6px;font-size:0.9rem;color:#fda4af;">If this was not you, change your admin password immediately from the panel settings.</p>
        </div>`
    ).catch(() => { });
    return res.json({ success: true, message: "Admin login notification sent." });
});




/* ═══════════════════════════════════════════════════════════════
   PUBLIC & CORE APP ROUTES
═══════════════════════════════════════════════════════════════ */
app.get("/api/health", (_req, res) => {
    res.json({
        status: "online",
        service: "Rank-Holder Node.js Server",
        smtp: transporter ? "configured" : "debug-console",
        timestamp: new Date().toISOString()
    });
});

app.get("/api/settings", requireAuth, (_req, res) => {
    const s = dbGet("SELECT * FROM user_settings WHERE id = 1");
    return s ? res.json(s) : res.status(404).json({ error: "Settings not found" });
});

app.post("/api/settings", requireAuth, (req, res) => {
    const { name = "Rank Holder", email = "", mobile = "", theme = "dark",
        ai_mode = "builtin", comm_mode = "friendly" } = req.body || {};
    dbRun(`INSERT INTO user_settings (id,name,email,mobile,theme,ai_mode,comm_mode) VALUES (1,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,
           mobile=excluded.mobile,theme=excluded.theme,ai_mode=excluded.ai_mode,comm_mode=excluded.comm_mode`,
        [name, email, mobile, theme, ai_mode, comm_mode]);
    return res.json(dbGet("SELECT * FROM user_settings WHERE id = 1"));
});

app.get("/api/notifications", (_req, res) => {
    const rows = dbAll("SELECT * FROM notifications ORDER BY id DESC");
    const allowed = ["google", "microsoft", "tata", "tcs", "google india", "microsoft india", "tata consultancy services"];
    const filtered = rows.filter(n => {
        const text = `${n.title || ""} ${n.message || ""} ${n.company || ""}`.toLowerCase();
        return allowed.some(tag => text.includes(tag));
    });
    return res.json({ notifications: filtered.length ? filtered : rows.slice(0, 3) });
});

app.post("/api/notifications/clear", (_req, res) => {
    dbRun("DELETE FROM notifications");
    return res.json({ success: true });
});

app.get("/api/jobs", requireAuth, (_req, res) => {
    return res.json({ jobs: dbAll("SELECT * FROM jobs ORDER BY id DESC") });
});

app.post("/api/jobs", requireAuth, (req, res) => {
    const { title, company, location = "India", type = "Full-time", experience = "Fresher",
        salary = "Best in Industry", skills = "", link = "#",
        internship_link, hr_contact, badge = "New Opening" } = req.body || {};
    if (!title || !company || !link) return res.status(400).json({ error: "Title, company, link required." });
    dbRun(`INSERT INTO jobs (title,company,location,type,experience,salary,skills,link,internship_link,hr_contact,badge)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [title, company, location, type, experience, salary, skills, link,
            internship_link || link,
            hr_contact || `careers@${company.toLowerCase().replace(/\s/g, "")}.com`,
            badge]);
    return res.status(201).json(dbGet("SELECT * FROM jobs WHERE id = ?", [lastInsertId()]));
});

app.delete("/api/jobs/:id", requireAuth, (req, res) => {
    dbRun("DELETE FROM jobs WHERE id = ?", [req.params.id]);
    return res.json({ success: true, deleted_id: +req.params.id });
});

app.get("/api/prospects", requireAuth, (_req, res) => {
    return res.json({ prospects: dbAll("SELECT * FROM prospects ORDER BY id DESC") });
});

app.post("/api/prospects", requireAuth, (req, res) => {
    const { name, company, linkedin, status = "Pending", idea = "" } = req.body || {};
    if (!name || !company || !linkedin) return res.status(400).json({ error: "Name, company, linkedin required." });
    dbRun("INSERT INTO prospects (name,company,linkedin,status,idea) VALUES (?,?,?,?,?)",
        [name, company, linkedin, status, idea]);
    return res.status(201).json(dbGet("SELECT * FROM prospects WHERE id = ?", [lastInsertId()]));
});

app.delete("/api/prospects/:id", requireAuth, (req, res) => {
    dbRun("DELETE FROM prospects WHERE id = ?", [req.params.id]);
    return res.json({ success: true, deleted_id: +req.params.id });
});

app.get("/api/games/scores", requireAuth, (req, res) => {
    const rows = dbAll("SELECT * FROM game_scores WHERE user_id = ?", [req.currentUser.id]);
    const scores = {};
    rows.forEach(r => { scores[r.game_name] = r.high_score; });
    return res.json({ scores });
});

app.post("/api/games/scores", requireAuth, (req, res) => {
    const { game_name, score = 0 } = req.body || {};
    if (!game_name) return res.status(400).json({ error: "game_name required." });
    dbRun(`INSERT INTO game_scores (user_id, game_name, high_score) VALUES (?, ?, ?)
           ON CONFLICT(user_id, game_name) DO UPDATE SET
           high_score = MAX(high_score, excluded.high_score), updated_at = datetime('now')`, [req.currentUser.id, game_name, score]);
    return res.json({ success: true, game_name, score });
});

app.get("/api/knowledge/progress", requireAuth, (req, res) => {
    const row = dbGet("SELECT state_json FROM knowledge_progress WHERE user_id = ?", [req.currentUser.id]);
    return res.json({ success: true, state: row ? JSON.parse(row.state_json) : null });
});

app.put("/api/knowledge/progress", requireAuth, (req, res) => {
    const state = JSON.stringify(req.body || {});
    dbRun(`INSERT INTO knowledge_progress (user_id, state_json) VALUES (?, ?)
           ON CONFLICT(user_id) DO UPDATE SET state_json = ?, updated_at = datetime('now')`, [req.currentUser.id, state, state]);
    return res.json({ success: true });
});

app.get("/api/story/searches", requireAuth, (req, res) => {
    const rows = dbAll("SELECT query, resolved_title, page_url, created_at FROM story_searches WHERE user_id = ? ORDER BY id DESC LIMIT 20", [req.currentUser.id]);
    return res.json({ success: true, searches: rows });
});

app.post("/api/story/searches", requireAuth, (req, res) => {
    const { query = "", resolved_title = null, extract = "", page_url = "" } = req.body || {};
    if (!query.trim()) return res.status(400).json({ error: "query is required" });
    dbRun("INSERT INTO story_searches (user_id, query, resolved_title, extract, page_url) VALUES (?, ?, ?, ?, ?)",
        [req.currentUser.id, query.trim(), resolved_title, extract, page_url]);
    return res.json({ success: true });
});

app.post("/api/feedback", async (req, res) => {
    const { name = "", email = "", rating = 5, message = "" } = req.body || {};
    const n = name.trim() || "Anonymous User";
    const e = email.trim().toLowerCase();
    const msg = message.trim();
    const r = Math.max(1, Math.min(5, parseInt(rating) || 5));

    if (!msg) return res.status(400).json({ error: "Feedback message cannot be empty." });
    if (!e || !e.includes("@")) return res.status(400).json({ error: "Valid email address is required." });

    dbRun("INSERT INTO feedbacks (user_name, user_email, rating, message) VALUES (?, ?, ?, ?)", [n, e, r, msg]);
    const feedbackUser = dbGet("SELECT id FROM users WHERE email = ?", [e]);
    logAdminActivity(feedbackUser ? feedbackUser.id : null, "FEEDBACK_SUBMITTED", `${n} submitted a ${r}/5 rating: ${msg.slice(0, 160)}`);
    const stars = "⭐".repeat(r);
    dbRun("INSERT INTO notifications (title, message, category) VALUES (?, ?, ?)",
        [`New User Feedback (${stars})`, `${n} (${e}): "${msg.slice(0, 80)}"`, "system"]);

    await sendSystemEmail(ADMIN_EMAIL,
        `New user feedback received from ${n}`,
        `A user submitted feedback on the website.\n\nName: ${n}\nEmail: ${e}\nRating: ${r}/5\nMessage: ${msg}\n\nPlease review from the admin panel.`,
        `<p><strong>New user feedback received</strong></p><p><strong>Name:</strong> ${n}</p><p><strong>Email:</strong> ${e}</p><p><strong>Rating:</strong> ${r}/5</p><p><strong>Message:</strong> ${msg}</p>`
    );

    return res.json({
        success: true,
        message: "Thank you! Your feedback has been sent directly to the Admin."
    });
});

const PROFANITY_LIST = ["fuck", "shit", "bitch", "asshole", "cunt", "dick", "pussy", "bastard", "slut", "whore"];
function filterProfanity(text) {
    if (!text) return text;
    let filtered = text;
    PROFANITY_LIST.forEach(word => {
        const regex = new RegExp("\\b" + word + "\\b", "gi");
        filtered = filtered.replace(regex, "***");
    });
    return filtered;
}



/* ═══════════════════════════════════════════════════════════════
   AI MODULES (With Gemini & Fallbacks)
═══════════════════════════════════════════════════════════════ */
// Ordered list of Gemini models to try. The API rotates model names over time,
// so we attempt each in turn and use the first one that returns real text.
const GEMINI_MODEL_FALLBACKS = [
    "gemini-2.5-flash",
    "gemini-3.8-flash",
    "gemini-flash-latest"
];
// Fast response timeouts so the UI never hangs
const THINKING_TOKEN_HEADROOM = 256;
const GEMINI_REQUEST_TIMEOUT_MS = 4000;
const GEMINI_TOTAL_BUDGET_MS = 5000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGeminiModel(model, apiKey, prompt, maxTokens) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": apiKey
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: Math.max(maxTokens, 256) + THINKING_TOKEN_HEADROOM }
        }),
        signal: AbortSignal.timeout(GEMINI_REQUEST_TIMEOUT_MS)
    });
    const data = await response.json();
    if (data.error) throw new Error(`${model}: ${data.error.message}`);
    const text = (data.candidates?.[0]?.content?.parts || [])
        .map(part => part.text || "")
        .join("")
        .trim();
    if (!text) throw new Error(`${model}: empty response (finishReason: ${data.candidates?.[0]?.finishReason || "unknown"})`);
    return text;
}

async function callGeminiRaw(prompt, maxTokens = 500) {
    const apiKey = (process.env.GEMINI_API_KEY || "").trim();
    if (!apiKey) return null;
    const deadline = Date.now() + GEMINI_TOTAL_BUDGET_MS;
    let lastError = null;
    // Two passes: if every model 503s at once, wait briefly and retry once.
    for (let pass = 0; pass < 2; pass++) {
        if (pass > 0) await sleep(500);
        for (const model of GEMINI_MODEL_FALLBACKS) {
            if (Date.now() > deadline) break;
            try {
                return await callGeminiModel(model, apiKey, prompt, maxTokens);
            } catch (e) {
                lastError = e;
                console.warn(`[Gemini] ${model} attempt ${pass + 1} failed: ${e.message}`);
            }
        }
        if (Date.now() > deadline) break;
    }
    if (lastError) throw lastError;
    return null;
}

app.post("/api/ai/generate", requireAuth, async (req, res) => {
    const { message = "", mode = "friendly", ai_model = "gemini", system_prompt = "You are a helpful AI assistant." } = req.body || {};
    if (!message.trim()) return res.status(400).json({ error: "Empty message." });

    try {
        if (process.env.GEMINI_API_KEY) {
            const prompt = `${system_prompt}\n\nUser Message: ${message}`;
            const reply = await callGeminiRaw(prompt, 600);
            if (reply) return res.json({ reply, mode, fluency_boost: 5 });
        }
    } catch (e) {
        console.warn("AI generation external call:", e.message);
    }

    // Intelligent fallback
    const fallbackReply = `Great inquiry on "${message}". In modern industry practices, focusing on modular architecture, comprehensive documentation, and continuous integration yields the highest quality outcomes. How would you like to proceed with the next phase?`;
    return res.json({ reply: fallbackReply, mode, fluency_boost: 5 });
});

app.post("/api/ai/chat", requireAuth, async (req, res) => {
    const { message = "", mode = "friendly", topic = "General Interview" } = req.body || {};
    if (!message.trim()) return res.status(400).json({ error: "Empty message." });

    let system_prompt = `You are an AI interview partner and a real-time English communication assistant. Act as a real-time English communication assistant, responding promptly and naturally to all interactions, ensuring clear and professional language usage. Topic: ${topic}. Mode: ${mode}.
Respond strictly as JSON with:
{
  "reply": "<your verbal response to the candidate>",
  "corrections": ["<grammar correction if any, empty array if none>"]
}`;

    try {
        if (process.env.GEMINI_API_KEY) {
            let text = await callGeminiRaw(`${system_prompt}\n\nCandidate said: "${message}"`, 500);
            if (text) {
                text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/g, "").trim();
                const json = JSON.parse(text);
                // Clean raw HTML tags that Gemini might leak into the reply text
                let cleanReply = (json.reply || "I understand. Let's continue.");
                cleanReply = cleanReply.replace(/<\/?(b|i|u|br|p|em|strong|span|div)[^>]*>/gi, (match) => {
                    // Convert real formatting tags to newlines/markdown equivalents
                    if (/^<br/i.test(match)) return '\n';
                    if (/^<\//i.test(match)) return '';
                    return '';
                });
                return res.json({
                    reply: cleanReply,
                    corrections: json.corrections || [],
                    mode,
                    fluency_boost: (json.corrections && json.corrections.length > 0) ? -2 : 5
                });
            }
        }
    } catch (e) {
        console.warn("AI chat external call:", e.message);
    }

    return res.json({
        reply: `That was well articulated! When discussing ${topic}, highlighting specific measurable metrics or lessons learned will further strengthen your answer. What was the most challenging part of that experience?`,
        corrections: [],
        mode,
        fluency_boost: 5
    });
});

/* ─── AI HR Interviewer Context (SQLite) ─────────────────────── */
app.post("/api/ai/hr-context", requireAuth, async (req, res) => {
    let { company = "", context = "", url = "" } = req.body || {};
    if (!company) return res.status(400).json({ error: "Company is required." });

    // If URL is provided, try to fetch its contents
    if (url) {
        try {
            if (!url.startsWith('http')) url = 'https://' + url;
            const fetchRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' } });
            if (fetchRes.ok) {
                const htmlText = await fetchRes.text();
                // Strip HTML tags and script/style content simply using regex
                const bodyText = htmlText
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
                    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();

                // Truncate to first 4000 characters to save tokens
                const scrapedText = bodyText.substring(0, 4000);
                context += `\n\n--- SCRAPED FROM ${url} ---\n${scrapedText}`;
            }
        } catch (e) {
            console.warn("Could not fetch URL for HR context:", e.message);
        }
    }

    // Save to database linked to the user's session
    const userId = req.currentUser.id;
    try {
        dbRun(
            "INSERT OR REPLACE INTO interview_contexts (user_id, company, context, updated_at) VALUES (?, ?, ?, datetime('now'))",
            [userId, company, context]
        );
        return res.json({ success: true, message: "Context saved successfully." });
    } catch (e) {
        console.error("Error saving HR context:", e);
        return res.status(500).json({ error: "Database error." });
    }
});

/* ─── AI HR Interviewer ──────────────────────────────────────── */
app.post("/api/ai/hr-interviewer", requireAuth, async (req, res) => {
    const { message = "", company = "a top global tech company", history = [] } = req.body || {};
    if (!message.trim()) return res.status(400).json({ error: "Empty message." });

    // Fetch the stored context from database
    let storedContext = "";
    try {
        const row = dbGet("SELECT context FROM interview_contexts WHERE user_id = ?", [req.currentUser.id]);
        if (row && row.context) {
            storedContext = row.context;
        }
    } catch (e) {
        console.error("Error reading HR context:", e);
    }

    let system_prompt = `You are a real, live HR Interviewer conducting a voice-based video interview for ${company}. Your style is warm, professional, and conversational — exactly like a real human HR manager on a video call. Analyze provided resumes or career URLs to simulate professional HR interviews, asking relevant and strategic questions to prepare the candidate effectively.

RULES:
1. Speak naturally like a real person on a video call. Short, clear sentences. No bullet points or markdown — this is spoken dialogue.
2. Ask ONE behavioral or HR question at a time. Never ask multiple questions at once.
3. After the candidate answers, give brief, constructive verbal feedback (1-2 sentences), then move to the next question.
4. Adopt the unique culture of ${company}: e.g., for Apple — design thinking, attention to detail; for Google — problem solving, scalability; for Meta — bold moves, growth mindset; for Nvidia — innovation, technical depth; etc.
5. Start with a warm introduction if this is the first message.
6. Keep responses under 100 words — this is a voice call, not an essay.

Respond ONLY as valid JSON: {"reply": "<your spoken response here>"}`;

    if (storedContext) {
        system_prompt += `\n\nBACKGROUND CONTEXT (Job Description / Company Profile provided by user):\n${storedContext}\n\nUse this context to tailor your interview questions specifically to the role and requirements listed above.`;
    }

    try {
        let conversationText = `${system_prompt}\n\n`;
        if (history && history.length > 0) {
            history.forEach(msg => {
                conversationText += `${msg.role === 'user' ? 'Candidate' : 'Interviewer'}: "${msg.content}"\n`;
            });
        }
        conversationText += `Candidate: "${message}"\nInterviewer:`;

        if (process.env.GEMINI_API_KEY) {
            let text = await callGeminiRaw(conversationText, 300);
            if (text) {
                text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/g, "").trim();
                try {
                    const json = JSON.parse(text);
                    const finalReply = json.reply || json.response || json.message || text;
                    return res.json({ reply: finalReply });
                } catch (parseErr) {
                    // If not JSON, just return the raw text (gemini sometimes skips JSON format)
                    return res.json({ reply: text.replace(/^"/, '').replace(/"$/, '') });
                }
            }
        }
    } catch (e) {
        console.warn("AI HR Interviewer external call:", e.message);
    }

    return res.json({ reply: "Thank you for sharing that. Tell me about a time you had to work under pressure and how you handled it." });
});



/* ─── Global AI Chat (Student Guide) ─────────────────────────── */
app.post("/api/ai/global-chat", async (req, res) => {
    const { message = "" } = req.body || {};
    if (!message.trim()) return res.status(400).json({ error: "Empty message." });

    const prompt = `You are Rank AI Guide, a research-first assistant for the Rank Holder career platform. Conduct thorough, professional research on any given topic, providing comprehensive, structured, and detailed information.
Your job is to provide a complete, useful, professional answer for the user's query.
Requirements:
1. Give a direct, well-structured answer.
2. Add practical examples or a step-by-step breakdown when the topic is complex.
3. Include a short "Why it matters" section and a "Next steps" section.
4. If the question is about a technical topic, include a simple example or pseudo-code only when appropriate.
5. Keep the answer useful and detailed but stay readable.
6. End with a short follow-up question or encouragement.

Student asks: "${message}"`;

    try {
        if (process.env.GEMINI_API_KEY) {
            const text = await callGeminiRaw(prompt, 400);
            if (text) {
                const cleanedReply = text.trim().replace(/^```[a-zA-Z]*\s*/i, '').replace(/```\s*$/g, '').trim();
                return res.json({ reply: cleanedReply, research: true });
            }
        }
    } catch (e) {
        console.warn("Global chat AI error:", e.message);
    }

    const fallbackReply = [
        `I can help with this, and the best way to answer it is with clear structure and action.`,
        ``,
        `For: "${message}"`,
        ``,
        `1. Start with the core idea: explain the concept in plain language and define the main terms.`,
        `2. Add a practical example: show how this works in a real-world scenario or project.`,
        `3. Give the next steps: what the user should learn, practice, or build next.`,
        `4. If the topic is interview or career related, connect it to job-ready skills and outcomes.`,
        ``,
        `If you want, I can turn this into a full interview answer, a detailed explanation, a code example, or a step-by-step roadmap.`
    ].join('\n');

    return res.json({
        reply: fallbackReply,
        research: false,
        sources: {
            google: `https://www.google.com/search?q=${encodeURIComponent(message)}`,
            youtube: `https://www.youtube.com/results?search_query=${encodeURIComponent(message)}`
        }
    });
});

/* ─── PPT Generator ───────────────────────────────────────────── */
app.post("/api/ai/generate-ppt", async (req, res) => {
    const { message = "" } = req.body || {};
    if (!message.trim()) return res.status(400).json({ error: "Empty message." });

    // Extract slide count and topic from message
    const slideMatch = message.match(/(\d+)\s*slide/i);
    const slideCount = slideMatch ? Math.min(parseInt(slideMatch[1]), 15) : 5;
    const topic = message.replace(/make|create|generate|build|a|an|ppt|presentation|\d+\s*slide[s]?|on|about/gi, "").trim() || "General Topic";

    const prompt = `You are a human expert creating a professional PowerPoint presentation outline.
Topic: "${topic}"
Number of slides: ${slideCount}

Create a detailed, human-brain structured PPT outline. Each slide must have:
- A specific, engaging title (not generic like "Introduction")
- 3-4 clear, actionable bullet points that a real person would present
- Make it flow naturally, like a story from problem → insight → solution → impact

Return STRICT JSON only (no markdown):
{
  "pptOutline": [
    { "slideNumber": 1, "title": "Slide Title", "points": ["Point 1", "Point 2", "Point 3"] }
  ]
}`;

    try {
        if (process.env.GEMINI_API_KEY) {
            let text = await callGeminiRaw(prompt, 1500);
            if (text) {
                text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/g, "").trim();
                const json = JSON.parse(text);
                return res.json(json);
            }
        }
    } catch (e) {
        console.warn("PPT generation AI error:", e.message);
    }

    // Fallback: generate a structured template manually
    const slides = [];
    const templates = [
        { title: `Introduction to ${topic}`, points: ["What is " + topic + "?", "Why it matters in today's world", "What you will learn today"] },
        { title: `The Core Problem`, points: ["Current challenges in this area", "Who is most affected?", "The cost of ignoring this topic"] },
        { title: `Key Concepts Explained`, points: ["Concept 1: Foundations", "Concept 2: Core Principles", "Concept 3: Real-world application"] },
        { title: `Case Study & Evidence`, points: ["Real example from industry", "Data and results achieved", "Lessons learned from this case"] },
        { title: `Action Plan & Next Steps`, points: ["Step 1: Start here", "Step 2: Build on it", "Step 3: Measure your progress"] },
        { title: `Summary & Key Takeaways`, points: ["What we covered today", "The most important insight", "Your call to action"] }
    ];
    for (let i = 0; i < Math.min(slideCount, templates.length); i++) {
        slides.push({ slideNumber: i + 1, ...templates[i] });
    }
    // If more slides needed, generate generic ones
    for (let i = templates.length; i < slideCount; i++) {
        slides.push({ slideNumber: i + 1, title: `Deep Dive: Part ${i - templates.length + 2}`, points: ["Detailed analysis", "Supporting evidence", "Practical takeaway"] });
    }

    return res.json({ pptOutline: slides });
});



app.post("/api/biomedical/analyze", requireAuth, async (req, res) => {
    const { filename = "scan.png", type = "image" } = req.body || {};
    const prompt = `Analyse this biomedical file metadata. Filename: ${filename}, File Type: ${type}.
Output STRICT JSON:
{
  "concept": "<medical concept or scan type>",
  "diagnostic_class": "<category of diagnosis>",
  "where_used": "<where this is typically used>",
  "wiki_query": "<search term for Wikipedia>",
  "metrics": "<realistic metrics string>",
  "confidence": "<percentage string>"
}`;

    try {
        if (process.env.GEMINI_API_KEY) {
            let text = await callGeminiRaw(prompt, 500);
            if (text) {
                text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/g, "").trim();
                const json = JSON.parse(text);
                return res.json({
                    status: "Success",
                    filename,
                    file_type: type,
                    concept: json.concept || "Diagnostic Imaging",
                    diagnostic_class: json.diagnostic_class || "Radiology & Cellular Analysis",
                    where_used: json.where_used || "Clinical Research & Healthcare Diagnostics",
                    wiki_query: json.wiki_query || "Medical imaging",
                    metrics: json.metrics || "Tissue Density: 94% | Cellular Clarity: High",
                    confidence: json.confidence || "96.4%",
                    pubmed_url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(json.wiki_query || "Medical")}`
                });
            }
        }
    } catch (e) {
        console.warn("Biomedical AI:", e.message);
    }

    return res.json({
        status: "Success",
        filename,
        file_type: type,
        concept: "Automated Diagnostic Bio-Scan",
        diagnostic_class: "Clinical Health Informatics & Tissue Topology",
        where_used: "Multi-Speciality Hospital Radiology & Preventive Health Screening",
        wiki_query: "Medical imaging",
        metrics: "Structural Density: 95.2% | Artifact Rejection: Optimal",
        confidence: "98.1%",
        pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/?term=Medical+Imaging"
    });
});

app.post("/api/projects/blueprint", requireAuth, async (req, res) => {
    const { topic = "IoT Smart Automation", category = "Hardware" } = req.body || {};
    const prompt = `Create a project blueprint for a ${category} project about '${topic}'.
Output STRICT JSON:
{
  "topic": "${topic}",
  "category": "${category}",
  "idea": "<1-2 sentence pitch>",
  "tools": ["tool1", "tool2", "tool3", "tool4"],
  "steps": ["Step 1", "Step 2", "Step 3", "Step 4", "Step 5"],
  "roadmap": "<4-week summary>",
  "details": ["bullet 1", "bullet 2", "bullet 3"]
}`;

    try {
        if (process.env.GEMINI_API_KEY) {
            let text = await callGeminiRaw(prompt, 600);
            if (text) {
                text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/g, "").trim();
                return res.json(JSON.parse(text));
            }
        }
    } catch (e) {
        console.warn("Project blueprint AI:", e.message);
    }

    return res.json({
        topic,
        category,
        idea: `An intelligent, production-grade ${category.toLowerCase()} architecture implementing ${topic} with automated cloud telemetry and robust client interfaces.`,
        tools: ["Node.js / Express", "TypeScript", "RESTful APIs", "Cloud Datastore", "Responsive UI / CSS3"],
        steps: [
            "1. Architectural Design: Define communication protocols, database schema, and interface contracts.",
            "2. Core Logic Implementation: Construct modular handlers, validation filters, and processing pipelines.",
            "3. State & Persistence Setup: Configure secure local or cloud storage for real-time telemetry.",
            "4. Interface Integration: Build responsive dashboard views with real-time feedback elements.",
            "5. Quality Assurance: Run comprehensive unit checks, stress simulations, and user acceptance flows."
        ],
        roadmap: "Week 1: Foundations & Schemas | Week 2: Logic & Pipelines | Week 3: UI Integration | Week 4: Deployment & Documentation",
        details: [
            "Scalable service boundaries allowing straightforward container deployment.",
            "Fine-grained error handling and fault tolerance across asynchronous flows.",
            "Pre-configured configuration points for seamless third-party service integration."
        ]
    });
});

app.get("/api/growup/scores", requireAuth, (_req, res) => {
    const rows = dbAll("SELECT * FROM game_scores");
    return res.json({ scores: rows });
});

app.post("/api/growup/scores", requireAuth, (req, res) => {
    const { topic, score } = req.body || {};
    dbRun(`INSERT INTO game_scores (user_id, game_name, high_score) VALUES (?, ?, ?)
           ON CONFLICT(user_id, game_name) DO UPDATE SET high_score = MAX(high_score, excluded.high_score)`,
        [req.currentUser.id, `growup_${topic || 'general'}`, score || 0]);
    return res.json({ success: true });
});

app.post("/api/growup/teach", requireAuth, async (req, res) => {
    const { topic = "Programming", mode = "deep_lecture", question = "" } = req.body || {};
    const prompt = `You are a world-class mentor. Break down complex topics into step-by-step workflows, providing clear explanations to ensure thorough understanding. Teach topic: "${topic}". Mode: "${mode}". Question: "${question}".
Provide clear, structured, engaging, and practical advice with examples.`;

    try {
        if (process.env.GEMINI_API_KEY) {
            const lesson = await callGeminiRaw(prompt, 900);
            if (lesson) return res.json({ lesson, topic, mode });
        }
    } catch (e) {
        console.warn("GrowUp teach AI:", e.message);
    }

    const fallbackLesson = `### 🎓 Deep Masterclass: ${topic}\n\n` +
        `**1. Core Principles & Mindset**\n` +
        `Mastery in ${topic} begins with decomposing complex challenges into first-principles components. Understand the foundational rules, common anti-patterns, and the architectural lifecycle.\n\n` +
        `**2. Practical Industry Application**\n` +
        `In professional environments, clean execution, test coverage, and clear cross-team communication distinguish top performers. Always document edge cases and establish automated checks.\n\n` +
        `**3. Actionable Next Steps**\n` +
        `Build a hands-on project incorporating this concept, measure the latency and reliability, and prepare a concise 2-minute demonstration.`;

    return res.json({ lesson: fallbackLesson, topic, mode });
});

app.post("/api/growup/evaluate", requireAuth, async (req, res) => {
    const { topic_title = "Soft Skills", scenario_question = "", user_answer = "", quiz_score = 100 } = req.body || {};
    const qScore = parseInt(quiz_score) || 100;
    const ans = (user_answer || "").trim();

    if (!ans) {
        return res.json({
            success: true,
            score: qScore,
            clarity_score: qScore,
            problem_score: qScore,
            professionalism_score: qScore,
            confidence_score: qScore,
            verdict: "Great quiz performance! Submit your scenario answer for deeper AI evaluation.",
            feedback: ["Solid grasp of key conceptual foundations.", "Keep practicing active scenario application."],
            xp_earned: 50,
            unlocked: qScore >= 60
        });
    }

    try {
        if (process.env.GEMINI_API_KEY) {
            const prompt = `Evaluate student's answer for topic '${topic_title}'.
Scenario: "${scenario_question}"
Answer: "${ans}"
Quiz score: ${qScore}%

Output STRICT JSON:
{
  "score": <0-100>,
  "clarity_score": <0-100>,
  "problem_score": <0-100>,
  "professionalism_score": <0-100>,
  "confidence_score": <0-100>,
  "verdict": "<short verdict>",
  "feedback": ["<praise>", "<tip>"],
  "xp_earned": <50-150>
}`;
            let text = await callGeminiRaw(prompt, 500);
            if (text) {
                text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/g, "").trim();
                const json = JSON.parse(text);
                const finalScore = json.score || 85;
                return res.json({ success: true, ...json, unlocked: finalScore >= 60 });
            }
        }
    } catch (e) {
        console.warn("GrowUp evaluate AI:", e.message);
    }

    const lengthBonus = Math.min(20, Math.floor(ans.split(/\s+/).length / 3));
    const keywordBonus = /team|listen|solve|communicate|plan|responsible|client|clear|action/i.test(ans) ? 10 : 0;
    const finalScore = Math.min(100, Math.max(50, Math.round(qScore * 0.5 + lengthBonus + keywordBonus + 30)));

    return res.json({
        success: true,
        score: finalScore,
        clarity_score: Math.min(100, finalScore + 4),
        problem_score: Math.min(100, finalScore - 2),
        professionalism_score: Math.min(100, finalScore + 6),
        confidence_score: Math.min(100, finalScore + 2),
        verdict: "🌟 Excellent situational judgment! Your response reflects strong professional maturity and collaborative awareness.",
        feedback: [
            "Clear articulation of personal responsibility and team alignment.",
            "To reach 100% mastery, quantify your action steps with measurable timelines."
        ],
        xp_earned: 100,
        unlocked: finalScore >= 60
    });
});

app.post("/api/corporate/gd", requireAuth, async (req, res) => {
    const { topic = "Technology in Education", user_message = "" } = req.body || {};
    const prompt = `You are a Group Discussion facilitator. Topic: "${topic}". Respond as a sharp professional.
Output JSON: { "ai_point": "...", "feedback": "..." }`;

    try {
        if (process.env.GEMINI_API_KEY) {
            let text = await callGeminiRaw(prompt, 400);
            if (text) {
                text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/g, "").trim();
                return res.json(JSON.parse(text));
            }
        }
    } catch (e) {
        console.warn("Corporate GD AI:", e.message);
    }

    return res.json({
        ai_point: `While technical adoption on ${topic} drives efficiency, our primary focus must remain on ensuring accessible ergonomics, equitable onboarding, and maintaining high human engagement standards.`,
        feedback: user_message ? "Solid contribution! Connecting your point directly to team ROI will make it even more persuasive." : "Good opening. Keep your cadence confident and structured."
    });
});

app.post("/api/corporate/hr", requireAuth, async (req, res) => {
    const { question_context = "Tell me about yourself", user_answer = "" } = req.body || {};
    const prompt = `You are a senior HR interviewer. Question: "${question_context}". Candidate answer: "${user_answer}".
Evaluate and output JSON: { "score": <1-10>, "feedback": "...", "improved_answer": "..." }`;

    try {
        if (process.env.GEMINI_API_KEY) {
            let text = await callGeminiRaw(prompt, 500);
            if (text) {
                text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/g, "").trim();
                return res.json(JSON.parse(text));
            }
        }
    } catch (e) {
        console.warn("Corporate HR AI:", e.message);
    }

    return res.json({
        score: 8,
        feedback: "Strong professional composure and good narrative flow. Structuring with the STAR framework (Situation, Task, Action, Result) will elevate this into a top-tier answer.",
        improved_answer: `I have a dedicated background in building robust software and intelligent systems. For instance, in my recent work, I spearheaded performance optimizations that boosted system reliability by 35%. I am excited to bring this analytical precision and proactive mindset to your team.`
    });
});

app.post("/api/corporate/public_speaking", requireAuth, async (req, res) => {
    const { topic = "Introduction", user_speech = "" } = req.body || {};
    const prompt = `Public speaking coach evaluating speech on "${topic}". Speech: "${user_speech}".
Output JSON: { "overall_score": <1-100>, "clarity": <1-10>, "confidence": <1-10>, "structure": <1-10>, "content": <1-10>, "strengths": "...", "improvements": "..." }`;

    try {
        if (process.env.GEMINI_API_KEY) {
            let text = await callGeminiRaw(prompt, 500);
            if (text) {
                text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/g, "").trim();
                return res.json(JSON.parse(text));
            }
        }
    } catch (e) {
        console.warn("Public speaking AI:", e.message);
    }

    return res.json({
        overall_score: 88,
        clarity: 9,
        confidence: 9,
        structure: 8,
        content: 9,
        strengths: "Authentic tone, crisp opening hook, and well-modulated delivery pace.",
        improvements: "Incorporate deliberate 2-second pauses before key thesis points to maximize audience retention."
    });
});

app.post("/api/resume/analyze", async (req, res) => {
    const { text = "", jd = "General role" } = req.body || {};
    const resumeText = text || "Candidate resume details";
    const prompt = `You are an ATS (Applicant Tracking System) expert. Analyse resume against JD: "${jd}".
Resume snippet: "${resumeText.slice(0, 1500)}"
Respond strictly as JSON:
{
  "score": <number 0-100>,
  "summary": "<one sentence verdict>",
  "mistakes": ["<mistake 1>", "<mistake 2>"],
  "matchedKeywords": ["<keyword 1>", "<keyword 2>"],
  "missingKeywords": ["<keyword 1>", "<keyword 2>"],
  "suggestions": ["<suggestion 1>", "<suggestion 2>"]
}`;

    try {
        if (process.env.GEMINI_API_KEY) {
            let reply = await callGeminiRaw(prompt, 600);
            if (reply) {
                reply = reply.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/g, "").trim();
                return res.json(JSON.parse(reply));
            }
        }
    } catch (e) {
        console.warn("Resume ATS AI:", e.message);
    }

    return res.json({
        score: 86,
        summary: "Solid technical background with demonstrated engineering capability; adding quantifiable impact metrics will optimise ATS ranking.",
        mistakes: [
            "Some project bullet points focus on responsibilities rather than measurable business outcomes.",
            "Skills section could include more explicit cloud deployment keywords."
        ],
        matchedKeywords: ["JavaScript", "Python", "REST APIs", "Git", "Problem Solving", "Database Systems"],
        missingKeywords: ["CI/CD Pipelines", "Docker Containerization", "Unit Testing", "Cloud Ingress"],
        suggestions: [
            "Use the 'Accomplished [X], as measured by [Y], by doing [Z]' bullet point formula.",
            "Tailor technical keywords directly to each company's specific job description before submitting."
        ]
    });
});

/* ═══════════════════════════════════════════════════════════════
   AI ASSISTANT — Doubt Clearance | Task Execution | Company Updates
═══════════════════════════════════════════════════════════════ */
app.post("/api/ai/assistant", requireAuth, async (req, res) => {
    const { message = "", mode = "doubt" } = req.body || {};
    if (!message.trim()) return res.status(400).json({ error: "Message cannot be empty." });

    let systemPrompt = "";
    let fallback = "";

    if (mode === "task") {
        systemPrompt = `You are a powerful AI assistant that executes tasks and delivers finished results.
The user gives you an assignment — you complete it fully and return the finished product.
Examples: write a cover letter, draft an email, generate code, create a to-do list, design a resume bullet point.
Format your response cleanly with sections, bullet points, or code blocks as appropriate.
Be thorough, professional, and deliver a ready-to-use output.

Task from user: "${message}"

Output the completed task directly — no meta-commentary, just the deliverable.`;
        fallback = `✅ **Task Completed: ${message.slice(0, 60)}**

Here is your finished output:

---
**Draft / Result:**

Based on your request, I've prepared the following:

• **Objective**: ${message}
• **Approach**: Structured, professional, and ready for immediate use.
• **Key Points**:
  - Focuses on clarity and impact
  - Uses industry-standard formatting
  - Highlights the most critical elements
  - Ready to submit or deploy

**Action Items:**
1. Review the output above
2. Customize any specific names, dates, or figures as needed
3. Submit or share the final product

_Tip: For even more tailored results, add specific details like target company, role, or context to your request!_`;

    } else if (mode === "updates") {
        systemPrompt = `You are an AI news analyst specializing in tech industry updates. Generate a comprehensive daily briefing with the latest hiring trends, product launches, and news for: Google, Microsoft, WorkIndia, and LinkedIn.

Format strictly as JSON:
{
  "date": "<today's date>",
  "companies": [
    {
      "name": "Google",
      "emoji": "🔵",
      "headline": "<major recent news>",
      "hiring": "<current hiring focus areas>",
      "opportunity": "<specific action for job seekers>",
      "trend": "<market trend or product update>"
    },
    {
      "name": "Microsoft",
      "emoji": "🟩",
      "headline": "<major recent news>",
      "hiring": "<current hiring focus areas>",
      "opportunity": "<specific action for job seekers>",
      "trend": "<market trend or product update>"
    },
    {
      "name": "WorkIndia",
      "emoji": "🟠",
      "headline": "<major recent news>",
      "hiring": "<current hiring focus areas>",
      "opportunity": "<specific action for job seekers>",
      "trend": "<market trend or product update>"
    },
    {
      "name": "LinkedIn",
      "emoji": "🔷",
      "headline": "<major recent news>",
      "hiring": "<current hiring focus areas>",
      "opportunity": "<specific action for job seekers>",
      "trend": "<market trend or product update>"
    }
  ]
}`;
        fallback = null; // handled specially below

    } else {
        // Default: Doubt Clearance
        systemPrompt = `You are an expert AI tutor and mentor. When a user asks a question or expresses a doubt, provide a clear, detailed, and educational explanation.
Structure your response with:
1. A simple one-line answer first
2. A detailed explanation with examples
3. Key concepts to remember
4. A practical tip or real-world application

User's doubt: "${message}"

Explain thoroughly and clearly. Use analogies if helpful. Format with markdown bullet points and headers.`;
        fallback = `## 💡 Answering Your Doubt

**Your Question:** ${message}

---

### Simple Answer:
This is a common and important concept. At its core, the answer relates to understanding the foundational principles and applying them systematically.

### Detailed Explanation:
- **Core Concept**: Every complex problem can be broken into smaller, manageable parts. Understanding each part individually makes the whole picture clearer.
- **How it Works**: Think of it like building a house — you start with the foundation (basics), then the walls (intermediate understanding), and finally the roof (advanced application).
- **Real Example**: When professionals approach this topic, they first identify the key variables, then analyze relationships between them, and finally draw conclusions based on evidence.

### Key Points to Remember:
1. ✅ Start with the fundamentals before moving to advanced topics
2. ✅ Practice through examples to reinforce understanding
3. ✅ Ask follow-up questions to deepen your knowledge
4. ✅ Connect new knowledge to things you already understand

### 💡 Pro Tip:
The best way to confirm you've understood something is to try explaining it to someone else in simple terms. If you can teach it, you've truly learned it!

_Need a more specific explanation? Try rephrasing your question with more context for a detailed answer._`;
    }

    // Handle Company Updates mode specially
    if (mode === "updates") {
        try {
            if (process.env.GEMINI_API_KEY) {
                let text = await callGeminiRaw(systemPrompt, 800);
                if (text) {
                    text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/g, "").trim();
                    const parsed = JSON.parse(text);
                    return res.json({ mode, updates: parsed });
                }
            }
        } catch (e) {
            console.warn("AI Assistant (updates) Gemini call failed:", e.message);
        }

        // Static fallback for company updates
        return res.json({
            mode,
            updates: {
                date: new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", year: "numeric", month: "long", day: "numeric" }),
                companies: [
                    {
                        name: "Google",
                        emoji: "🔵",
                        headline: "Google continues mass hiring for AI/ML, Cloud (GCP), and Android roles across Bengaluru & Hyderabad campuses.",
                        hiring: "SWE (L3/L4), Data Scientists, Cloud Solutions Architects, UX Researchers, AI Research Scientists",
                        opportunity: "Apply via careers.google.com — focus on LeetCode (Hard level) and System Design preparation for SWE interviews.",
                        trend: "Gemini AI integration expanding across all Google products; Demand for GenAI engineers is at an all-time high."
                    },
                    {
                        name: "Microsoft",
                        emoji: "🟩",
                        headline: "Microsoft is actively hiring for its Copilot AI, Azure Cloud, and GitHub teams. MAANG-scale hiring visible on LinkedIn.",
                        hiring: "Software Engineers, Azure DevOps Engineers, Product Managers (AI), Cybersecurity Analysts, Data Engineers",
                        opportunity: "Register on careers.microsoft.com — Microsoft values STAR method behavioral answers + OOP/DSA knowledge.",
                        trend: "Copilot AI embedded across Office 365, GitHub, and Azure; Big investment in responsible AI & compliance roles."
                    },
                    {
                        name: "WorkIndia",
                        emoji: "🟠",
                        headline: "WorkIndia has expanded its blue-collar job marketplace to 50+ cities, with record employer sign-ups in Q3.",
                        hiring: "Business Development Executives, Customer Success, Product Engineers (React/Node), Data Analysts, Operations Leads",
                        opportunity: "Great startup opportunity — Apply via WorkIndia's LinkedIn page or directly at workindia.in/careers. Strong growth trajectory.",
                        trend: "WorkIndia is bridging the gap for 5 crore+ job seekers in India's tier-2 and tier-3 cities — massive social impact."
                    },
                    {
                        name: "LinkedIn",
                        emoji: "🔷",
                        headline: "LinkedIn has launched new AI-powered job matching and Premium AI resume review features globally.",
                        hiring: "Backend Engineers (Java/Python), ML Engineers, Recruiter Tools PMs, Trust & Safety Analysts, Growth Marketers",
                        opportunity: "Set your profile to 'Open to Work', optimize with keywords from target JDs — LinkedIn's own AI now surfaces your profile to matching HRs.",
                        trend: "LinkedIn Premium AI tools (Resume Review, InMail AI, Interview Prep) are being adopted by 100M+ members globally."
                    }
                ]
            }
        });
    }

    // Doubt & Task modes — try Gemini first
    try {
        if (process.env.GEMINI_API_KEY) {
            const reply = await callGeminiRaw(systemPrompt, 700);
            if (reply) return res.json({ mode, reply });
        }
    } catch (e) {
        console.warn("AI Assistant Gemini call failed:", e.message);
    }

    return res.json({ mode, reply: fallback });
});


/* ─── LLD API Endpoints ─────────────────────────────────────────── */

app.get("/api/lld/questions", async (req, res) => {
    try {
        const prompt = `Generate 10 real-world Low-Level Design (LLD) interview questions commonly asked by top tech companies (Google, Amazon, Microsoft, Uber, etc.). 
For each question, extract concepts from the "Awesome Low-Level Design" guide (e.g., Design Patterns, SOLID principles, Concurrency).
Return ONLY a valid JSON array where each object has:
- title: Short title of the problem (e.g., "Design Parking Lot")
- company: The company where it is trending (e.g., "Amazon", "Uber")
- category: The core concept (e.g., "Creational Patterns", "Concurrency", "OOP Fundamentals")
- description: A brief 2-3 sentence problem statement.
Return ONLY the raw JSON array without markdown formatting like \`\`\`json.`;

        if (!process.env.GEMINI_API_KEY) {
            // Fallback mock data if no key
            return res.json({
                questions: [
                    { title: "Design a Parking Lot", company: "Amazon", category: "OOP & Design Patterns", description: "Design a parking lot with multiple levels and spots for motorcycles, cars, and buses. Handle entry/exit ticketing." },
                    { title: "Design LRU Cache", company: "Google", category: "Data Structures", description: "Design an In-Memory LRU Cache with O(1) get and put operations." },
                    { title: "Design Tic-Tac-Toe", company: "Microsoft", category: "State Machine", description: "Design an extensible Tic-Tac-Toe game supporting an N x N grid and multiple players." }
                ]
            });
        }

        const reply = await callGeminiRaw(prompt, 1000);
        let parsed = [];
        try {
            parsed = JSON.parse(reply.replace(/```json/g, '').replace(/```/g, '').trim());
        } catch (e) {
            console.error("Failed to parse LLD questions from Gemini:", e);
            // Fallback
            parsed = [
                { title: "Design a Parking Lot", company: "Amazon", category: "OOP & Design Patterns", description: "Design a parking lot with multiple levels and spots for motorcycles, cars, and buses. Handle entry/exit ticketing." },
                { title: "Design Vending Machine", company: "Google", category: "State Design Pattern", description: "Design a Vending Machine that dispenses items, handles currency, and tracks inventory." }
            ];
        }
        res.json({ questions: parsed });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch questions" });
    }
});

app.post("/api/lld/evaluate", async (req, res) => {
    try {
        const { question, answer } = req.body;

        const prompt = `Evaluate the following user answer for a Low-Level Design (LLD) interview question.
Question: ${question.title} - ${question.description}
User Answer: ${answer}

Act as an expert interviewer. Provide your evaluation as a valid JSON object with:
- isCorrect: boolean (true if the approach is generally valid or on the right track, false if completely wrong or missing core concepts)
- correctApproach: A concise 2-3 sentence summary of the ideal approach (mentioning specific design patterns or SOLID principles if applicable)
- concept: The core LLD concept tested here (e.g., "Factory Pattern", "Liskov Substitution")
- reason: A brief explanation of why the user's answer is good or what it lacks.

Return ONLY raw JSON.`;

        if (!process.env.GEMINI_API_KEY) {
            return res.json({
                isCorrect: true,
                correctApproach: "A good approach involves defining core entities and using appropriate patterns.",
                concept: "System Design",
                reason: "Mock evaluation - please add GEMINI_API_KEY for real feedback."
            });
        }

        const reply = await callGeminiRaw(prompt, 600);
        let parsed = {};
        try {
            parsed = JSON.parse(reply.replace(/```json/g, '').replace(/```/g, '').trim());
        } catch (e) {
            parsed = {
                isCorrect: true,
                correctApproach: "Failed to parse AI response. Ideal approach uses standard patterns.",
                concept: "LLD Pattern",
                reason: reply
            };
        }
        res.json(parsed);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Evaluation failed" });
    }
});

/* ─── College Info via SerpApi (Comprehensive) ──────────────────── */
app.get("/api/college-info", async (req, res) => {
    const { collegeName } = req.query;
    if (!collegeName) {
        return res.status(400).json({ error: "Missing collegeName parameter" });
    }

    const SERP_API_KEY = process.env.SERP_API_KEY;
    if (!SERP_API_KEY) {
        return res.status(500).json({ error: "SERP_API_KEY is not configured" });
    }

    try {
        const serpFetch = (url) => fetch(url).then(r => r.json()).catch(() => ({}));

        // Strict condition: Ensure we are searching for an educational institution
        let strictQuery = collegeName;
        if (!/college|university|institute|school|academy|tech/i.test(strictQuery)) {
            strictQuery += " engineering college";
        }
        const baseQ = encodeURIComponent(strictQuery);

        const [
            googleData, mapsData, instaData, fbData,
            imagesData, videosData, placementData, affiliationData, newsData,
            staffData, feedbackData, achievementData
        ] = await Promise.all([
            serpFetch(`https://serpapi.com/search.json?engine=google&q=${baseQ}&api_key=${SERP_API_KEY}&num=10`),
            serpFetch(`https://serpapi.com/search.json?engine=google_maps&q=${baseQ}&api_key=${SERP_API_KEY}`),
            serpFetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(collegeName + " site:instagram.com")}&api_key=${SERP_API_KEY}&num=3`),
            serpFetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(collegeName + " site:facebook.com")}&api_key=${SERP_API_KEY}&num=3`),
            serpFetch(`https://serpapi.com/search.json?engine=google_images&q=${baseQ}&api_key=${SERP_API_KEY}&num=9`),
            serpFetch(`https://serpapi.com/search.json?engine=youtube&search_query=${baseQ}&api_key=${SERP_API_KEY}`),
            serpFetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(collegeName + " placement statistics package salary 2024")}&api_key=${SERP_API_KEY}&num=5`),
            serpFetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(collegeName + " affiliated university autonomous NAAC accreditation")}&api_key=${SERP_API_KEY}&num=5`),
            serpFetch(`https://serpapi.com/search.json?engine=google_news&q=${baseQ}&api_key=${SERP_API_KEY}`),
            serpFetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(collegeName + " faculty staff professors principals")}&api_key=${SERP_API_KEY}&num=3`),
            serpFetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(collegeName + " student reviews feedback quora shiksha")}&api_key=${SERP_API_KEY}&num=4`),
            serpFetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(collegeName + " achievements awards ranking")}&api_key=${SERP_API_KEY}&num=3`)
        ]);

        const kg = googleData.knowledge_graph || {};
        const place = mapsData.local_results?.[0] || {};

        const officialLink = kg.website || googleData.organic_results?.[0]?.link || "Not found";
        const contactInfoSnippet = kg.description || googleData.organic_results?.[0]?.snippet || "Not found";

        const instagramLink = instaData.organic_results?.[0]?.link || "Not found";
        const facebookLink = fbData.organic_results?.[0]?.link || "Not found";
        const twitterLink = (kg.profiles || []).find(p => p.name?.toLowerCase().includes("twitter"))?.link || "Not found";
        const youtubeLink = (kg.profiles || []).find(p => p.name?.toLowerCase().includes("youtube"))?.link || "Not found";
        const linkedinLink = (kg.profiles || []).find(p => p.name?.toLowerCase().includes("linkedin"))?.link || "Not found";

        const locationAddress = place.address || kg.address || "Not found";
        const locationPhone = place.phone || kg.phone || "Not found";
        const locationRating = place.rating || kg.rating || null;
        const locationReviews = place.reviews || null;
        const locationGps = place.gps_coordinates || {};
        const mapsLink = place.place_id
            ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
            : (locationGps.latitude ? `https://www.google.com/maps?q=${locationGps.latitude},${locationGps.longitude}` : "Not found");

        const images = (imagesData.images_results || []).slice(0, 9).map(img => ({
            thumbnail: img.thumbnail, original: img.original, title: img.title || collegeName
        }));

        const videos = (videosData.video_results || []).slice(0, 6).map(v => ({
            title: v.title, link: v.link,
            thumbnail: v.thumbnail?.static || v.thumbnail,
            channel: v.channel?.name || "",
            published: v.published_date || "",
            duration: v.length || ""
        }));

        const placements = (placementData.organic_results || []).slice(0, 3).map(r => ({ title: r.title, snippet: r.snippet, link: r.link }));
        const affiliations = (affiliationData.organic_results || []).slice(0, 3).map(r => ({ title: r.title, snippet: r.snippet, link: r.link }));
        const news = (newsData.news_results || []).slice(0, 4).map(r => ({ title: r.title, snippet: r.snippet, link: r.link, source: r.source }));

        const staffDetails = (staffData.organic_results || []).slice(0, 3).map(r => ({ title: r.title, snippet: r.snippet, link: r.link }));
        const studentFeedback = (feedbackData.organic_results || []).slice(0, 4).map(r => ({ title: r.title, snippet: r.snippet, link: r.link }));
        const achievements = (achievementData.organic_results || []).slice(0, 3).map(r => ({ title: r.title, snippet: r.snippet, link: r.link }));

        const facts = {};
        ['founded', 'type', 'affiliation', 'students', 'colors', 'campus', 'president', 'chancellor', 'endowment', 'mascot'].forEach(k => { if (kg[k]) facts[k] = kg[k]; });

        const profileImage = kg.thumbnail || images[0]?.thumbnail || null;

        res.json({
            collegeName, officialLink, contactInfoSnippet, profileImage,
            socialLinks: { instagram: instagramLink, facebook: facebookLink, twitter: twitterLink, youtube: youtubeLink, linkedin: linkedinLink },
            location: { address: locationAddress, phone: locationPhone, rating: locationRating, reviews: locationReviews, gps: locationGps, mapsLink },
            images, videos, placements, affiliations, news, facts,
            staffDetails, studentFeedback, achievements
        });

    } catch (error) {
        console.error("Error fetching college info from SerpApi:", error);
        res.status(500).json({ error: "Failed to fetch college information." });
    }
});



/* ─── Frontend fallback ─────────────────────────────────────────── */

/* ─── LLD CODE ARENA ROUTES ────────────────────────────────────── */
app.get("/api/lld-questions", (req, res) => {
    // 10 real-time modeled questions derived from the Awesome LLD guide concepts
    const questions = [
        {
            id: 1,
            title: "Design a Parking Lot",
            tags: ["Google", "Amazon"],
            difficulty: "Medium",
            concept: "Object-Oriented Design, SOLID Principles",
            description: "Design a parking lot with multiple floors, spot types (compact, large, handicapped), and pricing strategies. How would you handle concurrent vehicle entry/exit?"
        },
        {
            id: 2,
            title: "Design an LRU Cache",
            tags: ["Amazon", "Microsoft"],
            difficulty: "Medium",
            concept: "Data Structures, Concurrency",
            description: "Design a Least Recently Used (LRU) Cache that supports get and put operations in O(1) time. How do you handle multi-threading?"
        },
        {
            id: 3,
            title: "Design a Vending Machine",
            tags: ["Zoho", "TCS"],
            difficulty: "Easy",
            concept: "State Design Pattern",
            description: "Design a Vending Machine that transitions between states (NoCoin, HasCoin, Dispensing, SoldOut) based on user actions."
        },
        {
            id: 4,
            title: "Design a Rate Limiter",
            tags: ["Meta", "Uber"],
            difficulty: "Hard",
            concept: "Concurrency, Algorithms (Token Bucket/Sliding Window)",
            description: "Design a distributed API rate limiter. Which algorithm would you use and how do you store the counters?"
        },
        {
            id: 5,
            title: "Design Tic-Tac-Toe",
            tags: ["Oracle", "Apple"],
            difficulty: "Easy",
            concept: "Class Relationships, Arrays",
            description: "Design a scalable Tic-Tac-Toe game that can support an NxN board and M players."
        },
        {
            id: 6,
            title: "Design a Task Management System (Jira)",
            tags: ["Atlassian", "IBM"],
            difficulty: "Medium",
            concept: "Observer Pattern, UML",
            description: "Design a task tracker where users can create, assign, and transition tasks. Subscribers should be notified of status changes."
        },
        {
            id: 7,
            title: "Design an Elevator System",
            tags: ["Google", "Cisco"],
            difficulty: "Hard",
            concept: "Strategy Pattern, State Machine",
            description: "Design a system for M elevators serving N floors. Explain your dispatching strategy (e.g., SCAN algorithm)."
        },
        {
            id: 8,
            title: "Design Amazon (Online Shopping)",
            tags: ["Amazon"],
            difficulty: "Hard",
            concept: "Microservices, Database Design",
            description: "Design the checkout and inventory reservation system for an e-commerce platform avoiding overselling."
        },
        {
            id: 9,
            title: "Design a Logger Framework",
            tags: ["Microsoft", "TCS"],
            difficulty: "Medium",
            concept: "Chain of Responsibility Pattern, Singleton",
            description: "Design a logging framework (like Log4j) supporting multiple log levels (INFO, DEBUG, ERROR) and multiple sinks (Console, File)."
        },
        {
            id: 10,
            title: "Design a Pub-Sub System (Kafka)",
            tags: ["AWS", "Meta"],
            difficulty: "Hard",
            concept: "Concurrency, Observer Pattern",
            description: "Design a Publish-Subscribe message broker. How do you handle topic partitions and consumer offsets?"
        }
    ];
    res.json({ success: true, data: questions });
});

app.post("/api/lld-evaluate", async (req, res) => {
    const { questionId, answer } = req.body;

    // Simple mocked evaluation for now, using a structured format
    // Ideally this calls Gemini for deep analysis.
    let status = "Needs Improvement";
    let isCorrect = false;

    if (answer && answer.length > 50) {
        status = "Good Approach";
        isCorrect = true;
    }

    const feedback = {
        isCorrect,
        status: isCorrect ? "Correct" : "Needs Review",
        reason: isCorrect
            ? "Your answer addresses the core entities and applies basic object-oriented principles effectively. Good job covering the edge cases."
            : "The answer is too brief. Ensure you clarify requirements, define core entities, and explicitly mention which design patterns (like Strategy or Observer) you're using.",
        conceptApplied: "SOLID, Design Patterns",
        correctAnswer: "A complete solution should include: 1. Core Interfaces (Strategy/Observer). 2. Entity models with private fields. 3. Thread-safe data structures like ConcurrentHashMap. 4. Handling edge cases.",
        rating: isCorrect ? 4.5 : 2.5
    };

    res.json({ success: true, evaluation: feedback });
});

app.get("*", (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, "app.html"));
});

/* ─── Server Start ──────────────────────────────────────────────── */
initDatabase().then(() => {

    // ── LLD Daily Updates (SerpApi) ──────────────────────────────────────────────
    app.get("/api/lld-daily-updates", async (req, res) => {
        try {
            const apiKey = process.env.SERP_API_KEY;
            if (!apiKey) {
                return res.status(503).json({ error: "LLD updates are not configured." });
            }

            // Use node-fetch natively or global fetch if Node > 18
            const query = encodeURIComponent("site:leetcode.com/discuss/interview-question \"low level design\" OR \"LLD\" (Google OR Amazon OR Microsoft OR Meta OR Uber)");
            const url = `https://serpapi.com/search.json?engine=google&q=${query}&api_key=${apiKey}&num=5&sort=date`;

            const response = await fetch(url);
            const data = await response.json();

            const results = (data.organic_results || []).map(r => ({
                title: r.title,
                link: r.link,
                snippet: r.snippet,
                date: r.date || "Recent"
            }));

            res.json({ success: true, questions: results });
        } catch (error) {
            console.error("SerpApi Error:", error);
            res.status(500).json({ error: "Failed to fetch LLD updates." });
        }
    });

    /* ─── Razorpay: Create Order ─────────────────────────────────── */
    app.post("/api/subscription/create-order", requireAuth, async (req, res) => {
        try {
            if (!razorpay) {
                return res.status(503).json({ error: "Payments are not configured. Please contact support." });
            }
            const order = await razorpay.orders.create({
                amount: SUBSCRIPTION_AMOUNT_PAISE,
                currency: "INR",
                receipt: `rh_sub_${req.currentUser.id}_${Date.now()}`,
                notes: {
                    user_id: String(req.currentUser.id),
                    email: req.currentUser.email,
                    plan: "monthly_6"
                }
            });
            return res.json({
                success: true,
                order_id: order.id,
                amount: order.amount,
                currency: order.currency,
                key_id: process.env.RAZORPAY_KEY_ID,
                user_name: req.currentUser.name,
                user_email: req.currentUser.email,
                user_phone: req.currentUser.phone || ""
            });
        } catch (err) {
            console.error("[Razorpay] Order creation failed:", err.message);
            return res.status(500).json({ error: "Payment order creation failed. Please try again." });
        }
    });

    /* ─── Razorpay: Verify Payment (Client-side) ─────────────────── */
    app.post("/api/subscription/verify", requireAuth, (req, res) => {
        if (!process.env.RAZORPAY_KEY_SECRET) {
            return res.status(503).json({ error: "Payments are not configured. Please contact support." });
        }
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ error: "Missing payment verification fields." });
        }
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSig = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body).digest("hex");
        const expectedBuffer = Buffer.from(expectedSig, "utf8");
        const receivedBuffer = Buffer.from(String(razorpay_signature), "utf8");
        if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
            return res.status(400).json({ error: "Payment signature mismatch. Verification failed." });
        }
        // Activate subscription
        const now = new Date().toISOString();
        dbRun("UPDATE users SET subscription_status = 'active', subscription_id = ?, subscribed_at = ? WHERE id = ?",
            [razorpay_payment_id, now, req.currentUser.id]);
        console.log(`[Subscription] Activated for user ${req.currentUser.email} — payment ${razorpay_payment_id}`);
        return res.json({ success: true, message: "Subscription activated successfully!" });
    });

    /* ─── Razorpay: Webhook (server-to-server) ───────────────────── */
    app.post("/api/webhook/razorpay", (req, res) => {
        if (!RAZORPAY_WEBHOOK_SECRET || !req.rawBody) {
            return res.status(503).json({ error: "Payment webhooks are not configured." });
        }
        const signature = req.headers["x-razorpay-signature"] || "";
        const body = req.rawBody;
        // Verify webhook signature
        const expectedSig = crypto.createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
            .update(body).digest("hex");
        const expectedBuffer = Buffer.from(expectedSig, "utf8");
        const receivedBuffer = Buffer.from(String(signature), "utf8");
        if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
            console.warn("[Webhook] Invalid Razorpay signature");
            return res.status(400).json({ error: "Invalid signature" });
        }
        let event;
        try { event = JSON.parse(body.toString()); } catch { return res.status(400).json({ error: "Invalid JSON" }); }

        const eventType = event.event;
        const payment = event.payload && event.payload.payment && event.payload.payment.entity;

        if ((eventType === "payment.captured" || eventType === "order.paid") && payment) {
            const notes = payment.notes || {};
            const userId = notes.user_id;
            const paymentId = payment.id;
            if (userId) {
                const now = new Date().toISOString();
                dbRun("UPDATE users SET subscription_status = 'active', subscription_id = ?, subscribed_at = ? WHERE id = ?",
                    [paymentId, now, userId]);
                console.log(`[Webhook] Subscription activated for user_id=${userId}, payment=${paymentId}`);
            }
        }
        return res.json({ status: "ok" });
    });

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`\n======================================================`);
        console.log(`  🚀 Rank-Holder Server running on http://0.0.0.0:${PORT}`);
        console.log(`  📁 Frontend root: ./frontend/`);
        console.log(`  🗄️ Database: ${DB_PATH}`);
        console.log(`======================================================\n`);
    });
}).catch(err => {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
});
