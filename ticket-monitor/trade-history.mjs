#!/usr/bin/env node
/**
 * 2nds watcher — trade-history
 * 記録済みの出品ID（RTK_…）ごとに、みんなのチケットの取引履歴APIを読んで
 * 「いつ発行され・いつ誰に売れたか」を trade-history.json にまとめる。
 *
 * 出品一覧API（getTickets）では「消えた理由」が分からない。
 * 取引履歴APIなら transfer（売買成立）の時刻がミリ秒単位で分かるので、
 * 「出現から何秒で決済まで済んだか」＝相手の速さを測れる。
 *
 * 読むだけ。購入・出品操作は一切しない。
 *
 * 使い方:
 *   node trade-history.mjs [CSV...]        既定: listings-6ki-resale.csv listings-log.csv
 *
 * 環境変数:
 *   OUT=trade-history.json   出力先
 *   CONCURRENCY=2            同時リクエスト数（監視プロセスの邪魔をしないよう控えめに）
 *   GAP_MS=200               リクエスト間の待ち（ミリ秒）
 */

import fs from "node:fs";
import process from "node:process";

const FILES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["listings-6ki-resale.csv", "listings-log.csv"].filter((f) => fs.existsSync(f));
const OUT = process.env.OUT ?? "trade-history.json";
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY ?? 2) || 2);
const GAP_MS = Math.max(0, Number(process.env.GAP_MS ?? 200) || 200);
const API = "https://api.nft.rakuten.co.jp/products/v0/mp/marketplace/get-transaction-history?collectible_symbol=";
const HEADERS = {
  Accept: "application/json",
  Origin: "https://nft.rakuten.co.jp",
  Referer: "https://nft.rakuten.co.jp/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** CSVの1行を列に分ける（"a","b" 形式のみ） */
function splitCsv(line) {
  const out = [];
  const re = /"((?:[^"]|"")*)"/g;
  let m;
  while ((m = re.exec(line))) out.push(m[1].replace(/""/g, '"'));
  return out;
}

// 出品ID → その出品を最初に見た時刻（CSVの appear 行）
const firstSeen = new Map();
for (const file of FILES) {
  const lines = fs.readFileSync(file, "utf8").split("\n").slice(1);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = splitCsv(line);
    // 旧7列: timestamp,event,performance,seat_name,price,id,note
    // 新8列: timestamp,event,performance,start,seat_name,price,id,note
    const id = cols.find((c) => /^RTK_/.test(c));
    if (!id) continue;
    if (cols[1] === "appear" && !firstSeen.has(id)) firstSeen.set(id, cols[0]);
  }
}

// 既に取れている分は飛ばす（途中で止めても続きから再開できる）
const result = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const todo = [...firstSeen.keys()].filter((id) => !result[id] || result[id].error);
console.log(`出品ID ${firstSeen.size}件（うち未取得 ${todo.length}件）を ${CONCURRENCY}並列・${GAP_MS}ms間隔で取得します → ${OUT}`);

let done = 0;
let failed = 0;
async function worker() {
  while (todo.length > 0) {
    const id = todo.shift();
    try {
      const res = await fetch(API + id, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
      if (res.status === 429) {
        console.log(`429 を受けたので 10秒休みます（${id}）`);
        todo.unshift(id);
        await sleep(10_000);
        continue;
      }
      const data = res.ok ? await res.json() : { error: `HTTP ${res.status}` };
      result[id] = { first_seen: firstSeen.get(id), ...data };
      if (data.error) failed++;
    } catch (e) {
      failed++;
      result[id] = { first_seen: firstSeen.get(id), error: e.message };
    }
    done++;
    if (done % 20 === 0) {
      fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
      console.log(`${done}件取得（失敗 ${failed}）`);
    }
    await sleep(GAP_MS);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
fs.writeFileSync(OUT, JSON.stringify(result, null, 1));

// 要約: 出現→transfer（売買成立）までの秒数
const lags = [];
let sold = 0;
for (const h of Object.values(result)) {
  const t = (h.history ?? []).find((x) => x.transactionType === "transfer");
  if (!t) continue;
  sold++;
  const lag = (new Date(t.time) - new Date(h.first_seen.replace(" ", "T") + "+09:00")) / 1000;
  if (Number.isFinite(lag)) lags.push(lag);
}
lags.sort((a, b) => a - b);
const q = (p) => lags[Math.min(lags.length - 1, Math.floor(lags.length * p))];
console.log(`完了: ${done}件取得・失敗 ${failed}件。売買成立(transfer)あり ${sold}件`);
if (lags.length) {
  console.log(
    `出現→決済完了までの秒数: 最小 ${q(0).toFixed(1)} / 中央値 ${q(0.5).toFixed(1)} / 90% ${q(0.9).toFixed(1)} / 最大 ${q(1).toFixed(1)}`
  );
}
