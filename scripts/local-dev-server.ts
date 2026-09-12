import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { loadEnvFile } from 'node:process';
import { createServer as createViteServer, type ViteDevServer } from 'vite';
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

try {
  loadEnvFile('.env');
} catch {
  // StackBlitz may inject environment variables without a physical .env file.
}

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
let vite: ViteDevServer | undefined;

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
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function handleApi(req: IncomingMessage, res: ServerResponse, pathname: string) {
  const functionName = pathname.slice('/api/'.length).split('/')[0];
  const handler = handlers[functionName];
  if (!handler) {
    writeJson(res, 404, { error: `Unknown local API function: ${functionName || '(missing)'}` });
    return;
  }

  try {
    const response = await handler(await toRequest(req));
    if (!(response instanceof Response)) {
      writeJson(res, 500, { error: `Local API function ${functionName} did not return a Response.` });
      return;
    }
    await writeResponse(response, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Local API request failed.';
    console.error(`[local-dev] ${message}`);
    writeJson(res, 500, { error: message });
  }
}

const server = createHttpServer(async (req, res) => {
  const pathname = new URL(req.url || '/', `http://127.0.0.1:${port}`).pathname;
  if (pathname.startsWith('/api/')) {
    await handleApi(req, res, pathname);
    return;
  }

  if (!vite) {
    writeJson(res, 503, { error: 'Vite dev middleware is still starting.' });
    return;
  }

  vite.middlewares(req, res, error => {
    if (!error || res.writableEnded) return;
    vite?.ssrFixStacktrace(error);
    console.error(error);
    writeJson(res, 500, { error: 'Local frontend request failed.' });
  });
});

vite = await createViteServer({
  server: {
    middlewareMode: true,
    ws: { server },
  },
  appType: 'spa',
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[local-dev] app + API listening on http://localhost:${port}`);
});

const shutdown = async () => {
  await vite?.close();
  server.close(() => process.exit(0));
};

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
