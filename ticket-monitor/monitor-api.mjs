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

async function fetchEventDates() {
  const res = await fetch(API_URL, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "ja,en;q=0.8",
      Origin: "https://nft.rakuten.co.jp",
      Referer: "https://nft.rakuten.co.jp/",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    },
  });
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

  const names = data.event_dates.map((e) => norm(e.performance_name ?? ""));
  const hitDates = WATCH_KEYWORDS.map(norm).filter((kw) =>
    names.some((n) => n.includes(kw))
  );

  for (const kw of hitDates) {
    if (!present.has(kw)) {
      present.add(kw);
      // ⚡ 出現の瞬間: 即ブラウザ＋音声。ここが最速の一報
      openBrowser(OPEN_URL);
      speak(`${kw.replace(/[()（）]/g, " ")} が出ました`);
      console.log("");
      console.log(`\n🎫🎫🎫 [${ts()}] ${kw} の行が出現！`);
      console.log(`→ 今すぐ確認: ${OPEN_URL}\n`);
      notify("みんなのチケット ⚡API速報", `${kw} の行が出現！`);
    }
  }

  // 消えたらリセットして、次の出品で再通知できるようにする
  for (const kw of [...present]) {
    if (!hitDates.includes(kw)) {
      present.delete(kw);
      console.log(`[${ts()}] ${kw} の行が消えました（売り切れ or 出品取消）`);
    }
  }

  if (checkCount % 30 === 1) {
    const dates = names.map((n) => (n.match(/\d{1,2}\/\d{1,2}\s*\([月火水木金土日]\)/) ?? [n])[0]);
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
