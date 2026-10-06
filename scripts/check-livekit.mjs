/**
 * Diagnóstico de credenciales LiveKit para VoxCord.
 *
 *   node scripts/check-livekit.mjs            -> token con nbf = ahora (como el SDK)
 *   node scripts/check-livekit.mjs --backdate -> token con nbf = hace 1 h (test de desfase de reloj)
 *
 * Lee LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET de .env y .env.local
 * (misma precedencia que Next), firma un JWT de acceso y hace el handshake real
 * de señalización (upgrade WebSocket) contra el servidor. Imprime el veredicto.
 */
import fs from 'node:fs';
import path from 'node:path';
import tls from 'node:tls';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const backdate = process.argv.includes('--backdate');

function loadEnv() {
  const env = {};
  for (const file of ['.env', '.env.local']) {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

const env = loadEnv();
const url = env.LIVEKIT_URL?.trim();
const apiKey = env.LIVEKIT_API_KEY?.trim();
const apiSecret = env.LIVEKIT_API_SECRET?.trim();

if (!url || !apiKey || !apiSecret) {
  console.error('Faltan LIVEKIT_URL, LIVEKIT_API_KEY o LIVEKIT_API_SECRET en .env / .env.local');
  process.exit(2);
}

console.log(`url     : ${url}`);
console.log(`api key : len=${apiKey.length} prefix=${apiKey.slice(0, 4)}***`);
console.log(`secret  : len=${apiSecret.length} charset=${/^[A-Za-z0-9+/=_-]+$/.test(apiSecret) ? 'base64ish OK' : 'CONTIENE CARACTERES RAROS (revisar comillas/espacios)'}`);
console.log(`modo    : nbf ${backdate ? 'retrocedido 1 h (test de reloj)' : '= ahora (como el SDK)'}`);

const host = new URL(url.replace(/^wss/, 'https')).host;
const now = Math.floor(Date.now() / 1000);
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const header = b64u({ alg: 'HS256', typ: 'JWT' });
const payload = b64u({
  iss: apiKey,
  sub: 'voxcord-diag',
  name: 'voxcord-diag',
  nbf: backdate ? now - 3600 : now,
  exp: now + 3600,
  video: { roomJoin: true, room: 'voxcord-diag', canPublish: true, canSubscribe: true, canPublishData: true },
});
const token = `${header}.${payload}.${crypto.createHmac('sha256', apiSecret).update(`${header}.${payload}`).digest('base64url')}`;

const wsPath = `/rtc?access_token=${encodeURIComponent(token)}&protocol=15&sdk=js&version=diag`;
const wsKey = crypto.randomBytes(16).toString('base64');
const sock = tls.connect(443, host, { servername: host }, () => {
  sock.write(
    `GET ${wsPath} HTTP/1.1\r\nHost: ${host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
      `Sec-WebSocket-Key: ${wsKey}\r\nSec-WebSocket-Version: 13\r\nUser-Agent: voxcord-diag\r\n\r\n`,
  );
});

let buf = '';
const timer = setTimeout(() => {
  console.error('TIMEOUT: el servidor no respondió en 10 s');
  process.exit(2);
}, 10000);

sock.on('data', (d) => {
  buf += d.toString('latin1');
  if (!buf.includes('\r\n\r\n')) return;
  clearTimeout(timer);
  const statusLine = buf.split('\r\n')[0];
  if (statusLine.includes(' 101 ')) {
    console.log('\nVEREDICTO: 101 Switching Protocols — credenciales VÁLIDAS y token aceptado.');
    if (backdate) {
      console.log('Con --backdate funciona y sin él no: tu reloj está desfasado (nbf en el futuro).');
      console.log('Solución: sincroniza Windows (w32tm /resync) — el backend ya retrocede nbf por seguridad.');
    }
    process.exit(0);
  }
  setTimeout(() => {
    const body = buf.split('\r\n\r\n').slice(1).join('\r\n\r\n').slice(0, 120);
    console.log(`\nVEREDICTO: ${statusLine}`);
    console.log(`cuerpo: ${body}`);
    if (statusLine.includes(' 401 ')) {
      console.log(`
El servidor rechaza el token. Causas típicas:
  1. API key/secret no son del mismo proyecto que LIVEKIT_URL (revisa https://cloud.livekit.io).
  2. Editaste .env con el servidor arrancado: Next solo lee .env al iniciar -> reinicia npm run dev.
  3. El secret se pegó truncado o con caracteres extraños.
Si --backdate sí funciona: es desfase de reloj (sincroniza con w32tm /resync).`);
    }
    process.exit(1);
  }, 700);
});
sock.on('error', (e) => {
  console.error('TLS error:', e.message);
  process.exit(1);
});
