#!/usr/bin/env node
/**
 * 2nds watcher — seed-performances
 * known-performances.json（監視対象の公演日リスト）を作る。
 *
 * なぜ必要か:
 *   monitor-api.mjs の auto モードは getEventDates から公演日を拾うが、
 *   getEventDates は「いま出品がある公演」しか返さない。
 *   つまり一度も出品が出ていない公演（例: 福岡）は永久に登録されず、
 *   最初の1件が出た瞬間に 0.5〜2秒の発見遅れが生まれる。
 *   中央値6秒の世界ではそれが致命傷になる。
 *
 *   CSVログにも公演は残るが、"11月24日" という月日だけで時刻がない。
 *   APIのキーは "2026-11-24T19:00:00" の完全な日時なので月日では叩けない。
 *
 *   そこで、日付×開演時刻を総当たりで getTickets に投げ、
 *   「実在する公演」だけが返す応答を見分けて一覧を作る。
 *
 * 使い方:
 *   node seed-performances.mjs 2026-10-20 2026-11-30
 *   node seed-performances.mjs 2026-10-20 2026-11-30 --dry-run   # 書き込まない
 *
 * 環境変数:
 *   EVENT_ID=1004         乃木坂46
 *   TIMES=17:00,18:00,…   試す開演時刻（既定は下の CANDIDATE_TIMES）
 *   CONCURRENCY=4         同時リクエスト数
 *   DATES_FILE=known-performances.json
 */

import fs from "node:fs";
import process from "node:process";

const EVENT_ID = process.env.EVENT_ID ?? "1004";
const API = (start) =>
  `https://api.nft.rakuten.co.jp/products/v0/mp/tickets/getTickets/${EVENT_ID}/${start}`;
const DATES_FILE = process.env.DATES_FILE ?? "known-performances.json";
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY ?? 4) || 4);
const DRY_RUN = process.argv.includes("--dry-run");

// 国内ライブの開演時刻はほぼこの範囲に収まる（平日夜 / 土日昼夜）
const CANDIDATE_TIMES = (process.env.TIMES ??
  "12:00,13:00,14:00,15:00,16:00,17:00,17:30,18:00,18:30,19:00,19:30")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const COMMON_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Referer: "https://nft.rakuten.co.jp/",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 1件問い合わせて、応答の「形」を返す。実在判定はこの形の違いで行う */
async function probe(start) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(API(start), {
        headers: COMMON_HEADERS,
        signal: AbortSignal.timeout(8000),
      });
      const text = await res.text();
      return { start, status: res.status, len: text.length, body: text.slice(0, 200) };
    } catch (e) {
      if (attempt === 3) return { start, status: 0, len: 0, body: `ERR ${e.message}` };
      await sleep(400 * attempt);
    }
  }
}

/** 配列を並列度つきで順に処理 */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const n = i++;
        if (n >= items.length) return;
        out[n] = await fn(items[n], n);
      }
    })
  );
  return out;
}

function datesBetween(fromStr, toStr) {
  const out = [];
  const d = new Date(`${fromStr}T00:00:00Z`);
  const end = new Date(`${toStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(end.getTime())) return out;
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

// ─────────────────────────────────────────────
// 1. まず「実在する公演」と「存在しない日時」の応答が区別できるかを確かめる。
//    区別できないなら総当たりは無意味なので、ここで正直に止める。
// ─────────────────────────────────────────────
const KNOWN_REAL = process.env.KNOWN_REAL ?? "2026-11-17T19:00:00"; // Zepp Osaka Bayside 1日目
const KNOWN_FAKE = process.env.KNOWN_FAKE ?? "2026-11-17T03:00:00"; // 深夜3時公演は存在しない

console.log("=== 2nds watcher — seed-performances ===");
console.log(`イベントID: ${EVENT_ID}`);
console.log("\n[1/3] 実在する公演と存在しない日時を見分けられるか確認します…");
const [real, fake] = await Promise.all([probe(KNOWN_REAL), probe(KNOWN_FAKE)]);
console.log(`  実在するはず ${KNOWN_REAL} → HTTP ${real.status} / ${real.len}バイト`);
console.log(`              ${real.body}`);
console.log(`  存在しないはず ${KNOWN_FAKE} → HTTP ${fake.status} / ${fake.len}バイト`);
console.log(`              ${fake.body}`);

if (real.status === 0 || fake.status === 0) {
  console.error("\n✖ APIに届きませんでした。ネットワークを確認してください。");
  process.exit(1);
}

const discriminates = real.status !== fake.status || real.body !== fake.body;
if (!discriminates) {
  console.error(
    "\n✖ 実在する公演と存在しない日時の応答が同じでした。\n" +
      "  この方法では公演日を特定できません。総当たりは行いません。\n" +
      "  出品が出るたびに auto モードが拾うのを待つのが確実です。"
  );
  process.exit(2);
}
console.log("\n✔ 区別できます。この違いを基準に総当たりします。");

/** 実在判定: 「存在しない日時」と同じ応答でなければ実在とみなす */
const looksReal = (r) => r.status !== 0 && !(r.status === fake.status && r.body === fake.body);

// ─────────────────────────────────────────────
// 2. 総当たり
// ─────────────────────────────────────────────
const [from, to] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!from || !to) {
  console.error('\n使い方: node seed-performances.mjs 2026-10-20 2026-11-30');
  process.exit(1);
}
const days = datesBetween(from, to);
const candidates = days.flatMap((d) => CANDIDATE_TIMES.map((t) => `${d}T${t}:00`));
console.log(
  `\n[2/3] ${days.length}日 × ${CANDIDATE_TIMES.length}時刻 = ${candidates.length}件を問い合わせます（同時${CONCURRENCY}）…`
);

let done = 0;
const results = await mapLimit(candidates, CONCURRENCY, async (start) => {
  const r = await probe(start);
  done++;
  if (done % 20 === 0) process.stdout.write(`\r  ${done}/${candidates.length}   `);
  return r;
});
process.stdout.write(`\r  ${done}/${candidates.length}   \n`);

const found = results.filter(looksReal).map((r) => r.start).sort();

// ─────────────────────────────────────────────
// 3. 書き出し（既存の内容とマージ。消さない）
// ─────────────────────────────────────────────
console.log(`\n[3/3] 公演と判定: ${found.length}件`);
for (const s of found) {
  const d = new Date(s);
  const wd = "日月火水木金土"[d.getDay()];
  console.log(`  ${s}  ${d.getMonth() + 1}月${d.getDate()}日(${wd}) ${s.slice(11, 16)}`);
}
if (found.length === 0) {
  console.log("  （0件。期間を広げるか、TIMES に開演時刻を足してみてください）");
  process.exit(0);
}

let existing = [];
try {
  const v = JSON.parse(fs.readFileSync(DATES_FILE, "utf8"));
  if (Array.isArray(v)) existing = v.filter((x) => typeof x === "string");
} catch {
  // 無ければ新規
}
const merged = [...new Set([...existing, ...found])].sort();

if (DRY_RUN) {
  console.log(`\n--dry-run のため書き込みません（${DATES_FILE} は ${existing.length}件のまま）`);
} else {
  fs.writeFileSync(DATES_FILE, JSON.stringify(merged, null, 2) + "\n");
  console.log(
    `\n✔ ${DATES_FILE} に ${merged.length}件を保存しました（既存${existing.length} + 新規${merged.length - existing.length}）`
  );
  console.log("  monitor-api.mjs を auto で起動すると、最初から全公演を監視します。");
}
