#!/bin/bash
# 2nds watcher — 6期生ツアー リセール監視を止めずに走らせる
#
# 守りたいこと:
#   1. Macがスリープすると監視が止まる  → caffeinate で寝かせない
#   2. 落ちても誰も起こさない            → 終了したら数秒後に再起動
#   3. 止まったことに気づかない          → 終了・再起動を画面と run.log に残す
#
# 使い方: ./watch-6ki.sh          （Ctrl+C で完全に終了）

cd "$(dirname "$0")" || exit 1

# 全10公演の開演日時。performances-6ki-2026.json と同じ内容。
# getEventDates は出品があっても公演を返さないことがあるため、auto には頼らず明示する。
TARGETS="2026-10-26T19:00:00,2026-10-27T18:30:00,\
2026-11-10T19:00:00,2026-11-11T18:30:00,\
2026-11-17T19:00:00,2026-11-18T18:30:00,\
2026-11-24T19:00:00,2026-11-25T18:30:00,\
2026-12-01T19:00:00,2026-12-02T18:30:00"

# 0.5秒から0.25秒へ。429が出たら monitor-api.mjs 側が自動で広げるので、
# 弾かれて全部失う事故にはならない。429が出ないなら 0.15 まで下げてよい。
export CHECK_INTERVAL="${CHECK_INTERVAL:-0.25}"
export SEAT_KEYWORDS="${SEAT_KEYWORDS:-}"
# 女性エリアは購入条件を満たせないので通知しない。ただし CSV には記録される
# （記録は除外判定より前に行われる）ので、傾向分析のデータは失われない。
export EXCLUDE_KEYWORDS="${EXCLUDE_KEYWORDS:-女性}"
export MIN_PRICE="${MIN_PRICE:-0}"
export LOG_FILE="${LOG_FILE:-listings-6ki-resale.csv}"
# 福岡は滅多に出ない。出たときの1回で決めるしかないので、他公演の通知と
# 区別がつくように鳴り方を変える。PRIORITY="" で無効化できる。
export PRIORITY="${PRIORITY-2026-12-01,2026-12-02}"
[ -f .ntfy-topic ] && export NTFY_TOPIC="$(cat .ntfy-topic)"

# 二重起動は二重記録になる。今日それでデータを濁らせたので、先に止める。
if pgrep -f "monitor-api.mjs 2026-" > /dev/null; then
  echo "⚠️ すでに監視プロセスが動いています。先に止めます。"
  pkill -f "monitor-api.mjs 2026-"
  sleep 1
fi

echo "=== 2nds watcher — 6期生ツアー 常時監視 ==="
echo "公演      : 10公演（福岡 12/1・12/2 を含む）"
echo "間隔      : ${CHECK_INTERVAL}秒"
echo "スリープ  : caffeinate で抑止（この窓を閉じると解除されます）"
echo "落ちたら  : 5秒後に自動で再起動し run.log に残します"
echo "Ctrl+C で完全に終了"
echo

trap 'echo; echo "終了しました（$(date "+%H:%M:%S")）"; exit 0' INT TERM

while true; do
  caffeinate -dimsu node monitor-api.mjs "$TARGETS"
  code=$?
  msg="[$(date '+%Y-%m-%d %H:%M:%S')] 監視が終了しました（終了コード ${code}）。5秒後に再起動します。"
  echo "$msg" | tee -a run.log
  sleep 5
done
