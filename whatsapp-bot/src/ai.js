import { config } from './config.js';
import { buildSystemPrompt } from './prompt.js';

const OPENAI = 'https://api.openai.com/v1';

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'derivar_a_tecnico',
      description:
        'Pasa la conversación a un técnico humano de Pcworkers. Usala cuando el problema ya está claro ' +
        'para conectarse de forma remota, cuando el cliente pide hablar con una persona, pide presupuesto, ' +
        'es una empresa interesada en soporte B2B o está molesto.',
      parameters: {
        type: 'object',
        properties: {
          motivo: {
            type: 'string',
            enum: ['diagnostico_listo', 'pide_humano', 'presupuesto', 'empresa_b2b', 'cliente_molesto', 'otro'],
          },
          resumen: {
            type: 'string',
            description: 'Resumen breve del caso para el técnico: problema, equipo, sistema operativo, urgencia.',
          },
          nombre_cliente: { type: 'string', description: 'Nombre del cliente si lo dijo.' },
          mensaje_al_cliente: {
            type: 'string',
            description: 'Mensaje corto para el cliente avisando que un técnico lo va a contactar.',
          },
        },
        required: ['motivo', 'resumen', 'mensaje_al_cliente'],
      },
    },
  },
];

async function openai(path, init) {
  const res = await fetch(`${OPENAI}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${config.openaiKey}`, ...(init.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${JSON.stringify(data.error || data)}`);
  return data;
}

/**
 * Genera la respuesta del bot.
 * @param history mensajes previos [{role, content}]
 * @param userContent texto (o partes con imagen) del mensaje actual
 * @returns {{ reply: string, handoff?: object }}
 */
export async function generateReply(history, userContent, customerName) {
  const system = buildSystemPrompt() + (customerName ? `\nEl nombre de perfil del cliente es: ${customerName}.` : '');

  const data = await openai('chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.openaiModel,
      messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: userContent }],
      tools: TOOLS,
      temperature: 0.5,
      max_tokens: 400,
    }),
  });

  const msg = data.choices?.[0]?.message || {};
  const call = msg.tool_calls?.find((t) => t.function?.name === 'derivar_a_tecnico');

  if (call) {
    let args = {};
    try {
      args = JSON.parse(call.function.arguments || '{}');
    } catch {
      // argumentos rotos: igual derivamos
    }
    const reply =
      args.mensaje_al_cliente ||
      '¡Perfecto! Ya le pasé tu caso a un técnico de Pcworkers, te escribe por acá en breve 🙌';
    return { reply, handoff: args };
  }

  return { reply: (msg.content || '').trim() || 'Perdón, ¿me lo podés repetir?' };
}

// Transcribe un audio de WhatsApp (ogg/opus) a texto.
export async function transcribe(buffer, mimeType) {
  const form = new FormData();
  const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mpeg') ? 'mp3' : 'm4a';
  form.append('file', new Blob([buffer], { type: mimeType.split(';')[0] }), `audio.${ext}`);
  form.append('model', config.transcribeModel);
  form.append('language', 'es');
  const data = await openai('audio/transcriptions', { method: 'POST', body: form });
  return (data.text || '').trim();
}
