#!/usr/bin/env node
/**
 * みんなのチケット リセール出品ウォッチャー（API版・最速・複数公演対応）
 *
 * 狙った公演の出品リストAPI（getTickets）を毎サイクル並列で直接ポーリングする。
 * 出現検知と出品IDの取得が1リクエストで同時に済むため、
 * 検知した瞬間に出品詳細ページ（moments/RTK_.../）を開ける。
 *
 * 検知ルール（TARGETS で変更可）:
 *   - 8/22(土): 除外席種以外の全出品（友達用）
 *   - 8/23(日): アリーナ席のみ（アップグレード用）
 *
 * ⚠️ 通知のみ。購入は必ず自分の手で行うこと（自動購入は規約違反）。
 * ⚠️ 同日・同イベントの複数枚購入は同行者に分配できない。友達の分は
 *    友達自身のアカウントで購入すること。
 *
 * 使い方:
 *   node monitor-api.mjs
 *
 * 例: ルール変更（8/22は全席種、8/23はアリーナのみ、がデフォルト）
 *   TARGETS="2026-08-22T18:00:00=arena,2026-08-23T18:00:00=arena" node monitor-api.mjs
 */

import { exec } from "node:child_process";
import process from "node:process";

const TICKETS_API_BASE =
  process.env.TICKETS_API_BASE ??
  "https://api.nft.rakuten.co.jp/products/v0/mp/tickets/getTickets/1004";

// 監視対象: "開演時刻=モード" のカンマ区切り。モードは all（全席種）| arena（アリーナのみ）
// コマンド引数でも指定可（環境変数の書き方がOSで違うため）:
//   node monitor-api.mjs "2026-08-22T18:00:00=all"
const TARGETS = (
  process.argv[2] ??
  process.env.TARGETS ??
  "2026-08-22T18:00:00=all,2026-08-23T18:00:00=arena"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    const [start, mode = "all"] = s.split("=").map((x) => x.trim());
    const dm = start.match(/-(\d{2})-(\d{2})T/) ?? [null, "?", "?"];
    return {
      start,
      mode,
      label: `${Number(dm[1])}月${Number(dm[2])}日`,
      url: `${TICKETS_API_BASE}/${start}`,
      alerted: new Set(), // 通知済み出品ID
    };
  });

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

// arena モードで通知する席種
const ARENA_PATTERN = new RegExp(
  (process.env.ARENA_KEYWORDS ?? "アリーナ")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join("|")
);

const CHECK_INTERVAL_SEC = Math.max(0.5, Number(process.env.CHECK_INTERVAL ?? 1) || 1);
const NO_OPEN = process.env.NO_OPEN === "1";

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
  if (process.platform === "darwin") {
    exec(`say -v Kyoko ${JSON.stringify(message)}`, () => {});
  } else if (process.platform === "win32") {
    // Windowsは標準の音声合成で読み上げ（日本語音声がなければ英語読みになるが音は鳴る）
    const ps = `Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('${message.replace(/'/g, "''")}')`;
    exec(`powershell -NoProfile -Command "${ps}"`, () => {});
  }
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
  // Windowsの通知バナーは省略（ブラウザ自動オープン＋読み上げで十分、
  // メッセージボックスは購入操作からフォーカスを奪うため使わない）
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

let checkCount = 0;
let failStreak = 0;
let loggedRawOnce = false;

/** 1公演ぶんのチェック。戻り値はハートビート用のサマリ文字列 */
async function checkTarget(t) {
  let data = null;
  const res = await fetch(t.url, {
    headers: COMMON_HEADERS,
    signal: AbortSignal.timeout(5_000),
  });
  if (res.status === 404) {
    data = null; // 出品ゼロは404の可能性 → 「出品なし」扱い
  } else if (res.status === 401 || res.status === 403) {
    throw new Error(`HTTP ${res.status} — ログイン必須のようです`);
  } else if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  } else {
    data = await res.json();
  }

  const arr = data ? (findItemsArray(data) ?? []) : [];

  if (arr.length > 0 && !loggedRawOnce) {
    loggedRawOnce = true;
    console.log(`[${ts()}] 出品APIサンプル: ${JSON.stringify(arr[0]).slice(0, 800)}`);
  }

  const items = arr.map((o) => {
    const s = JSON.stringify(o);
    return {
      id: (s.match(/RTK_[A-Za-z0-9_-]+/) ?? [null])[0],
      excluded: EXCLUDE_PATTERN.test(s),
      arena: ARENA_PATTERN.test(s),
      raw: s,
    };
  });

  // モードに応じた対象出品: all=除外以外すべて / arena=アリーナのみ
  const okItems = items.filter(
    (i) => !i.excluded && (t.mode === "all" || i.arena)
  );
  const okIds = okItems.map((i) => i.id ?? i.raw.slice(0, 60));

  const fresh = okItems.filter((i) => !t.alerted.has(i.id ?? i.raw.slice(0, 60)));
  if (fresh.length > 0) {
    fresh.forEach((i) => t.alerted.add(i.id ?? i.raw.slice(0, 60)));
    const first = fresh[0];
    const url = first.id ? ITEM_URL_TEMPLATE.replace("{id}", first.id) : OPEN_URL;
    openBrowser(url);
    const what = first.arena ? "アリーナ席" : "チケット";
    speak(`${t.label}に${what}が出ました。かごに入れてください`);
    console.log("");
    console.log(`\n🎫🎫🎫 [${ts()}] ${t.label} 購入可能な出品を検知！（${fresh.length}件・${t.mode === "arena" ? "アリーナ" : "全席種"}）`);
    console.log(`   ${first.raw.slice(0, 300)}`);
    console.log(`→ ${url}\n`);
    notify("みんなのチケット ⚡検知", `${t.label} ${what} ${fresh.length}件`);
  }

  // 消えた出品はリセットして、再出品されたら再び鳴るようにする
  for (const id of [...t.alerted]) {
    if (!okIds.includes(id)) {
      t.alerted.delete(id);
      console.log(`[${ts()}] ${t.label} の出品が消えました: ${id}`);
    }
  }

  const skipped = items.length - okItems.length;
  return `${t.label}=${okItems.length}件` + (skipped > 0 ? `(対象外${skipped})` : "");
}

async function checkOnce() {
  checkCount++;
  // 全公演を並列チェック（1公演あたり50〜100msなのでサイクルはほぼ変わらない）
  const results = await Promise.allSettled(TARGETS.map((t) => checkTarget(t)));

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    failStreak++;
    if (failStreak % 3 === 1) {
      console.log(
        `[${ts()}] 取得失敗: ${failed[0].reason?.message ?? failed[0].reason}（連続${failStreak}回・リトライ継続）`
      );
    }
    if (failStreak >= 10) await sleep(10_000); // ブロック回避
  } else {
    failStreak = 0;
  }

  if (checkCount % 30 === 1) {
    const summary = results
      .map((r) => (r.status === "fulfilled" ? r.value : "取得失敗"))
      .join(" / ");
    console.log(`[${ts()}] 監視中（${checkCount}回目）: ${summary}`);
  }
}

console.log("=== みんなのチケット リセール出品ウォッチャー（API版・最速） ===");
for (const t of TARGETS) {
  console.log(`対象公演  : ${t.label}（${t.start}）… ${t.mode === "arena" ? "アリーナのみ" : "全席種"}`);
}
console.log(`除外席種  : ${process.env.EXCLUDE_KEYWORDS ?? "バリアフリー,親子,女性"}`);
console.log(`間隔      : ${CHECK_INTERVAL_SEC}秒（CHECK_INTERVAL=0.5 まで短縮可）`);
console.log("検知したら出品詳細ページを直接開きます。購入は自分の手で。");
console.log("⚠️ 同日複数枚は同行者に分配不可。友達の分は友達のアカウントで購入を。");
console.log("Ctrl+C で終了\n");

while (true) {
  await checkOnce();
  await sleep(CHECK_INTERVAL_SEC * 1000);
}
