#!/bin/bash
# リセール出品の「出た／消えた」だけを見やすく流す（監視ログとは別ウィンドウ用）
# 使い方: ./listings-feed.sh [CSVファイル]   既定 listings-6ki-resale.csv
cd "$(dirname "$0")" || exit 1
FILE="${1:-listings-6ki-resale.csv}"
touch "$FILE"
echo "=== リセール出品フィード（$FILE）==="
echo "時刻                 公演      席種                 価格    "
tail -n +2 -F "$FILE" | awk -F'","' '{
  gsub(/^"|"$/, "", $0); split($0, f, "\",\"");
  ts=$1; ev=$2; perf=$3; seat=$4; price=$5; note=$7;
  gsub(/^"/, "", ts); gsub(/"$/, "", note);
  if (ev == "appear")    printf "🎫 %s  %-8s  %-18s  %s円  出品\n", ts, perf, seat, price;
  else if (ev == "disappear") printf "   %s  %-8s  %-18s  %s円  消えた（%s）\n", ts, perf, seat, price, note;
  fflush();
}'
