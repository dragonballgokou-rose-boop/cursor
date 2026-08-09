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

// 公演行は「〔8/20(木)｜東京〕 乃木坂46 …」形式なので、曜日付きで判定して
// 「販売終了日時: 2026/08/22」のような日付表記への誤検知を防ぐ
const WATCH_KEYWORDS = (process.env.WATCH_KEYWORDS ?? "8/22(土),8/23(日),8/22（土）,8/23（日）")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// 最短3秒。前回チェック完了から次の開始までの待ち時間（重複実行はしない）
const CHECK_INTERVAL_SEC = Math.max(3, Number(process.env.CHECK_INTERVAL ?? 3) || 3);
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "ja-JP" });
const page = await context.newPage();

// 画像・動画・フォント・広告系はブロックして読み込みを高速化
await page.route("**/*", (route) => {
  const type = route.request().resourceType();
  if (["image", "media", "font"].includes(type)) return route.abort();
  return route.continue();
});

let alreadyAlerted = new Set();
let checkCount = 0;

async function getPageText() {
  // networkidle は楽天のページでは永遠に来ない（計測通信が続く）ので使わない。
  // DOM構築後、出品リストの描画を最大10秒待つ。
  await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
  try {
    await page.waitForFunction(
      () => /販売中|アイテム|乃木坂/.test(document.body.innerText),
      { timeout: 10_000 }
    );
  } catch {
    // リストが読めなくても本文で判定は試みる
  }
  return page.evaluate(() => document.body.innerText);
}

async function checkOnce() {
  checkCount++;
  let text;
  try {
    text = await getPageText();
  } catch (err) {
    console.log(`[${ts()}] 取得失敗: ${err.message.split("\n")[0]}（次回リトライ）`);
    return;
  }

  const hits = WATCH_KEYWORDS.filter((kw) => text.includes(kw));
  const newHits = hits.filter((kw) => !alreadyAlerted.has(kw));

  if (newHits.length > 0) {
    newHits.forEach((kw) => alreadyAlerted.add(kw));
    const msg = `出品検知: ${newHits.join(", ")}`;
    console.log("");
    console.log(`\n🎫🎫🎫 [${ts()}] ${msg}`);
    // 誤検知かどうか確認できるよう、ヒットした行を表示する
    const lines = text.split("\n");
    for (const kw of newHits) {
      lines
        .filter((l) => l.includes(kw))
        .slice(0, 3)
        .forEach((l) => console.log(`   ヒット行: ${l.trim()}`));
    }
    console.log(`→ 今すぐ確認: ${TARGET_URL}\n`);
    notify("みんなのチケット 出品検知", msg);
    openBrowser(TARGET_URL);
  } else if (hits.length > 0) {
    if (checkCount % 10 === 1) {
      console.log(`[${ts()}] 検知済みキーワードは引き続き掲載中 (${hits.join(", ")})`);
    }
  } else if (checkCount % 10 === 1) {
    // 短い間隔でもログが溢れないよう10回に1回だけ状況を出す
    console.log(`[${ts()}] 対象日の出品なし（監視継続・${checkCount}回チェック済み）`);
  }

  for (const kw of [...alreadyAlerted]) {
    if (!text.includes(kw)) alreadyAlerted.delete(kw);
  }
}

console.log("=== みんなのチケット リセール出品ウォッチャー（ブラウザ版） ===");
console.log(`監視URL   : ${TARGET_URL}`);
console.log(`キーワード: ${WATCH_KEYWORDS.join(", ")}`);
console.log(`間隔      : 前回完了から${CHECK_INTERVAL_SEC}秒後に次をチェック`);
console.log("Ctrl+C で終了\n");

// setInterval だとチェックが重なって多重アクセスになるため、
// 「完了 → 待つ → 次」の直列ループにする
while (true) {
  await checkOnce();
  await sleep(CHECK_INTERVAL_SEC * 1000);
}
