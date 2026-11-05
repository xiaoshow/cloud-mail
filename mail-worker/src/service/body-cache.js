// OCI stores only encrypted bodies and opaque keys. Authentication stays in the Worker.
const encoder = new TextEncoder();
const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
function b64(bytes) {
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }

export async function bodyCache(c, emailId, load) {
  const url = c.env.BODY_CACHE_URL;
  const secret = c.env.BODY_CACHE_SECRET;
  if (!url || !secret) return load();
  const material = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  const key = await crypto.subtle.importKey('raw', material, 'AES-GCM', false, ['encrypt', 'decrypt']);
  const cacheId = hex(await crypto.subtle.digest('SHA-256', encoder.encode(`cloud-mail-body-v1:${emailId}`)));
  const endpoint = `${url.replace(/\/$/, '')}/${cacheId}`;
  const headers = {Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json'};
  try {
    const response = await fetch(endpoint, {headers, signal: AbortSignal.timeout(1200)});
    if (response.ok) {
      const envelope = await response.json();
      const plain = await crypto.subtle.decrypt({name: 'AES-GCM', iv: unb64(envelope.iv), additionalData: encoder.encode(cacheId)}, key, unb64(envelope.data));
      const body = JSON.parse(new TextDecoder().decode(plain));
      if (typeof body.content === 'string' && typeof body.text === 'string') {
        c.header('X-Mail-Body-Cache', 'HIT');
        return body;
      }
    }
  } catch { /* A cache outage must not prevent mail access. */ }
  const body = await load();
  c.header('X-Mail-Body-Cache', 'MISS');
  const write = async () => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({name: 'AES-GCM', iv, additionalData: encoder.encode(cacheId)}, key, encoder.encode(JSON.stringify(body)));
    await fetch(endpoint, {method: 'PUT', headers, signal: AbortSignal.timeout(3000), body: JSON.stringify({iv: b64(iv), data: b64(new Uint8Array(encrypted))})});
  };
  c.executionCtx.waitUntil(write().catch(() => {}));
  return body;
}
