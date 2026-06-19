import fs from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const root = process.cwd();
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function serveFile(request, response) {
  const url = new URL(request.url, "http://127.0.0.1");
  if (url.pathname === "/favicon.ico") {
    response.writeHead(204);
    response.end();
    return;
  }
  const safePath = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(root, safePath === path.sep ? "index.html" : safePath);
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

async function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

async function checkViewport(browser, baseUrl, viewport, label) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const result = await page.evaluate(() => {
    const canvas = document.getElementById("simCanvas");
    const ctx = canvas.getContext("2d");
    const data = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
    return {
      width: canvas.width,
      height: canvas.height,
      pixelSum: data[0] + data[1] + data[2] + data[3],
      fps: document.getElementById("fpsLabel").textContent,
      particles: document.getElementById("particleLabel").textContent
    };
  });
  await page.screenshot({ path: path.join(root, "artifacts", `smoke-${label}.png`), fullPage: true });
  await page.close();
  if (errors.length) {
    throw new Error(`${label} console errors:\n${errors.join("\n")}`);
  }
  if (result.width < 80 || result.height < 60 || result.pixelSum <= 0) {
    throw new Error(`${label} canvas did not render correctly: ${JSON.stringify(result)}`);
  }
  return { label, ...result };
}

fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
const server = http.createServer(serveFile);
const port = await listen(server);
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || "";
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {})
});

try {
  const baseUrl = `http://127.0.0.1:${port}/index.html`;
  const desktop = await checkViewport(browser, baseUrl, { width: 1280, height: 820 }, "desktop");
  const mobile = await checkViewport(browser, baseUrl, { width: 390, height: 844, isMobile: true }, "mobile");
  console.log(JSON.stringify({ baseUrl, checks: [desktop, mobile] }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
