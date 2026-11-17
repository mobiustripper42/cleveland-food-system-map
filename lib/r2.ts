import 'server-only';
import { AwsClient } from 'aws4fetch';

/**
 * Cloudflare R2 over its S3 API. Uploads go straight from the browser with a
 * presigned PUT (files never pass through Vercel); the server only signs,
 * verifies (HEAD), lists, and deletes. Public reads use R2_PUBLIC_BASE_URL.
 */

const client = new AwsClient({
  accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  service: 's3',
  region: 'auto',
});

function objectUrl(key = ''): URL {
  const base = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}`;
  // Keys are server-generated ([A-Za-z0-9/_.-]); encode segments anyway.
  return new URL(
    key ? `${base}/${key.split('/').map(encodeURIComponent).join('/')}` : base,
  );
}

/** Keys are never reused, so objects can be cached forever. */
export const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

/**
 * A PUT URL valid for 10 minutes. Content-Type and Cache-Control are signed,
 * so the browser must send exactly these headers. Size isn't signable here —
 * callers verify it with headObject() after the upload.
 */
export async function presignPut(
  key: string,
  contentType: string,
): Promise<{ url: string; headers: Record<string, string> }> {
  const url = objectUrl(key);
  url.searchParams.set('X-Amz-Expires', '600');
  const headers = {
    'content-type': contentType,
    'cache-control': IMMUTABLE_CACHE,
  };
  const signed = await client.sign(url.toString(), {
    method: 'PUT',
    headers,
    aws: { signQuery: true, allHeaders: true },
  });
  return { url: signed.url, headers };
}

/** Size and type of a stored object, or null if it doesn't exist. */
export async function headObject(
  key: string,
): Promise<{ bytes: number; contentType: string } | null> {
  const res = await client.fetch(objectUrl(key).toString(), { method: 'HEAD' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 HEAD ${key}: ${res.status}`);
  return {
    bytes: Number(res.headers.get('content-length') ?? 0),
    contentType: res.headers.get('content-type') ?? '',
  };
}

/** Every object under `prefix` (paginates ListObjectsV2). */
export async function listObjects(
  prefix: string,
): Promise<{ key: string; lastModified: number }[]> {
  const out: { key: string; lastModified: number }[] = [];
  let token: string | null = null;
  do {
    const url = objectUrl();
    url.searchParams.set('list-type', '2');
    url.searchParams.set('prefix', prefix);
    if (token) url.searchParams.set('continuation-token', token);
    const res = await client.fetch(url.toString());
    if (!res.ok) throw new Error(`R2 list ${prefix}: ${res.status}`);
    const xml = await res.text();
    for (const [, body] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = body!.match(/<Key>([^<]*)<\/Key>/)?.[1];
      const modified = body!.match(
        /<LastModified>([^<]*)<\/LastModified>/,
      )?.[1];
      if (key)
        out.push({
          key: unescapeXml(key),
          lastModified: Date.parse(modified ?? '') || 0,
        });
    }
    const next = /<IsTruncated>true<\/IsTruncated>/.test(xml)
      ? xml.match(
          /<NextContinuationToken>([^<]*)<\/NextContinuationToken>/,
        )?.[1]
      : undefined;
    token = next ? unescapeXml(next) : null;
  } while (token);
  return out;
}

/** Deletes keys; a missing key is not an error. */
export async function deleteObjects(keys: string[]): Promise<void> {
  const results = await Promise.all(
    keys.map((key) =>
      client
        .fetch(objectUrl(key).toString(), { method: 'DELETE' })
        .then((res) => ({ key, res })),
    ),
  );
  const failed = results.filter(({ res }) => !res.ok && res.status !== 404);
  if (failed.length) {
    throw new Error(
      `R2 delete failed: ${failed.map((f) => `${f.key} (${f.res.status})`).join(', ')}`,
    );
  }
}

/** Presigned PUTs expire after this; older strays can't still be in flight. */
const UPLOAD_WINDOW_MS = 15 * 60 * 1000;

/**
 * Cleans one location+type prefix after the DB is committed: deletes `remove`
 * (the files just replaced) and any stray object not in `keep` that is older
 * than an upload window (abandoned uploads). Young strays are left alone so a
 * concurrent upload that hasn't finished yet isn't pulled out from under it.
 * Logs instead of throwing — the DB is already right, and the next sweep of
 * the prefix retries.
 */
export async function sweepPrefix(
  prefix: string,
  { keep = [], remove = [] }: { keep?: string[]; remove?: string[] },
): Promise<void> {
  try {
    const cutoff = Date.now() - UPLOAD_WINDOW_MS;
    const strays = (await listObjects(prefix))
      .filter((o) => o.lastModified < cutoff)
      .map((o) => o.key);
    const targets = [...new Set([...remove, ...strays])].filter(
      (k) => k.startsWith(prefix) && !keep.includes(k),
    );
    if (targets.length) await deleteObjects(targets);
  } catch (err) {
    console.error('R2 sweep failed', prefix, err);
  }
}

export function publicFileUrl(key: string): string {
  return `${process.env.R2_PUBLIC_BASE_URL}/${key}`;
}

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
