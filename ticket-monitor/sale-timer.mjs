#!/usr/bin/env node
/**
 * 2nds watcher — sale-timer
 * 先着販売の開始時刻ちょうどに、販売ページをブラウザで開くだけのタイマー。
 *
 * やること:
 *   1. 販売サイトのHTTPレスポンスの Date ヘッダからサーバー時刻を測り、
 *      Macの時計とのズレ（オフセット）を求める
 *   2. サーバー時刻基準でカウントダウンする
 *   3. 開始時刻ちょうどにブラウザでページを開き、読み上げ＋通知する
 *
 * やらないこと:
 *   - 購入操作の自動化（規約違反）
 *   - 待機列の迂回、販売APIの直接呼び出し
 *   - 混雑時の自動リロード（人が判断して自分でリロードすること）
 *   ページを開いたあとは全部自分の手で操作する。これはただの正確な目覚まし時計。
 *
 * 使い方:
 *   node sale-timer.mjs "2026-08-15T12:00:00" "https://ticket.rakuten.co.jp/music/rtzpztk/"
 *
 * 環境変数:
 *   LEAD_MS=0     何ミリ秒手前で開くか（既定0=ちょうど）。マイナスで遅らせる
 *   NO_OPEN=1     ブラウザを開かない（練習用）
 */

import { exec } from "node:child_process";
import process from "node:process";

const TARGET_STR = process.argv[2];
const URL_STR = process.argv[3];
const LEAD_MS = Number(process.env.LEAD_MS ?? 0) || 0;
const NO_OPEN = process.env.NO_OPEN === "1";

if (!TARGET_STR || !URL_STR) {
  console.error('使い方: node sale-timer.mjs "2026-08-15T12:00:00" "https://..."');
  process.exit(1);
}

// ローカルタイム扱い（末尾にZやオフセットが無ければMacのタイムゾーンで解釈される）
const targetMs = new Date(TARGET_STR).getTime();
if (Number.isNaN(targetMs)) {
  console.error(`日時を解釈できません: ${TARGET_STR}`);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (ms) => {
  const s = Math.max(0, ms) / 1000;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}時間${String(m).padStart(2, "0")}分${sec.toFixed(1).padStart(4, "0")}秒`;
};

/**
 * サーバー時刻とローカル時刻のズレを測る。
 * Date ヘッダは秒単位までしか無いので、値が切り替わる瞬間を捕まえて
 * 「サーバーの秒が変わったローカル時刻」を特定し、精度を上げる。
 */
async function measureOffset(url) {
  const origin = new global.URL(url).origin;
  let prev = null;
  const deadline = Date.now() + 12_000; // 最大12秒だけ粘る

  while (Date.now() < deadline) {
    const t0 = Date.now();
    let res;
    try {
      res = await fetch(origin, {
        method: "HEAD",
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });
    } catch {
      await sleep(400);
      continue;
    }
    const t1 = Date.now();
    const dateHdr = res.headers.get("date");
    if (!dateHdr) return { offset: 0, accuracy: null };

    const serverSec = new Date(dateHdr).getTime(); // その秒の 000ms
    if (prev !== null && serverSec > prev.serverSec) {
      // 秒が繰り上がった瞬間を挟んだ。切り替わりはこの往復のどこか。
      const mid = (prev.t1 + t0) / 2; // 前回応答〜今回送信の中間をその瞬間とみなす
      const rtt = t1 - t0;
      return { offset: serverSec - mid, accuracy: Math.round((t0 - prev.t1 + rtt) / 2) };
    }
    prev = { serverSec, t1 };
    await sleep(120); // 秒境界を跨ぐまで細かく叩く（負荷にならない程度）
  }
  return { offset: 0, accuracy: null };
}

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

function speak(msg) {
  if (process.platform === "darwin") exec(`say -v Kyoko ${JSON.stringify(msg)}`, () => {});
}

function notify(title, msg) {
  if (process.platform === "darwin") {
    exec(
      `osascript -e 'display notification ${JSON.stringify(msg)} with title ${JSON.stringify(title)} sound name "Glass"'`,
      () => {}
    );
  }
}

console.log("=== 2nds watcher — sale-timer ===");
console.log(`開始時刻  : ${new Date(targetMs).toLocaleString("ja-JP")}`);
console.log(`開くURL   : ${URL_STR}`);
console.log(`前倒し    : ${LEAD_MS}ms`);
console.log("購入操作は自動化しません。ページを開いたら自分の手で進めてください。\n");

console.log("サーバー時刻とのズレを測定中…");
const { offset, accuracy } = await measureOffset(URL_STR);
if (accuracy === null) {
  console.log("⚠️ 測定できませんでした。Macの時計をそのまま使います。");
  console.log("   先に `sudo sntp -sS time.apple.com` で同期しておくと安心です。\n");
} else {
  console.log(
    `Macの時計はサーバーより ${Math.abs(Math.round(offset))}ms ${offset > 0 ? "遅れ" : "進み"}（測定誤差±${accuracy}ms）`
  );
  console.log("このズレを補正してカウントダウンします。\n");
}

// サーバー基準の現在時刻
const nowServer = () => Date.now() + offset;

let warned60 = false;
let warned10 = false;
let lastLine = "";

for (;;) {
  const remain = targetMs - nowServer() - LEAD_MS;
  if (remain <= 0) break;

  const line = `残り ${fmt(remain)}`;
  if (line !== lastLine) {
    process.stdout.write(`\r${line}   `);
    lastLine = line;
  }
  if (!warned60 && remain <= 60_000) {
    warned60 = true;
    console.log("\n⏰ 残り1分。ログイン状態と支払い方法を最終確認。");
    speak("残り1分です");
  }
  if (!warned10 && remain <= 10_000) {
    warned10 = true;
    console.log("\n⏰ 残り10秒。手をキーボードに。");
    speak("残り10秒");
  }
  // 直前は細かく、遠いときは粗く回す
  await sleep(remain > 5_000 ? 200 : 5);
}

console.log(`\n\n🎫 ${new Date().toLocaleTimeString("ja-JP")} 販売ページを開きます`);
openBrowser(URL_STR);
notify("2nds watcher", "販売開始。ページを開きました");
speak("販売開始です");
console.log("→ ここから先は自分の手で。混雑エラーが出たら、自分の判断でリロードを。");
