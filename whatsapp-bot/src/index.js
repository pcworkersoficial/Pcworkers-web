import express from 'express';
import { config } from './config.js';
import { sendText, markReadAndTyping, downloadMedia, isValidSignature } from './whatsapp.js';
import { generateReply, transcribe } from './ai.js';
import * as store from './store.js';

const app = express();

// Guardamos el body "crudo" para poder validar la firma de Meta.
app.use(express.json({ limit: '2mb', verify: (req, _res, buf) => (req.rawBody = buf) }));

app.get('/', (_req, res) => res.send('Pcworkers WhatsApp bot OK'));

// 1) Verificación del webhook (Meta llama a esto una sola vez al configurarlo)
app.get('/webhook', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode === 'subscribe' && token === config.waVerifyToken) {
    console.log('Webhook verificado por Meta ✅');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// 2) Mensajes entrantes
app.post('/webhook', (req, res) => {
  if (!isValidSignature(req.rawBody, req.get('x-hub-signature-256'))) {
    console.warn('Firma inválida: request ignorado');
    return res.sendStatus(401);
  }
  // Respondemos 200 enseguida (si no, Meta reintenta) y procesamos aparte.
  res.sendStatus(200);

  for (const entry of req.body?.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const contacts = value.contacts || [];
      for (const message of value.messages || []) {
        const contact = contacts.find((c) => c.wa_id === message.from);
        if (contact?.profile?.name) store.setName(message.from, contact.profile.name);
        if (!store.alreadySeen(message.id)) enqueue(message);
      }
    }
  }
});

// ---------- Agrupar mensajes seguidos y procesar de a un cliente por vez ----------

const buffers = new Map(); // phone -> { messages: [], timer }
const running = new Map(); // phone -> Promise

function enqueue(message) {
  const phone = message.from;
  const buf = buffers.get(phone) || { messages: [], timer: null };
  buf.messages.push(message);
  clearTimeout(buf.timer);
  buf.timer = setTimeout(() => flush(phone), config.batchSeconds * 1000);
  buffers.set(phone, buf);
}

function flush(phone) {
  const buf = buffers.get(phone);
  buffers.delete(phone);
  if (!buf?.messages.length) return;
  const prev = running.get(phone) || Promise.resolve();
  const next = prev
    .then(() => handleMessages(phone, buf.messages))
    .catch((err) => console.error(`Error con ${phone}:`, err))
    .finally(() => {
      if (running.get(phone) === next) running.delete(phone);
    });
  running.set(phone, next);
}

// Convierte cada mensaje de WhatsApp en texto (y opcionalmente imágenes para OpenAI).
async function toContent(message) {
  switch (message.type) {
    case 'text':
      return { text: message.text.body };
    case 'audio': {
      try {
        const { buffer, mimeType } = await downloadMedia(message.audio.id);
        const text = await transcribe(buffer, mimeType);
        return { text: `[Audio del cliente] ${text || '(no se entendió el audio)'}` };
      } catch (err) {
        console.error('Error transcribiendo audio:', err.message);
        return { text: '[El cliente mandó un audio que no se pudo escuchar]' };
      }
    }
    case 'image': {
      const caption = message.image.caption || '';
      try {
        const { buffer, mimeType } = await downloadMedia(message.image.id);
        const url = `data:${mimeType};base64,${buffer.toString('base64')}`;
        return { text: `[El cliente mandó una imagen] ${caption}`.trim(), image: url };
      } catch (err) {
        console.error('Error descargando imagen:', err.message);
        return { text: `[El cliente mandó una imagen que no se pudo abrir] ${caption}`.trim() };
      }
    }
    case 'interactive':
      return {
        text: message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || '',
      };
    case 'button':
      return { text: message.button?.text || '' };
    case 'location':
      return { text: '[El cliente mandó su ubicación]' };
    case 'document':
      return { text: `[El cliente mandó un archivo: ${message.document?.filename || 'documento'}]` };
    case 'video':
      return { text: '[El cliente mandó un video. Solo podés leer texto, audios e imágenes]' };
    case 'sticker':
      return { text: '[El cliente mandó un sticker]' };
    default:
      return null; // reacciones, mensajes del sistema, etc.
  }
}

async function handleMessages(phone, messages) {
  const last = messages[messages.length - 1];

  // Comandos del técnico/dueño
  if (phone === config.adminPhone && messages.length === 1 && last.type === 'text') {
    const handled = await handleAdminCommand(last.text.body.trim());
    if (handled) return;
  }

  const contents = (await Promise.all(messages.map(toContent))).filter((c) => c && (c.text || c.image));
  if (!contents.length) return;

  const text = contents.map((c) => c.text).join('\n');
  const images = contents.filter((c) => c.image).map((c) => c.image);

  // Si un técnico está atendiendo, el bot solo guarda el mensaje y no responde.
  if (store.isPaused(phone)) {
    store.addToHistory(phone, 'user', text);
    return;
  }

  await markReadAndTyping(last.id);

  const userContent = images.length
    ? [{ type: 'text', text }, ...images.map((url) => ({ type: 'image_url', image_url: { url } }))]
    : text;

  let result;
  try {
    result = await generateReply(store.getHistory(phone), userContent, store.getName(phone));
  } catch (err) {
    console.error('Error de OpenAI:', err.message);
    result = {
      reply: 'Uy, tuve un problema técnico 😅. Ya le aviso a un técnico de Pcworkers para que te responda.',
      handoff: { motivo: 'otro', resumen: `Falló la IA: ${err.message}\nÚltimo mensaje: ${text}` },
    };
  }

  store.addToHistory(phone, 'user', text);
  store.addToHistory(phone, 'assistant', result.reply);
  await sendText(phone, result.reply);

  if (result.handoff) await doHandoff(phone, result.handoff);
}

async function doHandoff(phone, info) {
  store.pause(phone, config.handoffMinutes);
  const name = info.nombre_cliente || store.getName(phone) || 'Sin nombre';
  console.log(`Derivado a técnico: ${phone} (${info.motivo})`);
  if (!config.adminPhone) return;

  const aviso =
    `🔔 *Nuevo caso para técnico*\n` +
    `👤 ${name}\n📱 +${phone}\n🏷️ ${info.motivo}\n\n${info.resumen}\n\n` +
    `Abrir chat: https://wa.me/${phone}\n` +
    `El bot queda en pausa ${config.handoffMinutes} min con este cliente.\n` +
    `Responder desde el bot: #r ${phone} tu mensaje\nReactivar bot: #activar ${phone}`;
  try {
    await sendText(config.adminPhone, aviso);
  } catch (err) {
    console.error(
      'No se pudo avisar al técnico (¿el admin escribió al bot en las últimas 24 h?):',
      err.message,
    );
  }
}

// ---------- Comandos para el técnico (desde ADMIN_PHONE) ----------

const HELP = `*Comandos Pcworkers bot*
#pausados — clientes que está atendiendo un técnico
#pausar 549XXXXXXXXXX [minutos] — silencia el bot con ese cliente
#activar 549XXXXXXXXXX — el bot vuelve a responderle
#r 549XXXXXXXXXX texto — responder al cliente desde el número del bot
#reset 549XXXXXXXXXX — borra la memoria de ese chat
#ayuda — esta lista`;

async function handleAdminCommand(body) {
  if (!body.startsWith('#')) return false;
  const [cmd, rawPhone, ...rest] = body.split(/\s+/);
  const phone = (rawPhone || '').replace(/\D/g, '');
  const reply = (t) => sendText(config.adminPhone, t);

  switch (cmd.toLowerCase()) {
    case '#ayuda':
      await reply(HELP);
      return true;
    case '#pausados': {
      const list = store.pausedChats();
      await reply(
        list.length
          ? list
              .map((c) => `• ${c.name || 'Sin nombre'} +${c.phone} (hasta ${c.until.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', timeStyle: 'short' })})`)
              .join('\n')
          : 'No hay chats en pausa.',
      );
      return true;
    }
    case '#pausar': {
      if (!phone) return reply('Uso: #pausar 549XXXXXXXXXX [minutos]').then(() => true);
      const min = Number(rest[0]) || config.handoffMinutes;
      store.pause(phone, min);
      await reply(`⏸️ Bot pausado con +${phone} por ${min} min.`);
      return true;
    }
    case '#activar':
      if (!phone) return reply('Uso: #activar 549XXXXXXXXXX').then(() => true);
      store.resume(phone);
      await reply(`▶️ Bot activo otra vez con +${phone}.`);
      return true;
    case '#reset':
      if (!phone) return reply('Uso: #reset 549XXXXXXXXXX').then(() => true);
      store.resetChat(phone);
      await reply(`🧹 Memoria borrada para +${phone}.`);
      return true;
    case '#r': {
      const text = rest.join(' ');
      if (!phone || !text) return reply('Uso: #r 549XXXXXXXXXX tu mensaje').then(() => true);
      try {
        await sendText(phone, text);
        store.addToHistory(phone, 'assistant', `[Técnico] ${text}`);
        store.pause(phone, config.handoffMinutes);
        await reply(`✅ Enviado a +${phone}.`);
      } catch (err) {
        await reply(`❌ No se pudo enviar: ${err.message}`);
      }
      return true;
    }
    default:
      return false;
  }
}

app.listen(config.port, () => {
  console.log(`🤖 Bot Pcworkers escuchando en el puerto ${config.port}`);
});
