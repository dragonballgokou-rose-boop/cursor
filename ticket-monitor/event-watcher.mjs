#!/usr/bin/env node
/**
 * 2nds watcher — event-watcher
 * 指定したAPIを緩い間隔で叩き、「空→中身あり」に変わった瞬間に知らせる。
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
 *   node event-watcher.mjs                    # 1004（乃木坂46）の公演日を5分おき
 *   node event-watcher.mjs 1004 60            # イベントIDと間隔（秒）
 *   node event-watcher.mjs "https://..." 30   # 任意のAPI URLを直接見張る
 *
 * URLを直接渡す使い方は、イベントIDが分からないときに有効。
 * みんなのチケットのマーケットプレイス一覧やcount系APIのURLを
 * DevToolsのネットワークタブからコピーして渡せば、
 * どのイベントであっても出品が出た瞬間に検知できる。
 *
 * 公演日を見つけたら monitor-api.mjs をそのまま起動して本番監視に入る。
 * （NO_AUTO=1 で自動起動を止め、コマンドの表示だけにできる）
 *
 * 環境変数:
 *   NTFY_TOPIC   スマホへプッシュ（monitor-api.mjs と同じ）
 *   NO_OPEN=1    ブラウザを開かない
 *   NO_AUTO=1    公演日を見つけても monitor-api.mjs を自動起動しない
 *   LOG_FILE     記録先CSV（既定 listings-log.csv。過去データと混ぜたくないとき用）
 *   SEAT_KEYWORDS / MIN_PRICE / EXCLUDE_KEYWORDS / CHECK_INTERVAL
 *                そのまま monitor-api.mjs に引き継がれる
 */

import { exec, spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ARG1 = process.argv[2] ?? process.env.EVENT_ID ?? "1004";
const IS_URL = /^https?:\/\//.test(ARG1);
const EVENT_ID = IS_URL ? null : ARG1;
const INTERVAL_SEC = Math.max(1, Number(process.argv[3] ?? process.env.INTERVAL ?? 2) || 2);
const NTFY_TOPIC = process.env.NTFY_TOPIC ?? "";
const NTFY_SERVER = process.env.NTFY_SERVER ?? "https://ntfy.sh";
const NO_OPEN = process.env.NO_OPEN === "1";
const NO_AUTO = process.env.NO_AUTO === "1";
const HERE = path.dirname(fileURLToPath(import.meta.url));

const API = IS_URL
  ? ARG1
  : `https://api.nft.rakuten.co.jp/products/v0/mp/tickets/getEventDates/${EVENT_ID}?limit=50`;
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

/** 応答から「件数」らしき正の数値を拾う（count系API用） */
function extractCount(data) {
  let max = 0;
  const walk = (v, key) => {
    if (v == null) return;
    if (typeof v === "number" && /count|total|num|hits/i.test(key ?? "")) max = Math.max(max, v);
    else if (Array.isArray(v)) { max = Math.max(max, v.length); v.forEach((x) => walk(x)); }
    else if (typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(data, "");
  return max;
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
console.log(IS_URL ? `監視URL  : ${API}` : `イベントID: ${EVENT_ID}`);
console.log(`間隔      : ${INTERVAL_SEC}秒`);
console.log(`スマホ通知: ${NTFY_TOPIC ? "ON" : "OFF（NTFY_TOPIC=好きな文字列 で有効）"}`);
console.log(`自動起動  : ${NO_AUTO ? "OFF（コマンドを表示するだけ）" : "ON（公演日を見つけたら monitor-api.mjs に切り替え）"}`);
console.log("公演日が登録されたら知らせます。購入操作はしません。");
console.log("Ctrl+C で終了\n");

let checks = 0;
let lastCount = -1;

await (async function loop() {
for (;;) {
  checks++;
  try {
    const res = await fetch(API, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const dates = extractDates(data);
    const count = extractCount(data);
    const hit = dates.length > 0 ? dates.length : count;

    if (hit > 0 && hit !== lastCount) {
      console.log(`\n🎫🎫🎫 [${ts()}] 中身が出ました（${hit}件）\n`);
      if (dates.length > 0) {
        dates.forEach((d) => console.log(`   ${d}`));
        const targets = dates.map((d) => `${d}=all`).join(",");
        if (NO_AUTO) {
          console.log("\n↓ このコマンドで監視を開始できます\n");
          console.log(`SEAT_KEYWORDS="席|スタンディング" MIN_PRICE=0 EXCLUDE_KEYWORDS="" \\`);
          console.log(`  node monitor-api.mjs "${targets}"\n`);
        } else {
          console.log("\n→ monitor-api.mjs に切り替えます（1秒間隔の本番監視）\n");
          const child = spawn(
            process.execPath,
            [path.join(HERE, "monitor-api.mjs"), targets],
            {
              stdio: "inherit",
              cwd: HERE,
              env: {
                ...process.env,
                // 席種が未知のうちは絞らない。起動後のAPIサンプルを見てから絞る
                SEAT_KEYWORDS: process.env.SEAT_KEYWORDS ?? "席|スタンディング|アリーナ",
                MIN_PRICE: process.env.MIN_PRICE ?? "0",
                EXCLUDE_KEYWORDS: process.env.EXCLUDE_KEYWORDS ?? "",
                GIT_SYNC: process.env.GIT_SYNC ?? "0",
                // 過去公演のCSVに追記しないよう、公演日ごとにファイルを分ける
                LOG_FILE: process.env.LOG_FILE ?? `listings-${dates[0].slice(0, 10)}.csv`,
              },
            }
          );
          child.on("exit", (code) => process.exit(code ?? 0));
          return; // 監視ループを抜ける
        }
      } else {
        console.log(`   応答: ${JSON.stringify(data).slice(0, 500)}\n`);
      }
      speak("リセールに出品が出ました");
      notify("2nds watcher", `${hit}件を検知しました`);
      pushPhone("🎫 リセール検知", `${hit}件を検知しました`, MARKET);
      openBrowser(MARKET);
      lastCount = hit;
    } else if (hit === 0) {
      if (lastCount !== 0) console.log(`[${ts()}] まだ空です（リセール受付前）`);
      lastCount = 0;
      if (checks % 12 === 0) console.log(`[${ts()}] 監視中（${checks}回目）: 変化なし`);
    }
  } catch (e) {
    console.log(`[${ts()}] 取得失敗: ${e.message}（継続）`);
  }
  await sleep(INTERVAL_SEC * 1000);
}
})();
