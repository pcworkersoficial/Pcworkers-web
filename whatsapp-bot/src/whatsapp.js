import crypto from 'node:crypto';
import { config } from './config.js';

const GRAPH = `https://graph.facebook.com/${config.graphVersion}`;

async function graph(path, body) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.waToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`WhatsApp API ${res.status}: ${JSON.stringify(data.error || data)}`);
  }
  return data;
}

// WhatsApp corta en 4096 caracteres; partimos por las dudas.
function chunks(text, size = 3500) {
  const parts = [];
  let rest = text.trim();
  while (rest.length > size) {
    let cut = rest.lastIndexOf('\n', size);
    if (cut < size / 2) cut = rest.lastIndexOf(' ', size);
    if (cut < size / 2) cut = size;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

export async function sendText(to, text) {
  for (const part of chunks(text)) {
    await graph(`${config.waPhoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: part },
    });
  }
}

// Marca como leído (tildes azules) y muestra "escribiendo..." mientras el bot piensa.
export async function markReadAndTyping(messageId) {
  try {
    await graph(`${config.waPhoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
      typing_indicator: { type: 'text' },
    });
  } catch (err) {
    // No es crítico: si la versión de la API no soporta typing, solo lo ignoramos.
    console.warn('No se pudo marcar como leído:', err.message);
  }
}

// Descarga un archivo (audio, imagen) que mandó el cliente.
export async function downloadMedia(mediaId) {
  const metaRes = await fetch(`${GRAPH}/${mediaId}`, {
    headers: { Authorization: `Bearer ${config.waToken}` },
  });
  if (!metaRes.ok) throw new Error(`No se pudo obtener el media ${mediaId}: ${metaRes.status}`);
  const meta = await metaRes.json();

  const fileRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${config.waToken}` },
  });
  if (!fileRes.ok) throw new Error(`No se pudo descargar el media ${mediaId}: ${fileRes.status}`);
  const buffer = Buffer.from(await fileRes.arrayBuffer());
  return { buffer, mimeType: meta.mime_type || 'application/octet-stream' };
}

// Verifica que el webhook realmente viene de Meta (header X-Hub-Signature-256).
export function isValidSignature(rawBody, signatureHeader) {
  if (!config.waAppSecret) return true; // sin secret configurado no se valida
  if (!signatureHeader || !rawBody) return false;
  const expected =
    'sha256=' + crypto.createHmac('sha256', config.waAppSecret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
