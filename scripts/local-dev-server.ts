import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { loadEnvFile } from 'node:process';
import program from '../netlify/functions/program.js';
import rosterImport from '../netlify/functions/roster-import.js';
import scheduleImport from '../netlify/functions/schedule-import.js';
import matchImportUrl from '../netlify/functions/match-import-url.js';
import matchImportFile from '../netlify/functions/match-import-file.js';
import coachesEdgeQuery from '../netlify/functions/coaches-edge-query.js';
import roster from '../netlify/functions/roster.js';
import schedule from '../netlify/functions/schedule.js';
import matches from '../netlify/functions/matches.js';
import matchSummary from '../netlify/functions/match-summary.js';
import { runWithUserAccessToken } from '../db/client.js';

try {
  loadEnvFile('.env');
} catch {
  // StackBlitz may inject environment variables without a physical .env file.
}

// StackBlitz/WebContainer development is user-scoped only. Never allow a
// browser-hosted local process to use the privileged Supabase secret key.
process.env.SUPABASE_DB_ACCESS_MODE = 'user-scoped-only';
delete process.env.SUPABASE_SECRET_KEY;

type Handler = (request: Request) => Response | Promise<Response>;

const handlers: Record<string, Handler> = {
  'program': program,
  'roster-import': rosterImport,
  'schedule-import': scheduleImport,
  'match-import-url': matchImportUrl,
  'match-import-file': matchImportFile,
  'coaches-edge-query': coachesEdgeQuery,
  'roster': roster,
  'schedule': schedule,
  'matches': matches,
  'match-summary': matchSummary,
};

const port = Number(process.env.PORT || 5173);
const distDir = resolve(process.cwd(), 'dist');
const indexFile = resolve(distDir, 'index.html');

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

async function readBody(req: IncomingMessage): Promise<Buffer | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

function toHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach(item => headers.append(key, item));
    else headers.set(key, value);
  }
  return headers;
}

async function toRequest(req: IncomingMessage): Promise<Request> {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  const body = await readBody(req);
  return new Request(url, {
    method: req.method || 'GET',
    headers: toHeaders(req),
    body: body as BodyInit | undefined,
  });
}

async function writeResponse(response: Response, res: ServerResponse) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

function writeJson(res: ServerResponse, status: number, payload: unknown) {
  const body = Buffer.from(JSON.stringify(payload));
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('content-length', String(body.length));
  res.end(body);
}

async function handleApi(req: IncomingMessage, res: ServerResponse, pathname: string) {
  const functionName = pathname.slice('/api/'.length).split('/')[0];
  const handler = handlers[functionName];
  if (!handler) {
    writeJson(res, 404, { error: `Unknown local API function: ${functionName || '(missing)'}` });
    return;
  }

  try {
    const request = await toRequest(req);
    const authorization = request.headers.get('authorization') || '';
    const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    const response = accessToken
      ? await runWithUserAccessToken(accessToken, () => handler(request))
      : await handler(request);
    if (!(response instanceof Response)) {
      writeJson(res, 500, { error: `Local API function ${functionName} did not return a Response.` });
      return;
    }
    await writeResponse(response, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Local API request failed.';
    console.error(`[local-dev] API ${functionName}: ${message}`);
    if (!res.headersSent) writeJson(res, 500, { error: message });
    else res.end();
  }
}

function resolveStaticPath(pathname: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }

  const relativePath = decoded.replace(/^\/+/, '');
  const candidate = resolve(distDir, relativePath || 'index.html');
  if (candidate !== distDir && !candidate.startsWith(`${distDir}${sep}`)) return undefined;
  return candidate;
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function sendFile(req: IncomingMessage, res: ServerResponse, filePath: string) {
  const body = await readFile(filePath);
  const extension = extname(filePath).toLowerCase();
  res.statusCode = 200;
  res.setHeader('content-type', contentTypes[extension] || 'application/octet-stream');
  res.setHeader('content-length', String(body.length));
  res.setHeader('cache-control', 'no-store');
  if (req.method === 'HEAD') res.end();
  else res.end(body);
}

async function handleFrontend(req: IncomingMessage, res: ServerResponse, pathname: string) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    writeJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  const candidate = resolveStaticPath(pathname);
  if (!candidate) {
    writeJson(res, 400, { error: 'Invalid local frontend path.' });
    return;
  }

  if (await isFile(candidate)) {
    await sendFile(req, res, candidate);
    return;
  }

  if (extname(pathname)) {
    writeJson(res, 404, { error: 'Local frontend asset not found.' });
    return;
  }

  if (!(await isFile(indexFile))) {
    writeJson(res, 503, { error: 'Local frontend build is missing. Run npm run dev to rebuild dist/.' });
    return;
  }

  await sendFile(req, res, indexFile);
}

const server = createHttpServer(async (req, res) => {
  try {
    const pathname = new URL(req.url || '/', `http://127.0.0.1:${port}`).pathname;
    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname);
      return;
    }
    await handleFrontend(req, res, pathname);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Local request failed.';
    console.error(`[local-dev] ${message}`);
    if (!res.headersSent) writeJson(res, 500, { error: message });
    else res.end();
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[local-dev] static app + API listening on http://localhost:${port}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
