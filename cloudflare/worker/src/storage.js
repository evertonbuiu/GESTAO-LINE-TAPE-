// Arquivos (logos, fotos, comprovantes, PDFs) no Cloudflare R2, respondendo
// nos mesmos caminhos do Supabase Storage usados pelo supabase-js:
//   POST/PUT /object/<bucket>/<caminho>        enviar
//   GET      /object/public/<bucket>/<caminho> baixar (bucket público)
//   GET      /object/authenticated/<b>/<c>     baixar (logado)
//   GET      /object/<bucket>/<caminho>         baixar (logado)
//   POST     /object/sign/<bucket>/<caminho>    gerar link temporário
//   GET      /object/sign/<bucket>/<c>?token=   baixar com link temporário
//   POST     /object/list/<bucket>              listar
//   DELETE   /object/<bucket>  {prefixes}       apagar
//   POST     /object/move | /object/copy
import { signJwt, verifyJwt } from './crypto.js';
import { ApiError, json, readJson } from './util.js';

// Buckets públicos no sistema original (leitura sem login)
const PUBLIC_BUCKETS = new Set(['logos', 'product-images', 'quote-product-images', 'equipment-images', 'worker-photos', 'budget-pdfs', 'company_files']);

function safePath(p) {
  const path = decodeURIComponent(p || '');
  if (!path || path.includes('..') || path.startsWith('/') || path.includes('\\')) {
    throw new ApiError(400, 'InvalidKey', 'Invalid key');
  }
  return path;
}

function key(bucket, path) {
  return `${bucket}/${path}`;
}

function requireUser(ctx) {
  if (!ctx.uid && !ctx.service) throw new ApiError(403, 'Unauthorized', 'new row violates row-level security policy');
}

async function putObject(request, env, db, ctx, bucket, path, upsert) {
  requireUser(ctx);
  const k = key(bucket, path);
  if (!upsert) {
    const exists = await env.FILES.head(k);
    if (exists) return json({ statusCode: '409', error: 'Duplicate', message: 'The resource already exists' }, 400);
  }
  let body;
  let contentType = request.headers.get('Content-Type') || 'application/octet-stream';
  if (contentType.startsWith('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('') || [...form.values()].find((v) => typeof v === 'object');
    body = await file.arrayBuffer();
    contentType = file.type || 'application/octet-stream';
  } else {
    body = await request.arrayBuffer();
  }
  await env.FILES.put(k, body, { httpMetadata: { contentType } });
  await db.d1
    .prepare(
      `INSERT INTO storage_objects (bucket_id, name, content_type, size, owner) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (bucket_id, name) DO UPDATE SET content_type = excluded.content_type, size = excluded.size,
       updated_at = strftime('%Y-%m-%dT%H:%M:%f+00:00','now')`,
    )
    .bind(bucket, path, contentType, body.byteLength, ctx.uid ?? null)
    .run();
  return json({ Key: k, Id: k, path });
}

async function getObject(env, bucket, path) {
  const obj = await env.FILES.get(key(bucket, path));
  if (!obj) return json({ statusCode: '404', error: 'not_found', message: 'Object not found' }, 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('Cache-Control', 'max-age=3600');
  return new Response(obj.body, { headers });
}

export async function handleStorage(request, env, db, ctx, rest) {
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  let m;

  if ((m = rest.match(/^object\/public\/([^/]+)\/(.+)$/)) && method === 'GET') {
    const [, bucket, p] = m;
    if (!PUBLIC_BUCKETS.has(bucket)) throw new ApiError(400, 'not_found', 'Bucket not found or not public');
    return getObject(env, bucket, safePath(p));
  }

  if ((m = rest.match(/^object\/sign\/([^/]+)\/(.+)$/))) {
    const [, bucket, p] = m;
    const path = safePath(p);
    if (method === 'GET') {
      const tok = url.searchParams.get('token');
      const payload = await verifyJwt(tok, env.JWT_SECRET).catch(() => null);
      if (!payload || payload.url !== key(bucket, path)) throw new ApiError(400, 'InvalidSignature', 'Invalid signature');
      return getObject(env, bucket, path);
    }
    if (method === 'POST') {
      requireUser(ctx);
      const body = (await readJson(request)) || {};
      const expiresIn = Number(body.expiresIn || 3600);
      const token = await signJwt({ url: key(bucket, path), exp: Math.floor(Date.now() / 1000) + expiresIn }, env.JWT_SECRET);
      return json({ signedURL: `/object/sign/${bucket}/${encodeURI(path)}?token=${token}` });
    }
  }

  if ((m = rest.match(/^object\/sign\/([^/]+)$/)) && method === 'POST') {
    // createSignedUrls (vários de uma vez)
    requireUser(ctx);
    const bucket = m[1];
    const body = (await readJson(request)) || {};
    const expiresIn = Number(body.expiresIn || 3600);
    const out = [];
    for (const p of body.paths || []) {
      const token = await signJwt({ url: key(bucket, p), exp: Math.floor(Date.now() / 1000) + expiresIn }, env.JWT_SECRET);
      out.push({ path: p, signedURL: `/object/sign/${bucket}/${encodeURI(p)}?token=${token}`, error: null });
    }
    return json(out);
  }

  if ((m = rest.match(/^object\/list\/([^/]+)$/)) && method === 'POST') {
    const bucket = m[1];
    // buckets públicos (ex.: logo na tela de login) podem ser listados sem login
    if (!PUBLIC_BUCKETS.has(bucket)) requireUser(ctx);
    const body = (await readJson(request)) || {};
    const prefix = (body.prefix || '').replace(/^\/+|\/+$/g, '');
    const limit = Number(body.limit || 100);
    const offset = Number(body.offset || 0);
    const like = prefix ? prefix + '/%' : '%';
    const rows = await db.all(
      `SELECT name, content_type, size, created_at, updated_at FROM storage_objects
        WHERE bucket_id = ? AND name LIKE ? ORDER BY name LIMIT ? OFFSET ?`,
      [bucket, like, limit + 1000, offset],
    );
    const seen = new Set();
    const out = [];
    const search = (body.search || '').toLowerCase();
    for (const r of rows) {
      const rel = prefix ? r.name.slice(prefix.length + 1) : r.name;
      const slash = rel.indexOf('/');
      if (slash >= 0) {
        const folder = rel.slice(0, slash);
        if (!seen.has(folder)) {
          seen.add(folder);
          out.push({ name: folder, id: null, updated_at: null, created_at: null, last_accessed_at: null, metadata: null });
        }
        continue;
      }
      if (search && !rel.toLowerCase().includes(search)) continue;
      out.push({
        name: rel,
        id: key(bucket, r.name),
        updated_at: r.updated_at,
        created_at: r.created_at,
        last_accessed_at: r.updated_at,
        metadata: { size: r.size, mimetype: r.content_type },
      });
    }
    return json(out.slice(0, limit));
  }

  if (rest === 'object/move' || rest === 'object/copy') {
    requireUser(ctx);
    const body = (await readJson(request)) || {};
    const src = key(body.bucketId, safePath(body.sourceKey));
    const dstBucket = body.destinationBucket || body.bucketId;
    const dst = key(dstBucket, safePath(body.destinationKey));
    const obj = await env.FILES.get(src);
    if (!obj) throw new ApiError(404, 'not_found', 'Object not found');
    await env.FILES.put(dst, obj.body, { httpMetadata: obj.httpMetadata });
    await db.d1
      .prepare(`INSERT OR REPLACE INTO storage_objects (bucket_id, name, content_type, size, owner)
                SELECT ?, ?, content_type, size, ? FROM storage_objects WHERE bucket_id = ? AND name = ?`)
      .bind(dstBucket, body.destinationKey, ctx.uid ?? null, body.bucketId, body.sourceKey)
      .run();
    if (rest === 'object/move') {
      await env.FILES.delete(src);
      await db.d1.prepare('DELETE FROM storage_objects WHERE bucket_id = ? AND name = ?').bind(body.bucketId, body.sourceKey).run();
      return json({ message: 'Successfully moved' });
    }
    return json({ Key: dst });
  }

  if ((m = rest.match(/^object\/([^/]+)$/)) && method === 'DELETE') {
    requireUser(ctx);
    const bucket = m[1];
    const body = (await readJson(request)) || {};
    const out = [];
    for (const p of body.prefixes || []) {
      const path = safePath(p);
      await env.FILES.delete(key(bucket, path));
      await db.d1.prepare('DELETE FROM storage_objects WHERE bucket_id = ? AND name = ?').bind(bucket, path).run();
      out.push({ name: path, bucket_id: bucket });
    }
    return json(out);
  }

  if ((m = rest.match(/^object\/(?:authenticated\/)?([^/]+)\/(.+)$/))) {
    const [, bucket, p] = m;
    const path = safePath(p);
    if (method === 'GET' || method === 'HEAD') {
      if (!PUBLIC_BUCKETS.has(bucket)) requireUser(ctx);
      return getObject(env, bucket, path);
    }
    if (method === 'POST' || method === 'PUT') {
      const upsert = method === 'PUT' || request.headers.get('x-upsert') === 'true';
      return putObject(request, env, db, ctx, bucket, path, upsert);
    }
  }

  if (rest === 'bucket' && method === 'GET') {
    return json([...PUBLIC_BUCKETS].map((id) => ({ id, name: id, public: true })));
  }

  throw new ApiError(404, 'not_found', 'Rota de arquivos não encontrada');
}
