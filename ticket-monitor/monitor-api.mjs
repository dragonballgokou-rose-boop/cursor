#!/usr/bin/env node
/**
 * みんなのチケット リセール出品ウォッチャー（API版・最速）
 *
 * マーケットプレイスの裏で呼ばれている公演日リストAPIを直接ポーリングする。
 * ブラウザ描画が不要なため1回のチェックが数百msで済み、真の1秒間隔で回る。
 *
 * このAPIは「どの公演日の行が出ているか」しか分からない（席種・価格は不明）。
 * そのため検知は速報のみ。席種の確認は開いたブラウザで自分の目で行うか、
 * 別ターミナルで monitor-browser.mjs を並走させて音声確認に使う。
 *
 * ⚠️ 通知のみ。購入は必ず自分の手で行うこと（自動購入は規約違反）。
 *
 * 使い方:
 *   node monitor-api.mjs
 */

import { exec } from "node:child_process";
import process from "node:process";

const API_URL =
  process.env.API_URL ??
  "https://api.nft.rakuten.co.jp/products/v0/mp/tickets/getEventDates/1004?limit=6";

// 公演ごとの出品リストAPI（行を展開したときに呼ばれるもの）
// 末尾に performance_start_on（例: 2026-08-23T18:00:00）を付けて呼ぶ
const TICKETS_API_BASE =
  process.env.TICKETS_API_BASE ??
  "https://api.nft.rakuten.co.jp/products/v0/mp/tickets/getTickets/1004";

// 通知しない席種
const EXCLUDE_PATTERN = new RegExp(
  (process.env.EXCLUDE_KEYWORDS ?? "バリアフリー,親子,女性")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join("|")
);

// 検知したい公演日（performance_name に含まれる文字列で判定）
const WATCH_KEYWORDS = (process.env.WATCH_KEYWORDS ?? "8/23(日),8/23（日）")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// 検知時に開くページ（購入はここから人間が行う）
const OPEN_URL =
  process.env.OPEN_URL ??
  "https://nft.rakuten.co.jp/marketplace/?type=ticket&sort=last_updated_date&limit=12&ticketlimit=6&provider=nogizaka";

const CHECK_INTERVAL_SEC = Math.max(1, Number(process.env.CHECK_INTERVAL ?? 1) || 1);
const NO_OPEN = process.env.NO_OPEN === "1";

const ts = () => new Date().toLocaleTimeString("ja-JP", { hour12: false });
const norm = (s) => s.replace(/（/g, "(").replace(/）/g, ")");
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

// 出品詳細ページのURL組み立て（{id} が RTK_... のIDに置き換わる）
// もし開いたページが違っていたら、実際の出品詳細ページのURLに合わせて
// ITEM_URL_TEMPLATE 環境変数で上書きする
const ITEM_URL_TEMPLATE =
  process.env.ITEM_URL_TEMPLATE ?? "https://nft.rakuten.co.jp/moments/{id}/";

const COMMON_HEADERS = {
  Accept: "application/json",
  "Accept-Language": "ja,en;q=0.8",
  Origin: "https://nft.rakuten.co.jp",
  Referer: "https://nft.rakuten.co.jp/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
};

async function fetchEventDates() {
  const res = await fetch(API_URL, { headers: COMMON_HEADERS });
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `HTTP ${res.status} — このAPIはログイン必須のようです。monitor-browser.mjs を使ってください`
    );
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data.event_dates)) {
    throw new Error("応答の形式が想定と違います（event_dates がない）");
  }
  return data;
}

/** 応答の中から出品（オブジェクトの配列）を探す。1階層ネストまで対応 */
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

/**
 * 検知した公演の出品リストAPIを叩き、除外席種の判定と
 * 出品詳細ページURLの特定を行う（追加ロス 0.3〜2秒、失敗時は一覧を開く）
 */
async function inspectTickets(performanceStartOn) {
  const url = `${TICKETS_API_BASE}/${performanceStartOn}`;
  try {
    const res = await fetch(url, {
      headers: COMMON_HEADERS,
      signal: AbortSignal.timeout(2_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const raw = JSON.stringify(data);
    // 初回はこのログを貼ってもらえれば判定・URL組み立てをさらに精密化できる
    console.log(`[${ts()}] 出品リストAPI応答: ${raw.slice(0, 1500)}`);

    const arr = findItemsArray(data);
    if (!arr || arr.length === 0) {
      return { excludedOnly: false, itemUrl: null, summary: "出品リストが空" };
    }
    const ok = arr.filter((o) => !EXCLUDE_PATTERN.test(JSON.stringify(o)));
    if (ok.length === 0) {
      return { excludedOnly: true, itemUrl: null, summary: `${arr.length}件すべて除外席種` };
    }

    const first = JSON.stringify(ok[0]);
    // 1) 応答内に nft.rakuten.co.jp のURLがあればそれを使う
    let itemUrl = (first.match(/https?:\/\/[^"\\ ]*nft\.rakuten\.co\.jp[^"\\ ]*/) ?? [null])[0];
    // 2) なければ RTK_ 形式の出品IDからURLを組み立てる
    if (!itemUrl) {
      const id = (first.match(/RTK_[A-Za-z0-9_-]+/) ?? [null])[0];
      if (id) itemUrl = ITEM_URL_TEMPLATE.replace("{id}", id);
    }
    return {
      excludedOnly: false,
      itemUrl,
      summary: `購入可能 ${ok.length}件 / 全${arr.length}件`,
    };
  } catch (err) {
    console.log(`[${ts()}] 出品リスト取得失敗: ${err.message}（一覧ページを開きます）`);
    return null;
  }
}

let present = new Set(); // 現在ページに出ている監視対象日
let checkCount = 0;
let failStreak = 0;

async function checkOnce() {
  checkCount++;
  let data;
  try {
    data = await fetchEventDates();
    failStreak = 0;
  } catch (err) {
    failStreak++;
    // 失敗ログは連発しても3回に1回だけ
    if (failStreak % 3 === 1) {
      console.log(`[${ts()}] 取得失敗: ${err.message}（連続${failStreak}回・リトライ継続）`);
    }
    // 失敗が続くときは間隔を少し空けてブロックを避ける
    if (failStreak >= 10) await sleep(10_000);
    return;
  }

  const watch = WATCH_KEYWORDS.map(norm);
  const events = data.event_dates.map((e) => ({
    startOn: e.performance_start_on,
    nName: norm(e.performance_name ?? ""),
  }));
  const hitKws = [];

  for (const ev of events) {
    const kw = watch.find((k) => ev.nName.includes(k));
    if (!kw) continue;
    hitKws.push(kw);
    if (present.has(kw)) continue;
    present.add(kw);

    // ⚡ 出現の瞬間: まず音声と通知（ここが最速の一報）
    speak(`${kw.replace(/[()（）]/g, " ")} が出ました。確認中`);
    console.log("");
    console.log(`\n🎫🎫🎫 [${ts()}] ${kw} の行が出現！`);
    notify("みんなのチケット ⚡API速報", `${kw} の行が出現！`);

    // 出品リストAPIで席種確認＋出品詳細URLの特定（+0.3〜2秒）
    const info = await inspectTickets(ev.startOn);

    if (info?.excludedOnly) {
      // 除外席種だけならブラウザは開かない（肩透かし防止）
      speak("除外席種のみでした");
      console.log(`[${ts()}] ${kw}: ${info.summary} → ブラウザは開きません`);
      continue;
    }

    // ブラウザを開くのはこの1回だけ。出品詳細が特定できていれば直行
    const gotoUrl = info?.itemUrl ?? OPEN_URL;
    openBrowser(gotoUrl);
    if (info?.itemUrl) speak("出品ページを開きました。かごに入れてください");
    if (info?.summary) console.log(`   ${info.summary}`);
    console.log(`→ ${gotoUrl}\n`);
  }

  // 消えたらリセットして、次の出品で再通知できるようにする
  for (const kw of [...present]) {
    if (!hitKws.includes(kw)) {
      present.delete(kw);
      console.log(`[${ts()}] ${kw} の行が消えました（売り切れ or 出品取消）`);
    }
  }

  if (checkCount % 30 === 1) {
    const dates = events.map(
      (e) => (e.nName.match(/\d{1,2}\/\d{1,2}\s*\([月火水木金土日]\)/) ?? [e.nName])[0]
    );
    console.log(
      `[${ts()}] 監視中（${checkCount}回目）: 現在の行 = ${dates.join(", ") || "なし"}`
    );
  }
}

console.log("=== みんなのチケット リセール出品ウォッチャー（API版・最速） ===");
console.log(`API       : ${API_URL}`);
console.log(`監視対象  : ${WATCH_KEYWORDS.join(", ")}`);
console.log(`間隔      : ${CHECK_INTERVAL_SEC}秒`);
console.log("※ このAPIでは席種までは分からないため、検知したら開いたページで確認してください");
console.log("Ctrl+C で終了\n");

while (true) {
  await checkOnce();
  await sleep(CHECK_INTERVAL_SEC * 1000);
}
