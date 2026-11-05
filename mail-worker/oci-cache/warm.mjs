import {bodyCache} from '../src/service/body-cache.js';

const env = process.env;
const base = 'https://api.cloudflare.com/client/v4/accounts/' + env.CLOUDFLARE_ACCOUNT_ID;
const response = await fetch(base + '/d1/database/94479ed9-97e3-4995-95a9-46347670bd1d/query', {
  method: 'POST', headers: {Authorization: 'Bearer ' + env.CLOUDFLARE_API_TOKEN, 'Content-Type':'application/json'},
  body: JSON.stringify({sql: 'SELECT email_id, content, text FROM email WHERE type=0 ORDER BY email_id DESC LIMIT 30'}),
});
const result = await response.json();
if (!result.success) throw new Error('D1 warm-up query failed');
const rows = result.result[0].results;
let warmed = 0;
for (let i = 0; i < rows.length; i += 3) {
  await Promise.all(rows.slice(i,i+3).map(async row => {
    const pending=[];
    const c={env,header:()=>{},executionCtx:{waitUntil:p=>pending.push(p)}};
    await bodyCache(c,row.email_id,async()=>({content:row.content||'',text:row.text||''}));
    await Promise.all(pending);
    warmed++;
  }));
}
console.log('Recent bodies processed:',warmed);
