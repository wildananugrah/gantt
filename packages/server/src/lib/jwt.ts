const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlEncode(bytes: Uint8Array | string): string {
  const s = typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export type JwtPayload = {
  sub: string;
  role: 'admin' | 'member';
  iat: number;
  exp: number;
};

export async function signJwt(
  claims: { sub: string; role: 'admin' | 'member' },
  secret: string,
  ttlSeconds: number,
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const payload = { ...claims, iat, exp: iat + ttlSeconds };
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = b64urlEncode(JSON.stringify(header));
  const p = b64urlEncode(JSON.stringify(payload));
  const data = `${h}.${p}`;
  const key = await importKey(secret);
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const sig = b64urlEncode(new Uint8Array(sigBuf));
  return `${data}.${sig}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload> {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) throw new Error('malformed token');
  const key = await importKey(secret);
  const ok = await crypto.subtle.verify(
    'HMAC',
    key,
    b64urlDecode(s),
    enc.encode(`${h}.${p}`),
  );
  if (!ok) throw new Error('bad signature');
  const payload = JSON.parse(dec.decode(b64urlDecode(p))) as JwtPayload;
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('expired');
  }
  return payload;
}
