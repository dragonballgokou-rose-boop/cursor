#!/bin/bash
# 2nds watcher — 欲しい公演だけを最速で取りにいく
#
# 考え方:
#   狙う公演は 0.1秒間隔で叩き、それ以外は log モード（記録は続けるが
#   通知しない・20サイクルに1回だけ見る）に回す。欲しくない公演の通知で
#   反応が一拍遅れるのを避けつつ、狙う公演への問い合わせ頻度を上げる。
#   リクエスト総量は10公演0.25秒構成とほぼ同じなので、429の危険は増えない。
#
#   鳴り方は2段階に分ける。PRIORITY に入れた公演は読み上げを2回に分けて
#   しつこく鳴らすので、画面を見なくても音だけでどちらが出たか分かる。
#
# 使い方: ./watch-fukuoka.sh      （Ctrl+C で完全に終了）
#
# 全10公演を通知対象にしたいときは ./watch-6ki.sh に戻すこと。

cd "$(dirname "$0")" || exit 1

# 🚨 最優先（読み上げ2回・画面も別表示）
TOP="2026-12-01T19:00:00=all,2026-12-02T18:30:00=all"
# 🎫 通知する（通常の読み上げ1回）
ALSO="2026-10-26T19:00:00=all"
# 記録のみ（通知しない）
OTHERS="2026-10-27T18:30:00=log,\
2026-11-10T19:00:00=log,2026-11-11T18:30:00=log,\
2026-11-17T19:00:00=log,2026-11-18T18:30:00=log,\
2026-11-24T19:00:00=log,2026-11-25T18:30:00=log"

export CHECK_INTERVAL="${CHECK_INTERVAL:-0.1}"
export LOG_EVERY="${LOG_EVERY:-20}"
export SEAT_KEYWORDS="${SEAT_KEYWORDS:-}"
export EXCLUDE_KEYWORDS="${EXCLUDE_KEYWORDS:-女性}"
export MIN_PRICE="${MIN_PRICE:-0}"
export LOG_FILE="${LOG_FILE:-listings-6ki-resale.csv}"
export PRIORITY="${PRIORITY-2026-12-01,2026-12-02}"
[ -f .ntfy-topic ] && export NTFY_TOPIC="$(cat .ntfy-topic)"

if pgrep -f "monitor-api.mjs 2026-" > /dev/null; then
  echo "⚠️ すでに監視プロセスが動いています。先に止めます。"
  pkill -f "monitor-api.mjs 2026-"
  sleep 1
fi

echo "=== 2nds watcher — 狙う公演だけを取りにいく ==="
echo "🚨 最優先 : 福岡 12/1(火) ・ 12/2(水)      ← 読み上げ2回"
echo "🎫 通知   : 神奈川1日目 10/26(月)          ← 読み上げ1回"
echo "           どちらも ${CHECK_INTERVAL}秒ごとに確認します"
echo "記録のみ  : 他7公演（通知しません・${LOG_EVERY}サイクルに1回）"
echo "スリープ  : caffeinate で抑止（この窓を閉じると解除されます）"
echo "落ちたら  : 5秒後に自動で再起動し run.log に残します"
echo
echo "鳴ったら、開いてある出品ページのタブで ⌘R → カートに入れる → 止まらず決済。"
echo "Ctrl+C で完全に終了"
echo

trap 'echo; echo "終了しました（$(date "+%H:%M:%S")）"; exit 0' INT TERM

while true; do
  # 画面だけだとウィンドウを閉じた時点で記録が消え、「鳴ったのに証拠が無い」
  # という状態になる。検知行を含む全出力を watch.log にも残す。
  caffeinate -dimsu node monitor-api.mjs "${TOP},${ALSO},${OTHERS}" 2>&1 | tee -a watch.log
  code=${PIPESTATUS[0]}
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 監視が終了しました（終了コード ${code}）。5秒後に再起動します。" | tee -a run.log
  sleep 5
done
