#!/usr/bin/env node
/**
 * みんなのチケット リセール出品ウォッチャー（API版・最速）
 *
 * 狙った公演の出品リストAPI（getTickets）を直接ポーリングする。
 * 出現検知と出品IDの取得が1リクエストで同時に済むため、
 * 検知した瞬間に出品詳細ページ（moments/RTK_.../）を開ける。
 *
 * ⚠️ 通知のみ。購入は必ず自分の手で行うこと（自動購入は規約違反）。
 *
 * 使い方:
 *   node monitor-api.mjs
 */

import { exec } from "node:child_process";
import process from "node:process";

// 8/23公演の出品リストを直接ポーリングする（検知とID取得が1回で済む最速経路）
// 他の公演を狙うときは PERFORMANCE_START を差し替える
const PERFORMANCE_START = process.env.PERFORMANCE_START ?? "2026-08-23T18:00:00";
const TICKETS_URL = `${
  process.env.TICKETS_API_BASE ??
  "https://api.nft.rakuten.co.jp/products/v0/mp/tickets/getTickets/1004"
}/${PERFORMANCE_START}`;

// 検知時に開く出品詳細ページの形式
const ITEM_URL_TEMPLATE =
  process.env.ITEM_URL_TEMPLATE ?? "https://nft.rakuten.co.jp/moments/{id}/";

// IDが取れなかったときに開く一覧ページ
const OPEN_URL =
  process.env.OPEN_URL ??
  "https://nft.rakuten.co.jp/marketplace/?type=ticket&sort=last_updated_date&limit=12&ticketlimit=6&provider=nogizaka";

// 通知しない席種
const EXCLUDE_PATTERN = new RegExp(
  (process.env.EXCLUDE_KEYWORDS ?? "バリアフリー,親子,女性")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join("|")
);

const CHECK_INTERVAL_SEC = Math.max(0.5, Number(process.env.CHECK_INTERVAL ?? 1) || 1);
const NO_OPEN = process.env.NO_OPEN === "1";

// 「8月23日」のような読み上げ用ラベルを開演時刻から作る
const dm = PERFORMANCE_START.match(/-(\d{2})-(\d{2})T/) ?? [null, "?", "?"];
const DATE_LABEL = `${Number(dm[1])}月${Number(dm[2])}日`;

const ts = () => new Date().toLocaleTimeString("ja-JP", { hour12: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

function speak(message) {
  if (process.platform !== "darwin") return;
  exec(`say -v Kyoko ${JSON.stringify(message)}`, () => {});
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

const COMMON_HEADERS = {
  Accept: "application/json",
  "Accept-Language": "ja,en;q=0.8",
  Origin: "https://nft.rakuten.co.jp",
  Referer: "https://nft.rakuten.co.jp/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
};

/** 応答の中から出品（オブジェクトの配列）を探す。ネストにも対応 */
function findItemsArray(data) {
  if (Array.isArray(data)) return data;
  if (data == null || typeof data !== "object") return null;
  for (const v of Object.values(data)) {
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object") return v;
  }
  for (const v of Object.values(data)) {
    if (v != null && typeof v === "object" && !Array.isArray(v)) {
      const found = findItemsArray(v);
      if (found) return found;
    }
  }
  return null;
}

let alertedIds = new Set(); // 通知済みの出品ID（消えたら外して再通知可能にする）
let checkCount = 0;
let failStreak = 0;
let loggedRawOnce = false;

async function checkOnce() {
  checkCount++;
  let data = null;
  try {
    const res = await fetch(TICKETS_URL, {
      headers: COMMON_HEADERS,
      signal: AbortSignal.timeout(5_000),
    });
    if (res.status === 404) {
      data = null; // 出品ゼロのときは404の可能性がある → 「出品なし」扱い
    } else if (res.status === 401 || res.status === 403) {
      throw new Error(
        `HTTP ${res.status} — このAPIはログイン必須のようです。monitor-browser.mjs を使ってください`
      );
    } else if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    } else {
      data = await res.json();
    }
    failStreak = 0;
  } catch (err) {
    failStreak++;
    if (failStreak % 3 === 1) {
      console.log(`[${ts()}] 取得失敗: ${err.message}（連続${failStreak}回・リトライ継続）`);
    }
    if (failStreak >= 10) await sleep(10_000); // ブロック回避のため間隔を空ける
    return;
  }

  const arr = data ? (findItemsArray(data) ?? []) : [];

  // 実データの形を一度だけ記録（判定精度の確認用）
  if (arr.length > 0 && !loggedRawOnce) {
    loggedRawOnce = true;
    console.log(`[${ts()}] 出品リストAPI応答サンプル: ${JSON.stringify(arr[0]).slice(0, 800)}`);
  }

  const items = arr.map((o) => {
    const s = JSON.stringify(o);
    return {
      id: (s.match(/RTK_[A-Za-z0-9_-]+/) ?? [null])[0],
      excluded: EXCLUDE_PATTERN.test(s),
      raw: s,
    };
  });
  const okItems = items.filter((i) => !i.excluded);
  const okIds = okItems.map((i) => i.id ?? i.raw.slice(0, 60));

  // 新しい購入可能出品 → 即発報（ブラウザを開くのは1出品1回だけ）
  const fresh = okItems.filter((i) => !alertedIds.has(i.id ?? i.raw.slice(0, 60)));
  if (fresh.length > 0) {
    fresh.forEach((i) => alertedIds.add(i.id ?? i.raw.slice(0, 60)));
    const first = fresh[0];
    const url = first.id ? ITEM_URL_TEMPLATE.replace("{id}", first.id) : OPEN_URL;
    openBrowser(url);
    speak(`${DATE_LABEL}のチケットが出ました。かごに入れてください`);
    console.log("");
    console.log(`\n🎫🎫🎫 [${ts()}] 購入可能な出品を検知！（${fresh.length}件）`);
    console.log(`   ${first.raw.slice(0, 300)}`);
    console.log(`→ ${url}\n`);
    notify("みんなのチケット ⚡検知", `${DATE_LABEL} に購入可能な出品 ${fresh.length}件`);
  }

  // 消えた出品はリセットして、再出品されたら再び鳴るようにする
  for (const id of [...alertedIds]) {
    if (!okIds.includes(id)) {
      alertedIds.delete(id);
      console.log(`[${ts()}] 出品が消えました: ${id}`);
    }
  }

  if (checkCount % 30 === 1) {
    const exCount = items.length - okItems.length;
    console.log(
      `[${ts()}] 監視中（${checkCount}回目）: 出品 ${items.length}件` +
        (exCount > 0 ? `（うち除外席種 ${exCount}件）` : "")
    );
  }
}

console.log("=== みんなのチケット リセール出品ウォッチャー（API版・最速） ===");
console.log(`対象公演  : ${DATE_LABEL}（${PERFORMANCE_START}）`);
console.log(`API       : ${TICKETS_URL}`);
console.log(`除外席種  : ${process.env.EXCLUDE_KEYWORDS ?? "バリアフリー,親子,女性"}`);
console.log(`間隔      : ${CHECK_INTERVAL_SEC}秒（CHECK_INTERVAL=0.5 まで短縮可）`);
console.log("検知したら出品詳細ページを直接開きます。購入は自分の手で。");
console.log("Ctrl+C で終了\n");

while (true) {
  await checkOnce();
  await sleep(CHECK_INTERVAL_SEC * 1000);
}
