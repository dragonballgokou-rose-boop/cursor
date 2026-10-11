#!/bin/bash
# 2nds watcher — 福岡だけを最速で取りにいく
#
# 考え方:
#   福岡（12/1・12/2）は今日2回しか出ておらず、どちらも1〜2秒で消えた。
#   他公演の通知に気を取られる余裕はないし、他公演を同じ頻度で叩くぶん
#   福岡への問い合わせが遅くなる。だから:
#     - 福岡2公演だけを 0.1秒間隔で叩く（通常の10公演構成の2.5倍の頻度）
#     - 他8公演は log モード = 記録は続けるが通知しない・20サイクルに1回だけ見る
#   リクエスト総量は10公演0.25秒とほぼ同じなので、429の危険は増えない。
#
# 使い方: ./watch-fukuoka.sh      （Ctrl+C で完全に終了）
#
# 他公演も通知してほしくなったら ./watch-6ki.sh に戻すこと。

cd "$(dirname "$0")" || exit 1

FUKUOKA="2026-12-01T19:00:00=all,2026-12-02T18:30:00=all"
OTHERS="2026-10-26T19:00:00=log,2026-10-27T18:30:00=log,\
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

echo "=== 2nds watcher — 福岡だけを取りにいく ==="
echo "通知する  : 12/1(火) 19:00 ・ 12/2(水) 18:30  ← ${CHECK_INTERVAL}秒ごと"
echo "記録のみ  : 他8公演（通知しません・${LOG_EVERY}サイクルに1回）"
echo "スリープ  : caffeinate で抑止（この窓を閉じると解除されます）"
echo "落ちたら  : 5秒後に自動で再起動し run.log に残します"
echo
echo "鳴ったら、開いてある出品ページのタブで ⌘R → カートに入れる → 止まらず決済。"
echo "Ctrl+C で完全に終了"
echo

trap 'echo; echo "終了しました（$(date "+%H:%M:%S")）"; exit 0' INT TERM

while true; do
  caffeinate -dimsu node monitor-api.mjs "${FUKUOKA},${OTHERS}"
  code=$?
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 監視が終了しました（終了コード ${code}）。5秒後に再起動します。" | tee -a run.log
  sleep 5
done
