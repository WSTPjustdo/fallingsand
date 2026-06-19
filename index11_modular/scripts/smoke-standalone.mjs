import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const root = process.cwd();
const fileName = process.argv[2] || "index11_mobile_ready_standalone.html";
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || "";
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {})
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(pathToFileURL(path.join(root, fileName)).href, { waitUntil: "load" });
  await page.waitForTimeout(900);
  const result = await page.evaluate(() => {
    const canvas = document.getElementById("simCanvas");
    const ctx = canvas.getContext("2d");
    const data = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
    return {
      width: canvas.width,
      height: canvas.height,
      pixelSum: data[0] + data[1] + data[2] + data[3],
      fps: document.getElementById("fpsLabel").textContent
    };
  });
  if (errors.length) {
    throw new Error(errors.join("\n"));
  }
  if (result.width < 80 || result.height < 60 || result.pixelSum <= 0) {
    throw new Error(`Canvas did not render: ${JSON.stringify(result)}`);
  }
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
