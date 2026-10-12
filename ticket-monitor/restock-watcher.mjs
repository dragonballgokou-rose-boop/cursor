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
 *   QUIET=1     毎回のログを出さず、変化時と1分ごとだけ出す
 *   KEEP_AGREEMENT=1  規約同意ページを開く（既定は席種選択ページへ直接）
 *   NOTIFY_PERFS="1"  この perf 番号だけ通知・ページを開く。他は状態をログに残すだけ（既定は全部通知）
 */

import { execFile, execFileSync } from "node:child_process";
import fs from "node:fs";
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
const QUIET = process.env.QUIET === "1";
const KEEP_AGREEMENT = process.env.KEEP_AGREEMENT === "1";
const NOTIFY_PERFS = String(process.env.NOTIFY_PERFS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const shouldNotify = (id) => NOTIFY_PERFS.length === 0 || NOTIFY_PERFS.includes(id);
// 画面にしか出さないと、ウィンドウを閉じた時点で「鳴ったのに証拠が無い」になる。
// 状態が変わった瞬間だけCSVに残す（毎回書くと膨れるので変化時のみ）。
// 「購入する」が何回・何秒出たかを後から数えられるようにしておく。
const RESTOCK_LOG = process.env.RESTOCK_LOG ?? "restock-log.csv";

// スマホへの通知。NTFY_TOPIC を設定したときだけ有効。
// タップすると click のURLがスマホのブラウザで開くので、席種選択から直接始められる。
// 戻り枠は20秒ほど開くことがあり、Macの前にいなくても間に合う可能性がある。
// 毎回打たなくて済むよう .ntfy-topic があればそれを使う（gitignore 済み）
const NTFY_TOPIC =
  process.env.NTFY_TOPIC ??
  (() => {
    try {
      return fs.readFileSync(new URL("./.ntfy-topic", import.meta.url), "utf8").trim();
    } catch {
      return "";
    }
  })();
const NTFY_SERVER = process.env.NTFY_SERVER ?? "https://ntfy.sh";
let pushFailStreak = 0;
function pushPhone(title, message, url) {
  if (!NTFY_TOPIC) return;
  fetch(NTFY_SERVER, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic: NTFY_TOPIC,
      title,
      message,
      click: url,
      priority: 5, // 端末のサイレント設定を越えて鳴らす
      tags: ["ticket"],
    }),
  })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      pushFailStreak = 0;
    })
    .catch((e) => {
      // 握り潰すと「鳴らなかった理由が分からない」状態になる
      pushFailStreak++;
      if (pushFailStreak === 1 || pushFailStreak % 10 === 0) {
        console.log(`[${ts()}] ⚠️ スマホ通知を送れませんでした（${pushFailStreak}回目）: ${e.message}`);
      }
    });
}
let logFailStreak = 0;
function logRestock(event, perf, text, note = "") {
  try {
    if (!fs.existsSync(RESTOCK_LOG)) {
      fs.writeFileSync(RESTOCK_LOG, "timestamp,event,perf_id,label,state,note\n");
    }
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    fs.appendFileSync(
      RESTOCK_LOG,
      [new Date().toLocaleString("sv-SE"), event, perf.id, perf.label, text, note].map(esc).join(",") + "\n"
    );
    logFailStreak = 0;
  } catch (e) {
    logFailStreak++;
    if (logFailStreak === 1 || logFailStreak % 10 === 0) {
      console.log(`[${ts()}] ⚠️ ${RESTOCK_LOG} に書けませんでした（${logFailStreak}回目）: ${e.message}`);
    }
  }
}

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

// 二重起動すると通知もブラウザも二重になり、どちらが鳴らしたか分からなくなる。
// 同じ監視が既に動いていたら、黙って増やさず警告して止まる。
try {
  const self = String(process.pid);
  const out = execFileSync("pgrep", ["-f", "restock-watcher.mjs"], { encoding: "utf8" });
  // pgrep -f は caffeinate や timeout のようなラッパーのコマンドラインにも
  // 一致してしまう。実行ファイルが node のものだけを本物として数える。
  const others = out
    .split("\n")
    .map((x) => x.trim())
    .filter((x) => x && x !== self)
    .filter((pid) => {
      try {
        const comm = execFileSync("ps", ["-p", pid, "-o", "comm="], { encoding: "utf8" }).trim();
        return /(^|\/)node$/.test(comm);
      } catch {
        return false; // 既に消えたプロセスは数えない
      }
    });
  if (others.length > 0) {
    console.error("⚠️ すでに restock-watcher が動いています（PID " + others.join(", ") + "）。");
    console.error("   二重に鳴らさないため起動しません。古いほうを止めてから実行してください:");
    console.error("     kill " + others.join(" "));
    console.error("   どうしても並行させたいときは ALLOW_DUPLICATE=1 を付けてください。");
    if (process.env.ALLOW_DUPLICATE !== "1") process.exit(1);
  }
} catch {
  // pgrep が無い環境では確認をあきらめて続行する
}

console.log("=== 2nds watcher — restock-watcher ===");
console.log(`対象      : ${PERFS.map((p) => `${p.label}(perf ${p.id})`).join(" / ")}`);
console.log(`間隔      : ${INTERVAL_SEC}秒`);
console.log(`記録      : 状態の変化を ${RESTOCK_LOG} に残します`);
console.log(
  `スマホ通知: ${NTFY_TOPIC ? `ON（${NTFY_SERVER}/${NTFY_TOPIC}）` : "OFF（NTFY_TOPIC=好きな文字列 を付けると有効）"}`
);
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
      // 文言が変わった瞬間を残す（「予定枚数終了」→「購入する」など）
      if (p.lastText !== undefined && p.lastText !== text) {
        logRestock("change", p, text, `前は「${p.lastText}」`);
      }
      p.lastText = text;
      if (m && !p.opened && !shouldNotify(p.id)) {
        p.opened = true;
        p.openedAt = Date.now();
        logRestock("open", p, text, "通知対象外のため記録のみ");
        console.log(`[${ts()}] （記録のみ）${p.label} が「${text}」になりました`);
      } else if (m && !p.opened) {
        p.opened = true;
        p.openedAt = Date.now();
        logRestock("open", p, text);
        const agreement = new URL(m[1].replace(/&amp;/g, "&"), PAGE_URL).href;
        // 規約同意ページ（/cart/performances/agreement/ID）を飛ばして席種選択（/cart/performances/ID）を開く
        const link = KEEP_AGREEMENT
          ? agreement
          : agreement.replace("/cart/performances/agreement/", "/cart/performances/");
        console.log(`\n🎫🎫🎫 [${ts()}] ${p.label} が「${text}」になりました → ${link}\n`);
        openBrowser(link);
        notify("2nds watcher", `${p.label} が購入可能になりました`);
        speak(`${p.label} 購入できます`);
        pushPhone(`🎫 ${p.label} 購入可能`, "タップで申込ページを開く。止まらず決済まで。", link);
      } else if (!m) {
        if (p.opened) {
          const sec = p.openedAt ? Math.round((Date.now() - p.openedAt) / 1000) : null;
          logRestock("close", p, text, sec != null ? `購入可能${sec}秒` : "");
          console.log(`[${ts()}] ${p.label} の「購入する」が消えました${sec != null ? `（${sec}秒）` : ""}`);
        }
        p.opened = false; // また売り切れたら、次に戻ったとき再通知する
      }
    }
    const line = states.join(" / ");
    // 毎回1行出す（動いていることが目で見て分かるように）。QUIET=1 なら変化時と1分ごとだけ
    if (!QUIET || line !== lastStates || n % 30 === 0) {
      console.log(`[${ts()}] 監視中（${n}回目）: ${line}${line !== lastStates && n > 1 ? "  ← 変化" : ""}`);
    }
    lastStates = line;
  } catch (e) {
    console.log(`[${ts()}] 取得失敗: ${e.message}（継続）`);
  }
  await sleep(INTERVAL_SEC * 1000);
}
