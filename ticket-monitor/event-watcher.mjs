#!/usr/bin/env node
/**
 * 2nds watcher — event-watcher
 * getEventDates/{id} を緩い間隔で叩き、公演日が登録された瞬間に知らせる。
 *
 * みんなのチケットの個人間マーケットプレイスは、リセール受付が始まるまで
 * そのイベントIDの公演日リストが空（200で {}）になっている。
 * リセール開始時刻ちょうどに現れるとは限らないので、ここを見張っておく。
 *
 * 公演日が出たら、そのまま monitor-api.mjs に渡せるコマンドを表示する。
 *
 * 購入操作は一切しない。通知だけ。
 *
 * 使い方:
 *   node event-watcher.mjs              # 1004（乃木坂46）を5分おき
 *   node event-watcher.mjs 1004 60      # IDと間隔（秒）を指定
 *
 * 環境変数:
 *   NTFY_TOPIC   スマホへプッシュ（monitor-api.mjs と同じ）
 *   NO_OPEN=1    ブラウザを開かない
 */

import { exec } from "node:child_process";
import process from "node:process";

const EVENT_ID = process.argv[2] ?? process.env.EVENT_ID ?? "1004";
const INTERVAL_SEC = Math.max(30, Number(process.argv[3] ?? process.env.INTERVAL ?? 300) || 300);
const NTFY_TOPIC = process.env.NTFY_TOPIC ?? "";
const NTFY_SERVER = process.env.NTFY_SERVER ?? "https://ntfy.sh";
const NO_OPEN = process.env.NO_OPEN === "1";

const API = `https://api.nft.rakuten.co.jp/products/v0/mp/tickets/getEventDates/${EVENT_ID}?limit=50`;
const MARKET = "https://nft.rakuten.co.jp/marketplace/?type=ticket&sort=last_updated_date&limit=12&ticketlimit=6&provider=nogizaka";

const HEADERS = {
  Accept: "application/json",
  "Accept-Language": "ja,en;q=0.8",
  Origin: "https://nft.rakuten.co.jp",
  Referer: "https://nft.rakuten.co.jp/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
};

const ts = () => new Date().toLocaleTimeString("ja-JP", { hour12: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function speak(m) {
  if (process.platform === "darwin") exec(`say -v Kyoko ${JSON.stringify(m)}`, () => {});
}
function notify(t, m) {
  if (process.platform === "darwin") {
    exec(`osascript -e 'display notification ${JSON.stringify(m)} with title ${JSON.stringify(t)} sound name "Glass"'`, () => {});
  }
}
function openBrowser(url) {
  if (NO_OPEN) return;
  if (process.platform === "darwin") exec(`open "${url}"`, () => {});
}
function pushPhone(title, message, url) {
  if (!NTFY_TOPIC) return;
  fetch(NTFY_SERVER, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic: NTFY_TOPIC, title, message, click: url, priority: 5, tags: ["ticket"] }),
  }).catch(() => {});
}

/** 応答のどこにあっても公演日時っぽい文字列を拾う */
function extractDates(data) {
  const found = new Set();
  const walk = (v) => {
    if (v == null) return;
    if (typeof v === "string") {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) found.add(v.slice(0, 19));
      return;
    }
    if (Array.isArray(v)) return v.forEach(walk);
    if (typeof v === "object") return Object.values(v).forEach(walk);
  };
  walk(data);
  return [...found].sort();
}

console.log("=== 2nds watcher — event-watcher ===");
console.log(`イベントID: ${EVENT_ID}`);
console.log(`間隔      : ${INTERVAL_SEC}秒`);
console.log(`スマホ通知: ${NTFY_TOPIC ? "ON" : "OFF（NTFY_TOPIC=好きな文字列 で有効）"}`);
console.log("公演日が登録されたら知らせます。購入操作はしません。");
console.log("Ctrl+C で終了\n");

let checks = 0;
let lastCount = -1;

for (;;) {
  checks++;
  try {
    const res = await fetch(API, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const dates = extractDates(data);

    if (dates.length > 0 && dates.length !== lastCount) {
      console.log(`\n🎫🎫🎫 [${ts()}] 公演日が登場しました（${dates.length}件）\n`);
      dates.forEach((d) => console.log(`   ${d}`));
      const targets = dates.map((d) => `${d}=all`).join(",");
      console.log("\n↓ このコマンドで監視を開始できます\n");
      console.log(`SEAT_KEYWORDS="席|スタンディング" MIN_PRICE=0 EXCLUDE_KEYWORDS="" \\`);
      console.log(`  node monitor-api.mjs "${targets}"\n`);
      speak("リセールの公演日が出ました");
      notify("2nds watcher", `公演日 ${dates.length}件が登録されました`);
      pushPhone("🎫 リセール開始", `公演日 ${dates.length}件が登録されました`, MARKET);
      openBrowser(MARKET);
      lastCount = dates.length;
    } else if (dates.length === 0) {
      if (lastCount !== 0) console.log(`[${ts()}] まだ空です（リセール受付前）`);
      lastCount = 0;
      if (checks % 12 === 0) console.log(`[${ts()}] 監視中（${checks}回目）: 変化なし`);
    }
  } catch (e) {
    console.log(`[${ts()}] 取得失敗: ${e.message}（継続）`);
  }
  await sleep(INTERVAL_SEC * 1000);
}
