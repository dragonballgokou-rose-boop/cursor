#!/usr/bin/env node
/**
 * 2nds watcher — restock-watcher
 * 楽天チケットの公演ボタンが「予定枚数終了」などから「購入する」に戻った瞬間に知らせる。
 * （キャンセル・戻り分の再販を拾うため）
 *
 * 販売ページ自身のスクリプトが読んでいる公開ウィジェットAPIを、緩い間隔で読むだけ。
 * 「購入する」が出たら読み上げ・通知し、その公演の申込ページをブラウザで開く。
 * 申込・決済は一切しない。ここから先は自分の手で。
 *
 * 使い方:
 *   node restock-watcher.mjs RTZP626:1108627 "1=10/26 神奈川,10=12/2 福岡" [間隔秒(既定3・最短2)]
 *
 * 環境変数:
 *   NO_OPEN=1   ブラウザを開かず、読み上げ・通知もしない（テスト用）
 *   WIDGET_API  ウィジェットAPIのURL（テスト用に差し替え可）
 *   PAGE_URL    Referer に使う販売ページURL
 */

import { execFile } from "node:child_process";
import process from "node:process";

const [ecd, eid] = String(process.argv[2] ?? "").split(":");
const PERFS = String(process.argv[3] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    const [id, label = `perf ${s}`] = s.split("=");
    return { id: id.trim(), label: label.trim(), opened: false };
  });
const INTERVAL_SEC = Math.max(2, Number(process.argv[4] ?? 3) || 3);
const NO_OPEN = process.env.NO_OPEN === "1";
const WIDGET_API =
  process.env.WIDGET_API ?? "https://cms-api.ticket.rakuten.co.jp/coreui/ajax/performance/widget";
const PAGE_URL = process.env.PAGE_URL ?? `https://ticket.rakuten.co.jp/music/${String(ecd).toLowerCase()}/`;

if (!ecd || !eid || PERFS.length === 0) {
  console.error('使い方: node restock-watcher.mjs RTZP626:1108627 "1=10/26 神奈川,10=12/2 福岡" [間隔秒(既定3・最短2)]');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ts = () => new Date().toLocaleTimeString("ja-JP", { hour12: false });
const run = (cmd, args) => {
  if (!NO_OPEN && process.platform === "darwin") execFile(cmd, args, () => {});
};
const openBrowser = (url) => run("open", [url]);
const speak = (msg) => run("say", ["-v", "Kyoko", msg]);
const notify = (title, msg) =>
  run("osascript", [
    "-e",
    `display notification ${JSON.stringify(msg)} with title ${JSON.stringify(title)} sound name "Glass"`,
  ]);

console.log("=== 2nds watcher — restock-watcher ===");
console.log(`対象      : ${PERFS.map((p) => `${p.label}(perf ${p.id})`).join(" / ")}`);
console.log(`間隔      : ${INTERVAL_SEC}秒`);
console.log("「購入する」に戻ったら知らせて申込ページを開きます。申込・決済はしません。\n");

let lastStates = "";
for (let n = 1; ; n++) {
  try {
    const res = await fetch(WIDGET_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Origin: new URL(PAGE_URL).origin,
        Referer: PAGE_URL,
      },
      body: new URLSearchParams({ ids: PERFS.map((p) => p.id).join(","), ecd, eid }),
      signal: AbortSignal.timeout(8000),
    });
    const map = Object.assign({}, ...(await res.json()));
    const states = [];
    for (const p of PERFS) {
      const html = String(map[`perf_${p.id}`] ?? "");
      const m = html.match(/href="([^"]+)"/);
      const text = html.replace(/<[^>]+>/g, "").trim() || "?";
      states.push(`${p.label}=${text}`);
      if (m && !p.opened) {
        p.opened = true;
        const link = new URL(m[1].replace(/&amp;/g, "&"), PAGE_URL).href;
        console.log(`\n🎫🎫🎫 [${ts()}] ${p.label} が「${text}」になりました → ${link}\n`);
        openBrowser(link);
        notify("2nds watcher", `${p.label} が購入可能になりました`);
        speak(`${p.label} 購入できます`);
      } else if (!m) {
        p.opened = false; // また売り切れたら、次に戻ったとき再通知する
      }
    }
    const line = states.join(" / ");
    if (line !== lastStates) {
      console.log(`[${ts()}] ${line}`);
      lastStates = line;
    } else if (n % 30 === 0) {
      console.log(`[${ts()}] 監視中（${n}回目）: 変化なし`);
    }
  } catch (e) {
    console.log(`[${ts()}] 取得失敗: ${e.message}（継続）`);
  }
  await sleep(INTERVAL_SEC * 1000);
}
