import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, ViteDevServer } from 'vite';

const prefix = '/.netlify/functions/';
const handlers: Record<string, string> = {
  'program': '/netlify/functions/program.ts',
  'roster-import': '/netlify/functions/roster-import.ts',
  'schedule-import': '/netlify/functions/schedule-import.ts',
  'match-import-url': '/netlify/functions/match-import-url.ts',
  'match-import-file': '/netlify/functions/match-import-file.ts',
  'coaches-edge-query': '/netlify/functions/coaches-edge-query.ts',
  'roster': '/netlify/functions/roster.ts',
  'schedule': '/netlify/functions/schedule.ts',
  'matches': '/netlify/functions/matches.ts',
  'match-summary': '/netlify/functions/match-summary.ts',
};

async function requestBody(req: IncomingMessage): Promise<Buffer | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

function requestHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach(item => headers.append(key, item));
    else headers.set(key, value);
  }
  return headers;
}

async function toWebRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host || 'localhost:5173';
  const url = new URL(req.url || '/', `http://${host}`);
  const body = await requestBody(req);
  return new Request(url, {
    method: req.method || 'GET',
    headers: requestHeaders(req),
    body: body as BodyInit | undefined,
  });
}

async function writeWebResponse(response: Response, res: ServerResponse) {
  res.statusCode = response.status;
  for (const [key, value] of response.headers) res.setHeader(key, value);
  const body = Buffer.from(await response.arrayBuffer());
  res.end(body);
}

function writeJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function dispatch(server: ViteDevServer, req: IncomingMessage, res: ServerResponse) {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  const functionName = pathname.slice(prefix.length).split('/')[0];
  const modulePath = handlers[functionName];
  if (!modulePath) {
    writeJson(res, 404, { error: `Unknown local function: ${functionName || '(missing)'}` });
    return;
  }

  const loaded = await server.ssrLoadModule(modulePath);
  if (typeof loaded.default !== 'function') {
    writeJson(res, 500, { error: `Local function ${functionName} has no default handler.` });
    return;
  }
  const response = await loaded.default(await toWebRequest(req));
  if (!(response instanceof Response)) {
    writeJson(res, 500, { error: `Local function ${functionName} did not return a Response.` });
    return;
  }
  await writeWebResponse(response, res);
}

export function localFunctionBridge(): Plugin {
  return {
    name: 'volleyball-local-function-bridge',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url || '/', 'http://localhost').pathname;
        if (!pathname.startsWith(prefix)) return next();
        try {
          await dispatch(server, req, res);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Local function failed.';
          server.config.logger.error(`[local-functions] ${message}`);
          writeJson(res, 500, { error: message });
        }
      });
    },
  };
}
