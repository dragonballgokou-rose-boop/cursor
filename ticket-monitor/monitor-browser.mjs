#!/usr/bin/env node
/**
 * みんなのチケット リセール出品ウォッチャー（ブラウザ版）
 *
 * marketplace ページは JavaScript で描画されるため、単純な fetch では
 * 出品リストが取れないことがある。この版は Playwright で実際にページを
 * レンダリングしてからキーワードを探す。
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
 *
 * 環境変数は monitor.mjs と同じ（WATCH_KEYWORDS / CHECK_INTERVAL / TARGET_URL / NO_OPEN）。
 */

import { exec } from "node:child_process";
import process from "node:process";
import { chromium } from "playwright";

const TARGET_URL =
  process.env.TARGET_URL ??
  "https://nft.rakuten.co.jp/marketplace/?type=ticket&sort=last_updated_date&limit=12&ticketlimit=6&provider=nogizaka";

// 公演行は「〔8/20(木)｜東京〕 乃木坂46 …」形式なので、曜日付きで判定して
// 「販売終了日時: 2026/08/22」のような日付表記への誤検知を防ぐ
const WATCH_KEYWORDS = (process.env.WATCH_KEYWORDS ?? "8/22(土),8/23(日),8/22（土）,8/23（日）")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// 最短1秒。前回チェック完了から次の開始までの待ち時間（重複実行はしない）
const CHECK_INTERVAL_SEC = Math.max(1, Number(process.env.CHECK_INTERVAL ?? 1) || 1);
const NO_OPEN = process.env.NO_OPEN === "1";

const ts = () => new Date().toLocaleTimeString("ja-JP", { hour12: false });

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "ja-JP" });
const page = await context.newPage();

// 画像・動画・フォント・広告系はブロックして読み込みを高速化
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

/**
 * 対象日の行をクリックして展開し、中身のテキストを返す。
 * クリックで詳細ページへ遷移してしまった場合は一覧へ戻る。
 */
async function expandAndExtract(kw) {
  try {
    const row = page.getByText(kw).first();
    if ((await row.count()) === 0) return null;
    await row.click({ timeout: 3_000 });
    await page.waitForTimeout(800); // 展開アニメーション待ち
  } catch {
    // クリックできなくても現状のテキストで判定を試みる
  }

  const text = await page.evaluate(() => document.body.innerText);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const idx = lines.findIndex((l) => l.includes(kw));
  if (idx === -1) return null;

  // 行の直後から、次の公演日ヘッダーが来るまでを「この公演の中身」とみなす
  const section = [];
  for (let i = idx + 1; i < lines.length && section.length < 20; i++) {
    if (/^〔?\d{1,2}\/\d{1,2}\s*[\(（]/.test(lines[i]) && !lines[i].includes(kw)) break;
    section.push(lines[i]);
  }

  // 席種の判定。除外席種（バリアフリー・親子・女性など）は前後の行も見て弾く
  //（席種名と価格が別の行に分かれていることがあるため）
  const excludedLines = [];
  const seatLines = section.filter((l, i) => {
    if (!SEAT_PATTERN.test(l)) return false;
    const ctx = [section[i - 1], l, section[i + 1]].filter(Boolean).join(" ");
    if (EXCLUDE_PATTERN.test(ctx)) {
      excludedLines.push(l);
      return false;
    }
    return true;
  });
  let itemUrl = null;

  if (seatLines.length > 0) {
    // 出品要素そのものをクリックし、遷移した先のURLを「席を押したあとの画面」として採用。
    // 監視用ブラウザは未ログインなのでログインページへ飛ばされることがある。
    // その場合のURLは出品ページではないため採用しない（Safariで開くとログイン画面になってしまう）
    try {
      const el = page.getByText(seatLines[0].slice(0, 20)).first();
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
          itemUrl = after;
        }
      }
    } catch {
      // クリックで取れなければフォールバックへ
    }

    if (!itemUrl) {
      // フォールバック: nft.rakuten.co.jp 内の出品詳細らしいリンクのみ対象
      //（以前は楽天グループの無関係なリンクを拾っていたため厳しく制限）
      itemUrl = await page.evaluate(() => {
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
  }

  // 詳細ページへ遷移していたら一覧に戻しておく
  if (!page.url().startsWith(TARGET_URL.split("?")[0])) {
    await page
      .goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 30_000 })
      .catch(() => {});
  }
  return { section, seatLines, excludedLines, itemUrl };
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

  const hits = WATCH_KEYWORDS.filter((kw) => text.includes(kw));
  let rowSeenWithoutSeats = [];

  for (const kw of hits) {
    if (alreadyAlerted.has(kw)) continue;

    const result = await expandAndExtract(kw);
    const seatLines = result?.seatLines ?? [];

    if (seatLines.length > 0) {
      // 実際に買える出品がある場合のみ通知する
      alreadyAlerted.add(kw);
      // 出品詳細が特定できていればそこへ直行、できなければ一覧へ。
      // 1秒でも早く購入画面に立てるよう、ブラウザ起動を最優先で行う
      const gotoUrl = result?.itemUrl ?? TARGET_URL;
      openBrowser(gotoUrl);
      speak(`${kw.replace(/[()（）]/g, " ")} のチケットが出ました`);
      console.log("");
      console.log(`\n🎫🎫🎫 [${ts()}] 購入可能な出品を検知: ${kw}`);
      seatLines.slice(0, 6).forEach((l) => console.log(`   ${l}`));
      console.log(`→ 今すぐ確認: ${gotoUrl}\n`);
      notify("みんなのチケット 出品検知", `${kw} に購入可能な出品: ${seatLines[0] ?? ""}`);
    } else if ((result?.excludedLines?.length ?? 0) > 0) {
      rowSeenWithoutSeats.push(`${kw}（除外席種のみ: ${result.excludedLines[0]}）`);
    } else {
      rowSeenWithoutSeats.push(kw);
    }
  }

  if (checkCount % 10 === 1) {
    if (alreadyAlerted.size > 0) {
      console.log(`[${ts()}] 検知済み: ${[...alreadyAlerted].join(", ")}（引き続き掲載中）`);
    } else if (rowSeenWithoutSeats.length > 0) {
      console.log(
        `[${ts()}] ${rowSeenWithoutSeats.join(", ")} の行はあるが購入可能な出品なし（監視継続）`
      );
    } else {
      console.log(`[${ts()}] 対象日の出品なし（監視継続・${checkCount}回チェック済み）`);
    }
  }

  for (const kw of [...alreadyAlerted]) {
    if (!text.includes(kw)) alreadyAlerted.delete(kw);
  }
}

console.log("=== みんなのチケット リセール出品ウォッチャー（ブラウザ版） ===");
console.log(`監視URL   : ${TARGET_URL}`);
console.log(`キーワード: ${WATCH_KEYWORDS.join(", ")}`);
console.log(`間隔      : 前回完了から${CHECK_INTERVAL_SEC}秒後に次をチェック`);
console.log("Ctrl+C で終了\n");

// setInterval だとチェックが重なって多重アクセスになるため、
// 「完了 → 待つ → 次」の直列ループにする
while (true) {
  await checkOnce();
  await sleep(CHECK_INTERVAL_SEC * 1000);
}
