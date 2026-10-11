#!/bin/bash
# リセール出品の「出た／消えた」だけを見やすく流す（監視ログとは別ウィンドウ用）
# 使い方: ./listings-feed.sh [CSVファイル]   既定 listings-6ki-resale.csv
cd "$(dirname "$0")" || exit 1
FILE="${1:-listings-6ki-resale.csv}"
touch "$FILE"
echo "=== リセール出品フィード: $FILE ==="
tail -n +2 -F "$FILE" | awk -F'","' '
BEGIN {
  # 乃木坂46 6期生全国ツアー2026 の日程 → 会場・何日目
  v["10月26日"] = "神奈川 1日目 10/26(月)"; v["10月27日"] = "神奈川 2日目 10/27(火)";
  v["11月10日"] = "札幌   1日目 11/10(火)"; v["11月11日"] = "札幌   2日目 11/11(水)";
  v["11月17日"] = "大阪   1日目 11/17(火)"; v["11月18日"] = "大阪   2日目 11/18(水)";
  v["11月24日"] = "名古屋 1日目 11/24(火)"; v["11月25日"] = "名古屋 2日目 11/25(水)";
  v["12月1日"]  = "福岡   1日目 12/1(火)";  v["12月2日"]  = "福岡   2日目 12/2(水)";
}
{
  ts = $1; ev = $2; perf = $3; seat = $4; price = $5; note = $7;
  gsub(/^"/, "", ts); gsub(/"$/, "", note);
  sub(/^2026-/, "", ts);
  name = (perf in v) ? v[perf] : perf;
  if (ev == "appear")         printf "🎫 %s  %s  %s  %s円  出品\n", ts, name, seat, price;
  else if (ev == "disappear") printf "   %s  %s  %s  %s円  消えた（%s）\n", ts, name, seat, price, note;
  fflush();
}'
