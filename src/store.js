const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const STORE_PATH = path.join(__dirname, "..", "data", "app-store.json");

const defaultStore = {
  users: [],
  jobs: [],
  applications: [],
  assessmentSessions: [],
  assessmentMessages: [],
  assessmentResults: []
};

function ensureStore() {
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify(defaultStore, null, 2), "utf8");
  }
}

function readStore() {
  ensureStore();
  const raw = fs.readFileSync(STORE_PATH, "utf8");
  return JSON.parse(raw || "{}");
}

function writeStore(data) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
}

function newId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function getRoleFromEmail(email) {
  return getAdminEmails().includes((email || "").toLowerCase()) ? "admin" : "user";
}

function upsertUser(email, name = "") {
  const store = readStore();
  const lowerEmail = (email || "").toLowerCase();
  let user = store.users.find((u) => u.email === lowerEmail);
  if (!user) {
    user = {
      id: newId("usr"),
      email: lowerEmail,
      name,
      role: getRoleFromEmail(lowerEmail),
      createdAt: Date.now()
    };
    store.users.push(user);
  } else {
    user.name = name || user.name;
    user.role = getRoleFromEmail(lowerEmail);
  }
  writeStore(store);
  return user;
}

module.exports = {
  readStore,
  writeStore,
  newId,
  getRoleFromEmail,
  upsertUser
};
