import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
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

const port = Number(process.env.LOCAL_API_PORT || 8787);

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

const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url || '/', `http://127.0.0.1:${port}`).pathname;
    if (!pathname.startsWith('/api/')) {
      writeJson(res, 404, { error: 'Local API route not found.' });
      return;
    }
    const functionName = pathname.slice('/api/'.length).split('/')[0];
    const handler = handlers[functionName];
    if (!handler) {
      writeJson(res, 404, { error: `Unknown local API function: ${functionName || '(missing)'}` });
      return;
    }
    const response = await handler(await toRequest(req));
    if (!(response instanceof Response)) {
      writeJson(res, 500, { error: `Local API function ${functionName} did not return a Response.` });
      return;
    }
    await writeResponse(response, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Local API request failed.';
    console.error(`[local-api] ${message}`);
    writeJson(res, 500, { error: message });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[local-api] listening on http://127.0.0.1:${port}`);
});
