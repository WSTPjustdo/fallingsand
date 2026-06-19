import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = process.cwd();
const preferredPort = Number.parseInt(process.env.PORT || "5173", 10);
const host = "127.0.0.1";
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png"
};

function writeStatus(port) {
  fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "artifacts", "dev-server.json"),
    JSON.stringify({ url: `http://${host}:${port}/index.html`, port }, null, 2),
    "utf8"
  );
}

function serveFile(request, response) {
  const url = new URL(request.url, `http://${host}`);
  if (url.pathname === "/favicon.ico") {
    response.writeHead(204);
    response.end();
    return;
  }
  const safePath = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  const relativePath = safePath === path.sep || safePath === "/" ? "index.html" : safePath.replace(/^[/\\]/, "");
  const filePath = path.join(root, relativePath);
  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "content-type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
    response.end(data);
  });
}

function listen(port) {
  const server = http.createServer(serveFile);
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      listen(port + 1);
      return;
    }
    throw error;
  });
  server.listen(port, host, () => {
    writeStatus(port);
    console.log(`Serving ${root}`);
    console.log(`URL: http://${host}:${port}/index.html`);
  });
}

listen(preferredPort);
