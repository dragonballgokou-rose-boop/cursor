#!/usr/bin/env node
/**
 * 2nds watcher — 二次流通（secondary）を秒（seconds）単位で見張る
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

// 監視対象: "開演時刻=モード" のカンマ区切り。モードは all（全席種）| arena（アリーナのみ）| log（通知せず記録のみ）
// コマンド引数でも指定可（環境変数の書き方がOSで違うため）:
//   node monitor-api.mjs "2026-08-22T18:00:00=all"
// 全席確保済みのため、両日ともアリーナ指定のみ（アップグレード狙い）
const TARGET_SPEC =
  process.argv[2] ??
  process.env.TARGETS ??
  "2026-08-22T18:00:00=arena,2026-08-23T18:00:00=arena";

// "auto" を指定すると、監視しながら getEventDates で公演日を拾い続け、
// 新しい公演日が現れたら監視対象に足していく。
// 出品が1件も無い瞬間は getEventDates が空を返すため、起動時に一度だけ
// 取得する方式だと「そのとき出品のあった公演」しか掴めない。常に拾い直す。
const AUTO_MODE = /(^|,)\s*auto\s*(=|$|,)/.test(TARGET_SPEC);
const AUTO_EVENT_ID = process.env.EVENT_ID ?? TICKETS_API_BASE.split("/").pop();
const EVENT_DATES_API = process.env.EVENT_DATES_API ?? `https://api.nft.rakuten.co.jp/products/v0/mp/tickets/getEventDates/${AUTO_EVENT_ID}?limit=50`;
// 公演日の拾い直し間隔（サイクル数）。
// まだ1公演も掴めていない間は毎サイクル拾う。出品の寿命は数秒しかないので、
// 拾い直しの谷間に出た出品は、その公演ごと永久に見逃すことになるため。
// 公演を掴んだあとも、未知の公演に出た出品を拾うために短い間隔で見続ける。
const AUTO_REFRESH_EVERY = Math.max(1, Number(process.env.AUTO_REFRESH_EVERY ?? 1) || 1);

// 見つけた公演日を覚えておくファイル。再起動しても掴み直さずに済む。
// 出品が出た瞬間にしか公演日は拾えないので、毎回ゼロから探すと
// 静かな時間帯に起動したとき何も監視できない時間が続く。
const DATES_FILE = process.env.DATES_FILE ?? "known-performances.json";

function loadKnownDates() {
  try {
    const v = JSON.parse(fs.readFileSync(DATES_FILE, "utf8"));
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveKnownDates(dates) {
  try {
    fs.writeFileSync(DATES_FILE, JSON.stringify([...dates].sort(), null, 2) + "\n");
  } catch {
    // 保存できなくても監視は続ける
  }
}

// どうしても取りたい公演。滅多に出ない公演は、出たときの1回で決めるしかない。
// 他公演の通知に紛れて反応が遅れるのを防ぐため、鳴り方をはっきり変える。
const PRIORITY_SPEC = String(process.env.PRIORITY ?? "");
const PRIORITY_LIST = PRIORITY_SPEC.split(",").map((x) => x.trim()).filter(Boolean);
const isPriority = (start, label) =>
  PRIORITY_LIST.some((p) => start.startsWith(p) || label === p);

function makeTarget(start, mode = "all") {
  const dm = start.match(/-(\d{2})-(\d{2})T/) ?? [null, "?", "?"];
  const label = `${Number(dm[1])}月${Number(dm[2])}日`;
  return {
    start,
    mode,
    label,
    priority: isPriority(start, label),
    url: `${TICKETS_API_BASE}/${start}`,
    alerted: new Set(), // 通知済み出品ID
    // 同じ出品が何度も出入りする。誰かがカートに入れると一覧から消え、
    // 決済されなければ戻ってくるため。何回目かと前回からの間隔が分かれば、
    // 「待てば戻る」と判断できる。
    history: new Map(), // id → { count, lastGoneAt }
    seen: new Map(), // 現在掲載中の全出品（対象外含む）id → {seatName, price, firstSeen}
  };
}

const TARGETS = TARGET_SPEC.split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .filter((s) => !/^auto(=|$)/.test(s))
  .map((s) => {
    const [start, mode = "all"] = s.split("=").map((x) => x.trim());
    return makeTarget(start, mode);
  });

// auto のときの既定モード（auto=arena のように書ける）
const AUTO_DEFAULT_MODE = (TARGET_SPEC.match(/auto=(\w+)/) ?? [null, "all"])[1];

// 前回までに見つけた公演日を復元する
if (AUTO_MODE) {
  for (const start of loadKnownDates()) {
    if (!TARGETS.some((t) => t.start === start)) TARGETS.push(makeTarget(start, AUTO_DEFAULT_MODE));
  }
}

// 出品ゼロのときの応答は "{}" の2バイト。これを超える中身があるのに
// 日時が1つも取れないなら、空なのではなく読めていない。
const EMPTY_BODY_MAX = Number(process.env.EMPTY_BODY_MAX ?? 8) || 8;
let warnedUnparsed = false;

/** getEventDates を読み、まだ監視していない公演日を TARGETS に足す */
async function refreshTargets() {
  try {
    const res = await fetch(EVENT_DATES_API, {
      headers: COMMON_HEADERS,
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      console.log(`[${ts()}] ⚠️ 公演一覧の取得が HTTP ${res.status} を返しました`);
      return [];
    }
    const text = await res.text();
    const data = JSON.parse(text);
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

    // 「APIが空を返した」と「返ってきたJSONを読み損ねた」は画面上では
    // どちらも「何も起きていない」に見える。後者は静かな全盲なので、
    // 中身があるのに日時を1つも拾えなかったときは必ず声を上げる。
    if (found.size === 0 && text.length > EMPTY_BODY_MAX) {
      if (!warnedUnparsed) {
        warnedUnparsed = true;
        console.log(
          `[${ts()}] ⚠️ 公演一覧に日時が見つかりません（${text.length}バイト）。形式が変わった可能性があります:`
        );
        console.log(`   ${text.slice(0, 500)}`);
      }
    } else {
      warnedUnparsed = false;
    }

    const addedTargets = [];
    for (const start of [...found].sort()) {
      if (TARGETS.some((t) => t.start === start)) continue;
      const t = makeTarget(start, AUTO_DEFAULT_MODE);
      TARGETS.push(t);
      addedTargets.push(t);
      console.log(`[${ts()}] ＋公演を追加: ${t.label}（${start}）… ${TARGETS.length}公演を監視中`);
    }
    if (addedTargets.length > 0) saveKnownDates(TARGETS.map((t) => t.start));
    return addedTargets;
  } catch {
    // 取得できなくても監視は止めない
    return [];
  }
}

// 全出品の出現・消滅をCSVに記録する（頻度分析用）
const LOG_FILE = process.env.LOG_FILE ?? "listings-log.csv";
const nowLocal = () => new Date().toLocaleString("sv-SE"); // YYYY-MM-DD HH:mm:ss

function logCsv(event, target, id, seatName, price, note = "") {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      fs.writeFileSync(
        LOG_FILE,
        "timestamp,event,performance,start,seat_name,price,id,note\n"
      );
    }
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    fs.appendFileSync(
      LOG_FILE,
      [nowLocal(), event, target.label, target.start, seatName, price ?? "", id, note]
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

// キーワードを "a,b,c" → /a|b|c/ に。空なら「何にもマッチしない」正規表現を返す。
// new RegExp("") は全てにマッチしてしまうため、除外リストを空にすると
// 全出品が除外されるという事故が起きる。それを防ぐ。
function keywordPattern(csv, { emptyMatchesAll }) {
  const words = String(csv ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (words.length > 0) return new RegExp(words.join("|"));
  return emptyMatchesAll ? /(?:)/ : /(?!)/; // (?!) はどんな文字列にもマッチしない
}

// 通知しない席種（空にすると除外なし）
const EXCLUDE_PATTERN = keywordPattern(
  process.env.EXCLUDE_KEYWORDS ?? "バリアフリー,親子,女性,見切れ",
  { emptyMatchesAll: false }
);

// この価格未満の出品は通知しない（0で無効化）。
// 指定席12,000/注釈付11,000/見切れ9,900 なので、12000なら指定席・アリーナのみ
const MIN_PRICE = Number(process.env.MIN_PRICE ?? 12000) || 0;

// この席種名を含む出品だけ通知する（許可リスト。空にすると全席種が対象）
const ALLOW_PATTERN = keywordPattern(process.env.SEAT_KEYWORDS ?? "指定席,アリーナ", {
  emptyMatchesAll: true,
});

// arena モードで通知する席種
const ARENA_PATTERN = keywordPattern(process.env.ARENA_KEYWORDS ?? "アリーナ", {
  emptyMatchesAll: false,
});

// log モードの公演を何サイクルに1回チェックするか
const LOG_EVERY = Math.max(1, Number(process.env.LOG_EVERY ?? 5) || 5);
// 速くするほど取れる確率は上がるが、叩きすぎて弾かれたら全部失う。
// 基準の間隔で回しつつ、429 が出たら自動で広げ、落ち着いたら少しずつ戻す。
// 戻すのを遅くしているのは、弾かれるくらいなら遅いほうがましだから。
const BASE_INTERVAL_SEC = Math.max(0.1, Number(process.env.CHECK_INTERVAL ?? 1) || 1);
const MAX_INTERVAL_SEC = Math.max(BASE_INTERVAL_SEC, Number(process.env.MAX_INTERVAL ?? 5) || 5);
const RECOVER_CYCLES = Math.max(1, Number(process.env.RECOVER_CYCLES ?? 240) || 240);
let intervalSec = BASE_INTERVAL_SEC;
let throttleHits = 0;
let calmCycles = 0;
let lastCycleMs = 0;
const NO_OPEN = process.env.NO_OPEN === "1";

// スマホ通知（任意）。ntfy アプリで購読しているトピック名を入れると、
// 検知時にスマホへプッシュが飛び、タップで出品ページが開く。
// トピック名はURLを知っていれば誰でも購読できるので、推測されにくい文字列にすること。
const NTFY_TOPIC = process.env.NTFY_TOPIC ?? "";
const NTFY_SERVER = process.env.NTFY_SERVER ?? "https://ntfy.sh";

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

// スマホへのプッシュ通知（ntfy.sh）。
// NTFY_TOPIC を設定したときだけ有効。タップすると click のURLがスマホのブラウザで開く。
// ヘッダに日本語を入れるとHTTPヘッダがASCII制限で壊れるため、JSON publish を使う。
function pushPhone(title, message, url) {
  if (!NTFY_TOPIC) return;
  const body = JSON.stringify({
    topic: NTFY_TOPIC,
    title,
    message,
    click: url,
    priority: 5, // max: 端末のサイレント設定を越えて鳴らす
    tags: ["ticket"],
  });
  // 監視ループを止めないよう await しない（失敗しても握りつぶす）
  fetch(NTFY_SERVER, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  }).catch(() => {});
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
  } else if (res.status === 429) {
    throttleHits++;
    throw new Error("HTTP 429 — 叩きすぎです");
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
      const h = t.history.get(key) ?? { count: 0, lastGoneAt: null };
      h.count++;
      h.gapSec = h.lastGoneAt ? Math.round((Date.now() - h.lastGoneAt) / 1000) : null;
      t.history.set(key, h);
      logCsv("appear", t, key, i.seatName, i.price, h.count > 1 ? `${h.count}回目` : "");
    }
  }
  for (const [key, info] of [...t.seen]) {
    if (!currentIds.has(key)) {
      const lifeSec = Math.round((Date.now() - info.firstSeen) / 1000);
      t.seen.delete(key);
      const h = t.history.get(key);
      if (h) h.lastGoneAt = Date.now();
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
      (t.mode === "all" || (t.mode === "arena" && i.arena))
  );
  const okIds = okItems.map((i) => i.id ?? i.raw.slice(0, 60));

  const fresh = okItems.filter((i) => !t.alerted.has(i.id ?? i.raw.slice(0, 60)));
  if (fresh.length > 0) {
    fresh.forEach((i) => t.alerted.add(i.id ?? i.raw.slice(0, 60)));
    const first = fresh[0];
    const url = first.id ? ITEM_URL_TEMPLATE.replace("{id}", first.id) : OPEN_URL;
    openBrowser(url);
    const what = first.arena ? "アリーナ席" : "チケット";
    if (t.priority) {
      // 最優先公演は聞き逃しが致命傷になるので、しつこく読み上げる
      speak(`${t.label}です。${t.label}が出ました。今すぐ決済してください`);
      setTimeout(() => speak(`${t.label}です。急いでください`), 2500);
    } else {
      speak(`${t.label}に${what}が出ました。かごに入れてください`);
    }
    console.log("");
    const banner = t.priority ? "🚨🚨🚨 最優先" : "🎫🎫🎫";
    console.log(`\n${banner} [${ts()}] ${t.label} 購入可能な出品を検知！（${fresh.length}件・${t.mode === "arena" ? "アリーナ" : "全席種"}）`);
    const fh = t.history.get(first.id ?? first.raw.slice(0, 60));
    if (fh && fh.count > 1) {
      console.log(
        `   ♻️ この出品は${fh.count}回目です${fh.gapSec != null ? `（前回消えてから${fh.gapSec}秒）` : ""}。` +
          `取られても決済されなければまた戻ります。`
      );
    }
    if (t.priority) console.log("   ⚠️ カートに入れただけでは確保されません。決済を完了させた人が勝ちます。");
    console.log(`   ${first.raw.slice(0, 300)}`);
    console.log(`→ ${url}\n`);
    notify(
      t.priority ? "🚨 最優先公演！今すぐ決済" : "みんなのチケット ⚡検知",
      `${t.label} ${what} ${fresh.length}件`
    );
    pushPhone(
      `🎫 ${t.label} ${what}`,
      `${fresh.length}件検知。タップで出品ページを開く`,
      url
    );
  }

  // 消えた出品はリセットして、再出品されたら再び鳴るようにする
  for (const id of [...t.alerted]) {
    if (!okIds.includes(id)) {
      t.alerted.delete(id);
      // 消えた＝売れた とは限らない。誰かがカートに入れただけなら、
      // 決済されずに戻ってくる。だから諦めずに待つ価値がある。
      const h = t.history.get(id);
      const again = h && h.count > 1 ? `・通算${h.count}回` : "";
      console.log(
        `[${ts()}] ${t.label} の出品が消えました: ${id}${again}` +
          (t.priority ? "（決済されなければ戻ります。離席しないでください）" : "")
      );
    }
  }

  const skipped = items.length - okItems.length;
  return `${t.label}=${okItems.length}件` + (skipped > 0 ? `(対象外${skipped})` : "");
}

async function checkOnce() {
  checkCount++;

  // auto のときは毎サイクル公演日を拾い直す。
  //
  // getEventDates は「いま出品がある公演」しか返さないので、まだ一度も
  // 出品が出ていない公演（福岡など）を事前に登録しておく方法が無い。
  // getTickets に日付×開演時刻を総当たりする手も試したが、存在しない日時にも
  // HTTP 200 の空レスポンスを返すため実在判定ができなかった（seed は断念）。
  //
  // 事前に知れないなら「出た瞬間に拾う」しかない。そこで
  //   1. getEventDates をチケット取得と同時に走らせ（サイクル時間を伸ばさない）
  //   2. 新しい公演が見つかったらその場で即チェックする（次サイクルを待たない）
  // ことで、未知の公演でも既知の公演と同じ速さで最初の1件に反応する。
  const jobs = [];
  if (AUTO_MODE && (checkCount - 1) % AUTO_REFRESH_EVERY === 0) {
    jobs.push(
      refreshTargets().then((added) =>
        added.length > 0 ? Promise.allSettled(added.map((t) => checkTarget(t))) : null
      )
    );
  }

  if (TARGETS.length === 0) {
    if (checkCount % 20 === 1) console.log(`[${ts()}] 公演日の登場を待っています（出品ゼロの間は空）`);
    await Promise.allSettled(jobs);
    return;
  }
  // 全公演を並列チェック（1公演あたり50〜100msなのでサイクルはほぼ変わらない）
  // log モード（記録のみ）の公演は LOG_EVERY サイクルに1回だけ見る（アクセス数を抑える）
  const active = TARGETS.filter((t) => t.mode !== "log" || (checkCount - 1) % LOG_EVERY === 0);
  const settled = await Promise.allSettled([...jobs, ...active.map((t) => checkTarget(t))]);
  const results = settled.slice(jobs.length);

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

  if (throttleHits > 0) {
    throttleHits = 0;
    calmCycles = 0;
    const next = Math.min(MAX_INTERVAL_SEC, Math.round(intervalSec * 2 * 100) / 100);
    if (next !== intervalSec) {
      intervalSec = next;
      console.log(`[${ts()}] ⚠️ 429が出ました。間隔を ${intervalSec}秒 に広げます（弾かれるより遅いほうがまし）`);
    }
  } else if (intervalSec > BASE_INTERVAL_SEC && ++calmCycles >= RECOVER_CYCLES) {
    calmCycles = 0;
    intervalSec = Math.max(BASE_INTERVAL_SEC, Math.round((intervalSec / 2) * 100) / 100);
    console.log(`[${ts()}] 落ち着いたので間隔を ${intervalSec}秒 に戻します`);
  }

  if (checkCount % 30 === 1) {
    const parts = results.map((r) => (r.status === "fulfilled" ? r.value : "取得失敗"));
    // 公演が増えると1行に収まらず折り返して読みにくい。出品ゼロが普通の状態
    // なので、全公演ゼロのときは1行にまとめる。中身があるときだけ内訳を出す。
    const allEmpty = parts.every((p) => /=0件$/.test(p));
    const summary = allEmpty ? `${parts.length}公演すべて0件` : parts.join(" / ");
    // 実際の検知の遅れ = 間隔 + 1周にかかった時間。体感ではなく数字で出す。
    const lag = `${intervalSec}秒間隔・1周${lastCycleMs}ms`;
    console.log(`[${ts()}] 監視中（${checkCount}回目）: ${summary}（${lag}）`);
  }
}

// CSVを定期的にGitHubへ自動プッシュ（分析ページの自動更新用）。
// GIT_SYNC=0 で無効化。失敗しても監視は止めない
const GIT_SYNC = process.env.GIT_SYNC !== "0";
const SYNC_INTERVAL_MIN = Math.max(5, Number(process.env.SYNC_INTERVAL_MIN ?? 10) || 10);

function syncLogToGit() {
  if (!GIT_SYNC) return;
  // 順番が重要: CSVは常に書き込まれ続けているため、
  // 「先にコミットして作業ツリーを綺麗にする → pull --rebase → push」の順にする。
  // （pullを先にすると未保存の変更でrebaseが必ず失敗する）
  // commitは「変更なし」で失敗してよい（|| true）。未送信コミットも毎回pushで回収
  const cmd =
    `cd "${process.cwd()}" && ` +
    `git add "${LOG_FILE}" && ` +
    `(git -c user.name="ticket-watcher" -c user.email="watcher@local" commit -q -m "chore: update listings log" || true) && ` +
    `git pull --rebase -q && ` +
    `git push -q`;
  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      // 実際の失敗理由を表示する（認証・競合など切り分けられるように）
      const detail =
        String(stderr || err.message || "")
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(-1)[0] ?? "不明";
      console.log(`[${ts()}] ログ同期失敗: ${detail.slice(0, 140)}（監視は継続）`);
    } else {
      console.log(`[${ts()}] ログをGitHubへ同期しました`);
    }
  });
}
if (GIT_SYNC) setInterval(syncLogToGit, SYNC_INTERVAL_MIN * 60 * 1000);

console.log("=== 2nds watcher — みんなのチケット リセール出品ウォッチャー（API版・最速） ===");
for (const t of TARGETS) {
  console.log(
    `対象公演  : ${t.label}（${t.start}）… ${t.mode === "arena" ? "アリーナのみ" : t.mode === "log" ? `記録のみ（${LOG_EVERY}サイクルに1回）` : "全席種"}${t.priority ? "  🚨最優先" : ""}`
  );
}
console.log(`対象席種  : ${process.env.SEAT_KEYWORDS ?? "指定席,アリーナ"}（${MIN_PRICE > 0 ? `${MIN_PRICE.toLocaleString()}円以上` : "価格制限なし"}）`);
console.log(`除外席種  : ${process.env.EXCLUDE_KEYWORDS ?? "バリアフリー,親子,女性,見切れ"}`);
console.log(`間隔      : ${BASE_INTERVAL_SEC}秒（429が出たら自動で最大${MAX_INTERVAL_SEC}秒まで広げます）`);
console.log(`記録      : 全出品の出現・消滅を ${LOG_FILE} に記録（頻度分析用）`);
console.log(
  `スマホ通知: ${NTFY_TOPIC ? `ON（${NTFY_SERVER}/${NTFY_TOPIC}）` : "OFF（NTFY_TOPIC=好きな文字列 を付けると有効）"}`
);
console.log("検知したら出品詳細ページを直接開きます。購入は自分の手で。");
console.log("⚠️ 同日複数枚は同行者に分配不可。友達の分は友達のアカウントで購入を。");
console.log("Ctrl+C で終了\n");

while (true) {
  const t0 = Date.now();
  await checkOnce();
  lastCycleMs = Date.now() - t0;
  // 1周に時間がかかった分は待ち時間から引く。間隔どおりの頻度を保つため。
  await sleep(Math.max(0, intervalSec * 1000 - lastCycleMs));
}
