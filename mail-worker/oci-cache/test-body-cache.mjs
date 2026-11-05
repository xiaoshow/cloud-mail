import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bodyCache} from '../src/service/body-cache.js';

test('encrypted cache round trip, isolation and outage fallback', async () => {
  const real = globalThis.fetch;
  const objects = new Map();
  const pending = [];
  const headers = {};
  let loads = 0;
  const c = {env: {BODY_CACHE_URL: 'https://example.invalid/objects', BODY_CACHE_SECRET: 'test-secret-only'}, header: (k,v) => headers[k]=v, executionCtx: {waitUntil: p => pending.push(p)}};
  const load = async () => {loads++; return {content: '<p>private synthetic mail</p>', text: 'test'};};
  globalThis.fetch = async (url, opts) => {
    if (opts.method === 'PUT') {objects.set(url, opts.body); return new Response(null,{status:204});}
    return objects.has(url) ? new Response(objects.get(url)) : new Response(null,{status:404});
  };
  try {
    assert.deepEqual(await bodyCache(c, 1, load), await Promise.resolve({content:'<p>private synthetic mail</p>',text:'test'}));
    await Promise.all(pending);
    assert(![...objects.values()][0].includes('private synthetic mail'));
    await bodyCache(c, 1, load); assert.equal(loads,1); assert.equal(headers['X-Mail-Body-Cache'],'HIT');
    await bodyCache(c, 2, load); assert.equal(loads,2);
    globalThis.fetch = async () => {throw new Error('offline');};
    await bodyCache(c, 1, load); assert.equal(loads,3);
    await Promise.all(pending);
  } finally {globalThis.fetch=real;}
});
