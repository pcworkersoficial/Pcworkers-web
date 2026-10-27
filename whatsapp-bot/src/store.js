// Memoria simple del bot, guardada en data/state.json para que sobreviva reinicios.
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const DATA_DIR = path.resolve('data');
const FILE = path.join(DATA_DIR, 'state.json');

let state = { chats: {} };

try {
  state = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (!state.chats) state.chats = {};
} catch {
  // primera vez: no hay archivo
}

let saveTimer = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, FILE);
  }, 1000);
}

function chat(phone) {
  if (!state.chats[phone]) {
    state.chats[phone] = { name: '', history: [], pausedUntil: 0, updatedAt: Date.now() };
  }
  return state.chats[phone];
}

export function getHistory(phone) {
  const c = chat(phone);
  // Si pasó mucho tiempo desde la última charla, empezamos de cero.
  if (Date.now() - c.updatedAt > config.historyTtlHours * 3600_000) c.history = [];
  return c.history;
}

export function addToHistory(phone, role, content) {
  const c = chat(phone);
  c.history.push({ role, content });
  if (c.history.length > config.historyLimit) {
    c.history.splice(0, c.history.length - config.historyLimit);
  }
  c.updatedAt = Date.now();
  save();
}

export function setName(phone, name) {
  if (name && chat(phone).name !== name) {
    chat(phone).name = name;
    save();
  }
}

export function getName(phone) {
  return state.chats[phone]?.name || '';
}

export function pause(phone, minutes) {
  chat(phone).pausedUntil = Date.now() + minutes * 60_000;
  save();
}

export function resume(phone) {
  chat(phone).pausedUntil = 0;
  save();
}

export function isPaused(phone) {
  return (state.chats[phone]?.pausedUntil || 0) > Date.now();
}

export function pausedChats() {
  return Object.entries(state.chats)
    .filter(([, c]) => c.pausedUntil > Date.now())
    .map(([phone, c]) => ({ phone, name: c.name, until: new Date(c.pausedUntil) }));
}

export function resetChat(phone) {
  delete state.chats[phone];
  save();
}

// Meta a veces reenvía el mismo mensaje: evitamos responder dos veces.
const seen = new Map();
export function alreadySeen(messageId) {
  const now = Date.now();
  for (const [id, t] of seen) if (now - t > 3600_000) seen.delete(id);
  if (seen.has(messageId)) return true;
  seen.set(messageId, now);
  return false;
}
