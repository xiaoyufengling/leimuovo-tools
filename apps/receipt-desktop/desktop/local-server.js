import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"], [".gif", "image/gif"], [".gz", "application/gzip"],
  [".html", "text/html; charset=utf-8"], [".ico", "image/x-icon"], [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"], [".js", "text/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"], [".png", "image/png"], [".svg", "image/svg+xml; charset=utf-8"],
  [".wasm", "application/wasm"], [".webmanifest", "application/manifest+json"],
]);

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self' blob: data:; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

export function resolveAssetPath(root, pathname) {
  let decodedPath;
  try { decodedPath = decodeURIComponent(pathname); } catch { return null; }
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const assetPath = path.resolve(root, relativePath);
  const relation = path.relative(root, assetPath);
  if (relation.startsWith("..") || path.isAbsolute(relation)) return null;
  return assetPath;
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => { server.off("listening", onListening); reject(error); };
    const onListening = () => { server.off("error", onError); resolve(); };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen({ host: "127.0.0.1", port, exclusive: true });
  });
}

export async function startLocalServer(rootDirectory, { preferredPort = 0 } = {}) {
  const root = path.resolve(rootDirectory);
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const assetPath = resolveAssetPath(root, pathname);
    const asset = assetPath ? await stat(assetPath).catch(() => null) : null;
    if (!asset?.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS });
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Length": asset.size,
      "Content-Type": CONTENT_TYPES.get(path.extname(assetPath).toLowerCase()) ?? "application/octet-stream",
      ...SECURITY_HEADERS,
    });
    createReadStream(assetPath).pipe(response);
  });
  try {
    await listen(server, preferredPort);
  } catch (error) {
    if (preferredPort === 0 || error?.code !== "EADDRINUSE") throw error;
    await listen(server, 0);
  }
  const address = server.address();
  return {
    origin: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections?.();
    }),
  };
}
