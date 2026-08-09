#!/usr/bin/env node
/**
 * みんなのチケット リセール出品ウォッチャー（ブラウザ版）
 *
 * marketplace ページは JavaScript で描画されるため、単純な fetch では
 * 出品リストが取れないことがある。この版は Playwright で実際にページを
 * レンダリングしてからキーワードを探す。
 *
 * ⚠️ 通知のみ。購入は必ず自分の手で行うこと（自動購入は規約違反）。
 *
 * 準備:
 *   cd ticket-monitor
 *   npm install
 *   npx playwright install chromium
 *
 * 使い方:
 *   node monitor-browser.mjs
 *
 * 環境変数は monitor.mjs と同じ（WATCH_KEYWORDS / CHECK_INTERVAL / TARGET_URL / NO_OPEN）。
 */

import { exec } from "node:child_process";
import process from "node:process";
import { chromium } from "playwright";

const TARGET_URL =
  process.env.TARGET_URL ??
  "https://nft.rakuten.co.jp/marketplace/?type=ticket&sort=last_updated_date&limit=12&ticketlimit=6&provider=nogizaka";

const WATCH_KEYWORDS = (process.env.WATCH_KEYWORDS ?? "8/22,8/23,08/22,08/23")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const CHECK_INTERVAL_SEC = Math.max(60, Number(process.env.CHECK_INTERVAL ?? 90) || 90);
const NO_OPEN = process.env.NO_OPEN === "1";

const ts = () => new Date().toLocaleTimeString("ja-JP", { hour12: false });

function openBrowser(url) {
  if (NO_OPEN) return;
  const cmd =
    process.platform === "darwin"
      ? `open "${url}"`
      : process.platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function notify(title, message) {
  if (process.platform === "darwin") {
    exec(
      `osascript -e 'display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)} sound name "Glass"'`,
      () => {}
    );
  } else if (process.platform === "linux") {
    exec(`notify-send ${JSON.stringify(title)} ${JSON.stringify(message)}`, () => {});
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "ja-JP" });
const page = await context.newPage();

let alreadyAlerted = new Set();

async function checkOnce() {
  let text;
  try {
    await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 45_000 });
    text = await page.evaluate(() => document.body.innerText);
  } catch (err) {
    console.log(`[${ts()}] 取得失敗: ${err.message}（次回リトライ）`);
    return;
  }

  const hits = WATCH_KEYWORDS.filter((kw) => text.includes(kw));
  const newHits = hits.filter((kw) => !alreadyAlerted.has(kw));

  if (newHits.length > 0) {
    newHits.forEach((kw) => alreadyAlerted.add(kw));
    const msg = `出品検知: ${newHits.join(", ")}`;
    console.log("");
    console.log(`\n🎫🎫🎫 [${ts()}] ${msg}`);
    console.log(`→ 今すぐ確認: ${TARGET_URL}\n`);
    notify("みんなのチケット 出品検知", msg);
    openBrowser(TARGET_URL);
  } else if (hits.length > 0) {
    console.log(`[${ts()}] 検知済みキーワードは引き続き掲載中 (${hits.join(", ")})`);
  } else {
    console.log(`[${ts()}] 対象日の出品なし（監視継続）`);
  }

  for (const kw of [...alreadyAlerted]) {
    if (!text.includes(kw)) alreadyAlerted.delete(kw);
  }
}

console.log("=== みんなのチケット リセール出品ウォッチャー（ブラウザ版） ===");
console.log(`監視URL   : ${TARGET_URL}`);
console.log(`キーワード: ${WATCH_KEYWORDS.join(", ")}`);
console.log(`間隔      : ${CHECK_INTERVAL_SEC}秒`);
console.log("Ctrl+C で終了\n");

await checkOnce();
setInterval(checkOnce, CHECK_INTERVAL_SEC * 1000);
