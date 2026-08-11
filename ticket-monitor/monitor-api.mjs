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
import fs from "node:fs";
import process from "node:process";

const TICKETS_API_BASE =
  process.env.TICKETS_API_BASE ??
  "https://api.nft.rakuten.co.jp/products/v0/mp/tickets/getTickets/1004";

// 監視対象: "開演時刻=モード" のカンマ区切り。モードは all（全席種）| arena（アリーナのみ）
// コマンド引数でも指定可（環境変数の書き方がOSで違うため）:
//   node monitor-api.mjs "2026-08-22T18:00:00=all"
// 全席確保済みのため、両日ともアリーナ指定のみ（アップグレード狙い）
const TARGETS = (
  process.argv[2] ??
  process.env.TARGETS ??
  "2026-08-22T18:00:00=arena,2026-08-23T18:00:00=arena"
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
      seen: new Map(), // 現在掲載中の全出品（対象外含む）id → {seatName, price, firstSeen}
    };
  });

// 全出品の出現・消滅をCSVに記録する（頻度分析用）
const LOG_FILE = process.env.LOG_FILE ?? "listings-log.csv";
const nowLocal = () => new Date().toLocaleString("sv-SE"); // YYYY-MM-DD HH:mm:ss

function logCsv(event, target, id, seatName, price, note = "") {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      fs.writeFileSync(
        LOG_FILE,
        "timestamp,event,performance,seat_name,price,id,note\n"
      );
    }
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    fs.appendFileSync(
      LOG_FILE,
      [nowLocal(), event, target.label, seatName, price ?? "", id, note]
        .map(esc)
        .join(",") + "\n"
    );
  } catch {
    // 記録失敗で監視を止めない
  }
}

// 検知時に開く出品詳細ページの形式
const ITEM_URL_TEMPLATE =
  process.env.ITEM_URL_TEMPLATE ?? "https://nft.rakuten.co.jp/moments/{id}/";

// IDが取れなかったときに開く一覧ページ
const OPEN_URL =
  process.env.OPEN_URL ??
  "https://nft.rakuten.co.jp/marketplace/?type=ticket&sort=last_updated_date&limit=12&ticketlimit=6&provider=nogizaka";

// 通知しない席種
const EXCLUDE_PATTERN = new RegExp(
  (process.env.EXCLUDE_KEYWORDS ?? "バリアフリー,親子,女性,見切れ")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join("|")
);

// この価格未満の出品は通知しない（0で無効化）。
// 指定席12,000/注釈付11,000/見切れ9,900 なので、12000なら指定席・アリーナのみ
const MIN_PRICE = Number(process.env.MIN_PRICE ?? 12000) || 0;

// この席種名を含む出品だけ通知する（許可リスト）
const ALLOW_PATTERN = new RegExp(
  (process.env.SEAT_KEYWORDS ?? "指定席,アリーナ")
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
    // 価格は sale_price（実データで確認済み）。resale_price の場合もある
    const price =
      typeof o.sale_price === "number"
        ? o.sale_price
        : typeof o.resale_price === "number"
          ? o.resale_price
          : Number((s.match(/"(?:sale_|resale_)?price"\s*:\s*(\d+)/) ?? [])[1]) || null;
    return {
      id: (s.match(/RTK_[A-Za-z0-9_-]+/) ?? [null])[0],
      seatName: o.product_item_name ?? "",
      excluded: EXCLUDE_PATTERN.test(s),
      arena: ARENA_PATTERN.test(s),
      price,
      raw: s,
    };
  });

  // 出現・消滅をCSVに記録（対象外の席種も含めて全部）
  const currentIds = new Set();
  for (const i of items) {
    const key = i.id ?? i.raw.slice(0, 60);
    currentIds.add(key);
    if (!t.seen.has(key)) {
      t.seen.set(key, { seatName: i.seatName, price: i.price, firstSeen: Date.now() });
      logCsv("appear", t, key, i.seatName, i.price);
    }
  }
  for (const [key, info] of [...t.seen]) {
    if (!currentIds.has(key)) {
      const lifeSec = Math.round((Date.now() - info.firstSeen) / 1000);
      t.seen.delete(key);
      logCsv("disappear", t, key, info.seatName, info.price, `掲載${lifeSec}秒`);
    }
  }

  // 通知条件（三重チェック）:
  //   1. 席種名が許可リスト（指定席/アリーナ）に一致
  //   2. 除外語（バリアフリー/親子/女性/見切れ）を含まない
  //   3. 価格が MIN_PRICE 以上（価格不明なら通知する側に倒す）
  // さらにモード: all=上記すべて / arena=そのうちアリーナのみ
  const okItems = items.filter(
    (i) =>
      ALLOW_PATTERN.test(i.raw) &&
      !i.excluded &&
      (i.price == null || i.price >= MIN_PRICE) &&
      (t.mode === "all" || i.arena)
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

// CSVを定期的にGitHubへ自動プッシュ（分析ページの自動更新用）。
// GIT_SYNC=0 で無効化。失敗しても監視は止めない
const GIT_SYNC = process.env.GIT_SYNC !== "0";
const SYNC_INTERVAL_MIN = Math.max(5, Number(process.env.SYNC_INTERVAL_MIN ?? 30) || 30);

function syncLogToGit() {
  if (!GIT_SYNC) return;
  const cmd =
    `cd "${process.cwd()}" && ` +
    `git pull --rebase -q && ` +
    `git add "${LOG_FILE}" && ` +
    `git -c user.name="ticket-watcher" -c user.email="watcher@local" commit -q -m "chore: update listings log" && ` +
    `git push -q`;
  exec(cmd, (err) => {
    if (err) {
      // コミット対象なし（変更なし）のときもここに来るので、静かにしておく
      if (!/nothing to commit|no changes/i.test(String(err))) {
        console.log(`[${ts()}] ログ同期スキップ: push失敗（監視は継続。git認証を確認）`);
      }
    } else {
      console.log(`[${ts()}] ログをGitHubへ同期しました`);
    }
  });
}
if (GIT_SYNC) setInterval(syncLogToGit, SYNC_INTERVAL_MIN * 60 * 1000);

console.log("=== みんなのチケット リセール出品ウォッチャー（API版・最速） ===");
for (const t of TARGETS) {
  console.log(`対象公演  : ${t.label}（${t.start}）… ${t.mode === "arena" ? "アリーナのみ" : "全席種"}`);
}
console.log(`対象席種  : ${process.env.SEAT_KEYWORDS ?? "指定席,アリーナ"}（${MIN_PRICE > 0 ? `${MIN_PRICE.toLocaleString()}円以上` : "価格制限なし"}）`);
console.log(`除外席種  : ${process.env.EXCLUDE_KEYWORDS ?? "バリアフリー,親子,女性,見切れ"}`);
console.log(`間隔      : ${CHECK_INTERVAL_SEC}秒（CHECK_INTERVAL=0.5 まで短縮可）`);
console.log(`記録      : 全出品の出現・消滅を ${LOG_FILE} に記録（頻度分析用）`);
console.log("検知したら出品詳細ページを直接開きます。購入は自分の手で。");
console.log("⚠️ 同日複数枚は同行者に分配不可。友達の分は友達のアカウントで購入を。");
console.log("Ctrl+C で終了\n");

while (true) {
  await checkOnce();
  await sleep(CHECK_INTERVAL_SEC * 1000);
}
