# 🤖 Bot de WhatsApp — Pcworkers

Bot automático que atiende el WhatsApp de Pcworkers con IA (OpenAI), usando la **API oficial de WhatsApp (Meta Cloud API)**, así no hay riesgo de que bloqueen el número.

## Qué hace

- Responde al instante, 24/7, en español rioplatense, con la info de Pcworkers.
- Hace un **pre-diagnóstico** (qué pasa, desde cuándo, Windows/Mac, notebook o PC, personal o empresa).
- **Entiende audios** (los transcribe) y **mira imágenes** (capturas de errores, fotos de pantalla).
- Junta varios mensajes seguidos del cliente y responde una sola vez.
- Cuando el caso está listo, el cliente pide un humano, pide presupuesto o es una empresa → **deriva a un técnico**: te manda un aviso con el resumen a tu celular y se queda callado con ese cliente (2 h por defecto).
- Recuerda la conversación de cada cliente (24 h).

## Comandos para el técnico

Desde el celular configurado en `ADMIN_PHONE`, escribile al número del bot:

| Comando | Qué hace |
|---|---|
| `#ayuda` | Lista de comandos |
| `#pausados` | Clientes que está atendiendo un técnico |
| `#pausar 549XXXXXXXXXX 60` | Silencia el bot con ese cliente (minutos opcional) |
| `#activar 549XXXXXXXXXX` | El bot vuelve a responderle |
| `#r 549XXXXXXXXXX texto` | Le responde al cliente desde el número del bot |
| `#reset 549XXXXXXXXXX` | Borra la memoria de ese chat |

> ⚠️ Regla de WhatsApp: el bot solo puede mandarte avisos si **vos le escribiste en las últimas 24 h**. Mandale `#ayuda` cada mañana y listo.

---

## Instalación paso a paso

### 1. Crear la app en Meta (una sola vez)

1. Entrá a <https://developers.facebook.com> → **Mis apps** → **Crear app** → tipo **Empresa** → agregá el producto **WhatsApp**.
2. En **WhatsApp → Configuración de la API** vas a ver un número de prueba y el **Phone number ID**.
3. Agregá tu número real de Pcworkers (**Agregar número de teléfono**).
   - Si hoy lo usás en la app **WhatsApp Business**, Meta permite conectarlo en modo *coexistencia* (seguís viendo los chats en el celular). Si no te lo ofrece, el número tiene que salir de la app para pasar a la API.
4. Creá un **token permanente**: Business Settings → **Usuarios del sistema** → crear usuario (admin) → **Generar token** con permisos `whatsapp_business_messaging` y `whatsapp_business_management`.
5. Copiá la **Clave secreta de la app** (App → Configuración → Básica).
6. Cargá un método de pago en el WhatsApp Business Account. Responder a clientes que te escriben primero es gratis o muy barato (las conversaciones de servicio no se cobran).

### 2. Subir el bot al Contabo

Conectate por SSH:

```bash
# Node.js 20 (si no lo tenés)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# Bajar el código
cd /opt
sudo git clone https://github.com/pcworkersoficial/Pcworkers-web.git pcworkers
sudo chown -R $USER /opt/pcworkers
cd /opt/pcworkers/whatsapp-bot
npm install --omit=dev

# Configurar
cp .env.example .env
nano .env   # pegá tu OPENAI_API_KEY, WHATSAPP_TOKEN, PHONE_NUMBER_ID, APP_SECRET, ADMIN_PHONE
```

Arrancarlo y dejarlo corriendo para siempre (también tras reiniciar el servidor):

```bash
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup   # copiá y ejecutá el comando que te muestra
pm2 logs pcworkers-bot   # ver lo que pasa en vivo
```

### 3. Exponerlo con HTTPS (Nginx de tu web)

Meta exige HTTPS. Como tu web ya está en el Contabo, agregá el bloque de [`deploy/nginx-bot.conf`](deploy/nginx-bot.conf) dentro del `server { ... }` con SSL de tu sitio:

```bash
sudo nano /etc/nginx/sites-available/TU-SITIO
sudo nginx -t && sudo systemctl reload nginx
```

Probá en el navegador: `https://TU-DOMINIO/whatsapp/` → tiene que decir **Pcworkers WhatsApp bot OK**.

> ¿No tenés SSL todavía? `sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx -d tudominio.com`

### 4. Conectar el webhook en Meta

En developers.facebook.com → tu app → **WhatsApp → Configuración**:

- **URL de devolución de llamada:** `https://TU-DOMINIO/whatsapp/webhook`
- **Token de verificación:** el mismo `WHATSAPP_VERIFY_TOKEN` de tu `.env`
- Clic en **Verificar y guardar** → después, en *Campos del webhook*, suscribite a **messages**.

¡Listo! Escribile al número y el bot responde. 🎉

---

## Personalizar

- **Lo que sabe el bot** (servicios, horarios, reglas, tono): `src/prompt.js`. Después: `pm2 restart pcworkers-bot`.
- **Modelo de OpenAI**: `OPENAI_MODEL` en `.env` (por defecto `gpt-4o-mini`, muy barato: centavos de dólar por cientos de chats).
- **Tiempo de silencio tras derivar**: `HANDOFF_MINUTES`.

## Actualizar

```bash
cd /opt/pcworkers && git pull && cd whatsapp-bot && npm install --omit=dev && pm2 restart pcworkers-bot
```

## Problemas comunes

| Síntoma | Solución |
|---|---|
| Meta no verifica el webhook | Revisá que `https://TU-DOMINIO/whatsapp/webhook` abra y que el token coincida. |
| Llegan mensajes pero no responde | `pm2 logs pcworkers-bot`. Si dice `401` de WhatsApp, el token venció: usá uno permanente. |
| `Firma inválida` en los logs | `WHATSAPP_APP_SECRET` no coincide con la clave secreta de la app. |
| No te llegan los avisos de casos | Escribile `#ayuda` al bot (ventana de 24 h de WhatsApp). |
