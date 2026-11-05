import app from '../hono/hono';
import emailService from '../service/email-service';
import result from '../model/result';
import orm from '../entity/orm';
import email from '../entity/email';
import {getTableColumns, eq, and, ne} from 'drizzle-orm';
import {emailConst} from '../const/entity-const';
import {bodyCache} from '../service/body-cache';

app.get('/allEmail/detail', async (c) => {
    const id = Number(c.req.query('emailId'));
    c.header('Cache-Control', 'private, no-store');
    if (!Number.isSafeInteger(id) || id <= 0) return c.json({code: 400, message: 'Invalid email ID'});
    // Permission middleware runs first; verify the message still exists on every request.
    const {content, text, ...metadata} = getTableColumns(email);
    const row = await orm(c).select(metadata).from(email).where(and(eq(email.emailId, id), ne(email.status, emailConst.status.SAVING))).get();
    if (!row) return c.json({code: 404, message: 'Message no longer available'});
    const body = await bodyCache(c, id, async () => {
        const source = await orm(c).select({content, text}).from(email).where(eq(email.emailId, id)).get();
        return {content: source?.content || '', text: source?.text || ''};
    });
    const full = {...row, ...body};
    await emailService.emailAddAtt(c, [full]);
    return c.json(result.ok(full));
});

app.get('/allEmail/list', async (c) => {
	const data = await emailService.allList(c, c.req.query());
	return c.json(result.ok(data));
})

app.delete('/allEmail/delete', async (c) => {
	const list = await emailService.physicsDelete(c, c.req.query());
	return c.json(result.ok(list));
})

app.delete('/allEmail/batchDelete', async (c) => {
	await emailService.batchDelete(c, c.req.query());
	return c.json(result.ok());
})

app.get('/allEmail/latest', async (c) => {
	const list = await emailService.allEmailLatest(c, c.req.query());
	return c.json(result.ok(list));
})
