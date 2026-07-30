const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "src", "index.html"), "utf8");
const renderer = fs.readFileSync(path.join(root, "src", "renderer.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "src", "styles.css"), "utf8");

test("stock code input stays outside the draggable titlebar", () => {
  assert.match(
    styles,
    /\.titlebar\s*\{[\s\S]*?inset:\s*0 auto auto 0;[\s\S]*?width:\s*188px;/
  );
  assert.match(
    styles,
    /\.toolbar\s*\{[\s\S]*?-webkit-app-region:\s*drag;/
  );
  assert.match(
    styles,
    /\.search-box,\s*\.toolbar button,[\s\S]*?-webkit-app-region:\s*no-drag;/
  );
});

test("stock code input replaces the default and accepts six digits", () => {
  assert.match(html, /id="stock-code"[\s\S]*?maxlength="6"/);
  assert.match(renderer, /stockCodeInput\.addEventListener\("focus"/);
  assert.match(renderer, /replace\(\/\\D\/g, ""\)\.slice\(0, 6\)/);
});

test("demo quotes are limited to browser previews", () => {
  assert.match(
    renderer,
    /const isBrowserPreview = \["http:", "https:"\]\.includes\(window\.location\.protocol\)/
  );
  assert.match(renderer, /if \(!window\.hengce && isBrowserPreview\)/);
  assert.match(renderer, /应用接口初始化失败/);
});

test("market failures are reduced to a friendly message", () => {
  assert.match(renderer, /function friendlyMarketError/);
  assert.match(renderer, /Error invoking remote method/);
  assert.match(renderer, /行情服务暂时无响应，请检查网络后重试/);
  assert.match(renderer, /window\.hengce\.indices\(\)\.catch\(\(\) => \[\]\)/);
});

test("charts wait for visible bounds and observe container resizing", () => {
  assert.match(renderer, /if \(width < 1 \|\| height < 1\) return null/);
  assert.match(renderer, /function schedulePriceChart/);
  assert.match(renderer, /new ResizeObserver/);
});
