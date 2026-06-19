import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputName = process.argv[2] || "standalone.html";

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function stripModuleSyntax(code) {
  return code
    .replace(/^export const /gm, "const ")
    .replace(/^export class /gm, "class ")
    .replace(/^export function /gm, "function ")
    .replace(/\nexport\s+\{[\s\S]*?\};\s*$/m, "\n");
}

const modules = [
  "src/config/materials.js",
  "src/config/levels.js",
  "src/engine/Simulation.js",
  "src/engine/Reactions.js",
  "src/renderer/CanvasRenderer.js",
  "src/ui/UIManager.js"
].map((file) => `\n/* ${file} */\n${stripModuleSyntax(read(file))}`);

let main = read("src/main.js");
main = main.replace(/^import[\s\S]*?\n\n(?=var requestFrame)/, "");

const bundle = `"use strict";\n(function () {\n${modules.join("\n")}\n\n/* src/main.js */\n${main}\n})();\n`;
const html = read("index.html");
const scriptStart = html.lastIndexOf("  <script>");
const scriptEnd = html.indexOf("</script>", scriptStart);

if (scriptStart === -1 || scriptEnd === -1) {
  throw new Error("Could not find final script block in index.html");
}

const standalone = `${html.slice(0, scriptStart)}  <script>\n${bundle
  .split("\n")
  .map((line) => `    ${line}`)
  .join("\n")}\n  </script>${html.slice(scriptEnd + "</script>".length)}`;

const outputPath = path.join(root, outputName);
fs.writeFileSync(outputPath, standalone, "utf8");
console.log(outputPath);
