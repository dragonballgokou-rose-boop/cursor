#!/usr/bin/env node
/**
 * みんなのチケット リセール出品ウォッチャー（ブラウザ版）
 *
 * marketplace ページは JavaScript で描画されるため、単純な fetch では
 * 出品リストが取れないことがある。この版は Playwright で実際にページを
 * レンダリングしてからキーワードを探す。
 *
 * 検知ルール:
 *   1. WATCH_KEYWORDS の日付（デフォルト 8/23(日)）: 除外席種以外の出品が出たら通知
 *   2. SPECIAL_SEAT_KEYWORDS の席種（デフォルト アリーナ）: どの日でも出たら通知
 *
 * ⚠️ 通知のみ。購入は必ず自分の手で行うこと（自動購入は規約違反）。
 *
 * 準備:
 *   cd ticket-monitor
 *   npm install
 *   npx playwright install chromium
 *
 * 使い方:
 *   node monitor-browser.mjs
 */

import { exec } from "node:child_process";
import process from "node:process";
import { chromium } from "playwright";

const TARGET_URL =
  process.env.TARGET_URL ??
  "https://nft.rakuten.co.jp/marketplace/?type=ticket&sort=last_updated_date&limit=12&ticketlimit=6&provider=nogizaka";

// 公演行は「〔8/20(木)｜東京〕 乃木坂46 …」形式なので、曜日付きで判定して
// 「販売終了日時: 2026/08/22」のような日付表記への誤検知を防ぐ
// ※ 8/22(土) は確保済みのため監視対象から外している（誤購入防止）
const WATCH_KEYWORDS = (process.env.WATCH_KEYWORDS ?? "8/23(日),8/23（日）")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// この席種はどの日付でも通知する（空文字で無効化）
const SPECIAL_SEAT_RAW = (process.env.SPECIAL_SEAT_KEYWORDS ?? "アリーナ")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const SPECIAL_SEAT_PATTERN =
  SPECIAL_SEAT_RAW.length > 0 ? new RegExp(SPECIAL_SEAT_RAW.join("|")) : null;

// 最短1秒。前回チェック完了から次の開始までの待ち時間（重複実行はしない）
const CHECK_INTERVAL_SEC = Math.max(1, Number(process.env.CHECK_INTERVAL ?? 1) || 1);
const NO_OPEN = process.env.NO_OPEN === "1";

// 出品の中身（価格・購入可否）を示す文言
const SEAT_PATTERN = /円|購入|カートに入れる|残り|枚|席/;

// 通知しない席種（EXCLUDE_KEYWORDS で変更可、カンマ区切り）
const EXCLUDE_PATTERN = new RegExp(
  (process.env.EXCLUDE_KEYWORDS ?? "バリアフリー,親子,女性")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join("|")
);

// ログイン・認証系のURL（出品ページとして開いてはいけない）
const AUTH_URL_PATTERN = /login|signin|sign-in|authorize|auth|id\.rakuten|grp\d+\.id/i;

// ページ上の公演日ヘッダー「8/20(木)」「8/23（日）」を拾う
const DATE_ROW_RE = /\d{1,2}\/\d{1,2}\s*[\(（][月火水木金土日][\)）]/g;

const ts = () => new Date().toLocaleTimeString("ja-JP", { hour12: false });
const norm = (s) => s.replace(/（/g, "(").replace(/）/g, ")").replace(/\s/g, "");
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

/** 音声で読み上げて確実に気付かせる（macOS）。操作は一切不要 */
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

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "ja-JP" });
const page = await context.newPage();

// 画像・動画・フォントはブロックして読み込みを高速化
await page.route("**/*", (route) => {
  const type = route.request().resourceType();
  if (["image", "media", "font"].includes(type)) return route.abort();
  return route.continue();
});

let alreadyAlerted = new Set();
let checkCount = 0;

async function getPageText() {
  // networkidle は楽天のページでは永遠に来ない（計測通信が続く）ので使わない。
  // DOM構築後、出品リストの描画を最大10秒待つ。
  await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
  try {
    await page.waitForFunction(
      () => /販売中|アイテム|乃木坂/.test(document.body.innerText),
      { timeout: 10_000 }
    );
  } catch {
    // リストが読めなくても本文で判定は試みる
  }
  return page.evaluate(() => document.body.innerText);
}

/**
 * 公演日の行をクリックして展開し、その公演の中身（席種・価格の行）を返す。
 */
async function expandAndExtract(rowLabel) {
  try {
    const row = page.getByText(rowLabel).first();
    if ((await row.count()) === 0) return null;
    await row.click({ timeout: 3_000 });
    await page.waitForTimeout(800); // 展開アニメーション待ち
  } catch {
    // クリックできなくても現状のテキストで判定を試みる
  }

  const text = await page.evaluate(() => document.body.innerText);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const idx = lines.findIndex((l) => l.includes(rowLabel));
  if (idx === -1) return null;

  // 行の直後から、次の公演日ヘッダーが来るまでを「この公演の中身」とみなす
  const section = [];
  for (let i = idx + 1; i < lines.length && section.length < 20; i++) {
    if (DATE_ROW_RE.test(lines[i]) && !lines[i].includes(rowLabel)) {
      DATE_ROW_RE.lastIndex = 0;
      break;
    }
    DATE_ROW_RE.lastIndex = 0;
    section.push(lines[i]);
  }

  // 除外席種（バリアフリー・親子・女性など）の判定。
  // 席種名と価格・残数が数行離れて表示されることがあるため、
  // 除外語が出た行の前2行〜後4行を「除外ゾーン」としてブロックごと弾く
  const excludeIdx = [];
  section.forEach((l, i) => {
    if (EXCLUDE_PATTERN.test(l)) excludeIdx.push(i);
  });
  const inExcludeZone = (i) => excludeIdx.some((e) => i >= e - 2 && i <= e + 4);

  const excludedLines = [];
  const seatLines = section.filter((l, i) => {
    if (!SEAT_PATTERN.test(l)) return false;
    if (inExcludeZone(i)) {
      excludedLines.push(l);
      return false;
    }
    return true;
  });

  // どの日でも通知する特別席種（アリーナ等）。同じく除外ゾーンは弾く
  const specialIdx = [];
  if (SPECIAL_SEAT_PATTERN) {
    section.forEach((l, i) => {
      if (SPECIAL_SEAT_PATTERN.test(l)) specialIdx.push(i);
    });
  }
  const inSpecialZone = (i) => specialIdx.some((e) => i >= e - 2 && i <= e + 4);
  const specialLines = section.filter(
    (l, i) => SEAT_PATTERN.test(l) && inSpecialZone(i) && !inExcludeZone(i)
  );

  return { section, seatLines, excludedLines, specialLines };
}

/**
 * 検知した出品をクリックし、遷移先URLを「席を押したあとの画面」として返す。
 * 監視用ブラウザは未ログインなのでログインページへ飛ばされることがあり、
 * そのURLは採用しない（Safariで開くとログイン画面になってしまうため）。
 * 終わったら一覧ページへ戻す。
 */
async function resolveItemUrl(snippet) {
  let url = null;
  try {
    const el = page.getByText(snippet.slice(0, 20)).first();
    if ((await el.count()) > 0) {
      const before = page.url();
      await el.click({ timeout: 2_000 });
      await page.waitForTimeout(1_200);
      const after = page.url();
      if (
        after !== before &&
        after.includes("nft.rakuten.co.jp") &&
        !AUTH_URL_PATTERN.test(after)
      ) {
        url = after;
      }
    }
  } catch {
    // クリックで取れなければフォールバックへ
  }

  if (!url) {
    // フォールバック: nft.rakuten.co.jp 内の出品詳細らしいリンクのみ対象
    url = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a[href]"));
      const a = anchors.find(
        (a) =>
          a.href.includes("nft.rakuten.co.jp") &&
          /item|detail/.test(a.href) &&
          !/login|signin|sign-in|authorize|auth|id\.rakuten/i.test(a.href) &&
          !a.href.includes("marketplace/?")
      );
      return a ? a.href : null;
    });
  }

  // 一覧ページへ戻す
  if (!page.url().startsWith(TARGET_URL.split("?")[0])) {
    await page
      .goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 30_000 })
      .catch(() => {});
  }
  return url;
}

function fireAlert(label, alertLines, gotoUrl, speech) {
  openBrowser(gotoUrl);
  speak(speech);
  console.log("");
  console.log(`\n🎫🎫🎫 [${ts()}] ${label}`);
  alertLines.slice(0, 6).forEach((l) => console.log(`   ${l}`));
  console.log(`→ 今すぐ確認: ${gotoUrl}\n`);
  notify("みんなのチケット 出品検知", `${label}: ${alertLines[0] ?? ""}`);
}

async function checkOnce() {
  checkCount++;
  let text;
  try {
    text = await getPageText();
  } catch (err) {
    console.log(`[${ts()}] 取得失敗: ${err.message.split("\n")[0]}（次回リトライ）`);
    return;
  }

  // ページ上の公演日行をすべて拾う（正規化した日付 → ページ上の表記）
  const dateMap = new Map();
  for (const d of text.match(DATE_ROW_RE) ?? []) {
    const n = norm(d);
    if (!dateMap.has(n)) dateMap.set(n, d);
  }

  const watchSet = new Set(WATCH_KEYWORDS.map(norm));
  // 優先日（8/23）を先に処理して、アリーナ検索より先に通知できるようにする
  const ordered = [...dateMap.keys()].sort(
    (a, b) => (watchSet.has(b) ? 1 : 0) - (watchSet.has(a) ? 1 : 0)
  );

  const foundKeys = new Set();
  const statusNotes = [];

  for (const nDate of ordered) {
    const rowLabel = dateMap.get(nDate);
    const isWatch = watchSet.has(nDate);
    const result = await expandAndExtract(rowLabel);
    if (!result) continue;

    let key = null;
    let label = null;
    let alertLines = null;
    let speech = null;

    if (isWatch && result.seatLines.length > 0) {
      key = `date:${nDate}`;
      label = `購入可能な出品を検知: ${nDate}`;
      alertLines = result.seatLines;
      speech = `${nDate.replace(/[()（）]/g, " ")} のチケットが出ました`;
    } else if (result.specialLines.length > 0) {
      key = `special:${nDate}`;
      label = `アリーナ席を検知: ${nDate}`;
      alertLines = result.specialLines;
      speech = `${nDate.replace(/[()（）]/g, " ")} にアリーナ席が出ました`;
    }

    if (key) {
      foundKeys.add(key);
      if (!alreadyAlerted.has(key)) {
        alreadyAlerted.add(key);
        const gotoUrl = (await resolveItemUrl(alertLines[0])) ?? TARGET_URL;
        fireAlert(label, alertLines, gotoUrl, speech);
      }
    } else if (isWatch) {
      statusNotes.push(
        result.excludedLines.length > 0
          ? `${nDate}: 除外席種のみ（${result.excludedLines[0]}）`
          : `${nDate}: 出品なし`
      );
    }
  }

  // 消えた出品は検知済みリストから外し、次に出たとき再通知できるようにする
  for (const k of [...alreadyAlerted]) {
    if (!foundKeys.has(k)) alreadyAlerted.delete(k);
  }

  if (checkCount % 10 === 1) {
    if (alreadyAlerted.size > 0) {
      console.log(`[${ts()}] 検知済み: ${[...alreadyAlerted].join(", ")}（引き続き掲載中）`);
    } else if (statusNotes.length > 0) {
      console.log(`[${ts()}] ${statusNotes.join(" / ")}・アリーナなし（監視継続・${checkCount}回）`);
    } else {
      console.log(`[${ts()}] 対象の出品なし（監視継続・${checkCount}回チェック済み）`);
    }
  }
}

console.log("=== みんなのチケット リセール出品ウォッチャー（ブラウザ版） ===");
console.log(`監視URL   : ${TARGET_URL}`);
console.log(`優先日    : ${WATCH_KEYWORDS.join(", ")}（全席種）`);
console.log(
  `特別席種  : ${SPECIAL_SEAT_RAW.length > 0 ? `${SPECIAL_SEAT_RAW.join(", ")}（全日程）` : "なし"}`
);
console.log(`除外席種  : ${process.env.EXCLUDE_KEYWORDS ?? "バリアフリー,親子,女性"}`);
console.log(`間隔      : 前回完了から${CHECK_INTERVAL_SEC}秒後に次をチェック`);
console.log("Ctrl+C で終了\n");

// setInterval だとチェックが重なって多重アクセスになるため、
// 「完了 → 待つ → 次」の直列ループにする
while (true) {
  await checkOnce();
  await sleep(CHECK_INTERVAL_SEC * 1000);
}
