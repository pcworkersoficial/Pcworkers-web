import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Falta la variable de entorno ${name}. Revisá el archivo .env`);
    process.exit(1);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT || 3000),

  openaiKey: required('OPENAI_API_KEY'),
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1',

  waToken: required('WHATSAPP_TOKEN'),
  waPhoneNumberId: required('WHATSAPP_PHONE_NUMBER_ID'),
  waVerifyToken: required('WHATSAPP_VERIFY_TOKEN'),
  waAppSecret: process.env.WHATSAPP_APP_SECRET || '',
  graphVersion: process.env.GRAPH_API_VERSION || 'v21.0',

  adminPhone: (process.env.ADMIN_PHONE || '').replace(/\D/g, ''),
  handoffMinutes: Number(process.env.HANDOFF_MINUTES || 120),
  batchSeconds: Number(process.env.MESSAGE_BATCH_SECONDS || 4),

  // Cuántos mensajes recordar por cliente y por cuánto tiempo
  historyLimit: 20,
  historyTtlHours: 24,
};
