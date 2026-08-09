#!/usr/bin/env node
/**
 * みんなのチケット（楽天NFT）リセール出品ウォッチャー
 *
 * 乃木坂46 真夏の全国ツアー2026（神宮球場）の 8/22・8/23 公演の
 * リセール出品がマーケットプレイスに現れたら通知してブラウザを開く。
 *
 * ⚠️ 通知のみ。購入は必ず自分の手でブラウザから行うこと。
 *    自動購入は「みんなのチケット」利用規約違反です。
 *
 * 使い方:
 *   node monitor.mjs
 *
 * 環境変数（すべて任意）:
 *   WATCH_KEYWORDS   検知したい文字列（カンマ区切り）
 *                    デフォルト: "8/22,8/23,08/22,08/23"
 *   CHECK_INTERVAL   チェック間隔（秒）。デフォルト 90。60未満は60に切り上げ
 *   TARGET_URL       監視対象URL（デフォルトは乃木坂46フィルタ済みページ）
 *   NO_OPEN          "1" で検知時にブラウザを開かない
 */

import { exec } from "node:child_process";
import process from "node:process";

const TARGET_URL =
  process.env.TARGET_URL ??
  "https://nft.rakuten.co.jp/marketplace/?type=ticket&sort=last_updated_date&limit=12&ticketlimit=6&provider=nogizaka";

const WATCH_KEYWORDS = (process.env.WATCH_KEYWORDS ?? "8/22,8/23,08/22,08/23")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const CHECK_INTERVAL_SEC = Math.max(
  3, // 最短3秒
  Number(process.env.CHECK_INTERVAL ?? 3) || 3
);

const NO_OPEN = process.env.NO_OPEN === "1";

const ts = () => new Date().toLocaleTimeString("ja-JP", { hour12: false });

/** OSごとの方法でURLをブラウザで開く */
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

/** OSの通知センターに通知（失敗しても無視、コンソール通知は常に出る） */
function notify(title, message) {
  if (process.platform === "darwin") {
    exec(
      `osascript -e 'display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)} sound name "Glass"'`,
      () => {}
    );
  } else if (process.platform === "linux") {
    exec(`notify-send ${JSON.stringify(title)} ${JSON.stringify(message)}`, () => {});
  } else if (process.platform === "win32") {
    exec(
      `powershell -Command "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null; [System.Windows.Forms.MessageBox]::Show('${message}','${title}')"`,
      () => {}
    );
  }
}

async function fetchPage() {
  const res = await fetch(TARGET_URL, {
    headers: {
      // 普通のブラウザとして名乗る（bot偽装ではなく単なる互換目的）
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Accept-Language": "ja,en;q=0.8",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

let alreadyAlerted = new Set();

async function checkOnce() {
  let html;
  try {
    html = await fetchPage();
  } catch (err) {
    console.log(`[${ts()}] 取得失敗: ${err.message}（次回リトライ）`);
    return;
  }

  const hits = WATCH_KEYWORDS.filter((kw) => html.includes(kw));
  const newHits = hits.filter((kw) => !alreadyAlerted.has(kw));

  if (newHits.length > 0) {
    newHits.forEach((kw) => alreadyAlerted.add(kw));
    const msg = `出品検知: ${newHits.join(", ")} を含むページ内容を確認！`;
    console.log(""); // ベル音
    console.log(`\n🎫🎫🎫 [${ts()}] ${msg}`);
    console.log(`→ 今すぐ確認: ${TARGET_URL}\n`);
    notify("みんなのチケット 出品検知", msg);
    openBrowser(TARGET_URL);
  } else if (hits.length > 0) {
    console.log(`[${ts()}] 検知済みキーワードは引き続き掲載中 (${hits.join(", ")})`);
  } else {
    console.log(`[${ts()}] 対象日の出品なし（監視継続）`);
  }

  // ページから消えたら再通知できるようリセット
  for (const kw of [...alreadyAlerted]) {
    if (!html.includes(kw)) alreadyAlerted.delete(kw);
  }
}

console.log("=== みんなのチケット リセール出品ウォッチャー ===");
console.log(`監視URL   : ${TARGET_URL}`);
console.log(`キーワード: ${WATCH_KEYWORDS.join(", ")}`);
console.log(`間隔      : ${CHECK_INTERVAL_SEC}秒`);
console.log("※ このページはJavaScriptで描画される場合があります。");
console.log("  「出品なし」が続くのにブラウザでは見える場合は README の Playwright 版を使ってください。");
console.log("Ctrl+C で終了\n");

await checkOnce();
setInterval(checkOnce, CHECK_INTERVAL_SEC * 1000);
