// ==========================================
// 乃木坂46 生写真レートシステム データ
// ==========================================
// レートは市場レートの倍率（定価比）
//   1.0 = 定価
//   2.0 = 定価の2倍
//   0.5 = 定価の0.5倍
// ==========================================

// 生写真種別（直近6種）
export const photoSeries = [
  { id: 'p1', name: '34th「I see...」', date: '2023-11', single: 34 },
  { id: 'p2', name: '35th「チャンスは平等」', date: '2024-03', single: 35 },
  { id: 'p3', name: '36th「おひとりさま天国」', date: '2024-07', single: 36 },
  { id: 'p4', name: '37th「春よ、来い」', date: '2024-11', single: 37 },
  { id: 'p5', name: 'アルバム「Time flies」', date: '2025-02', single: null },
  { id: 'p6', name: '38th「夢の向こうへ」', date: '2025-06', single: 38 },
];

// 現メンバー一覧（サンプルデータ）
// gen: 3 = 3期生, 4 = 4期生, 5 = 5期生
export const members = [
  // 3期生
  { id: 'm01', name: '梅澤美波', gen: 3, captain: false },
  { id: 'm02', name: '久保史緒里', gen: 3, captain: false },
  { id: 'm03', name: '阪口珠美', gen: 3, captain: false },
  { id: 'm04', name: '向井葉月', gen: 3, captain: false },
  { id: 'm05', name: '山下美月', gen: 3, captain: false },
  { id: 'm06', name: '与田祐希', gen: 3, captain: false },
  { id: 'm07', name: '吉田綾乃クリスティー', gen: 3, captain: false },
  // 4期生
  { id: 'm08', name: '賀喜遥香', gen: 4, captain: false },
  { id: 'm09', name: '黒見明香', gen: 4, captain: false },
  { id: 'm10', name: '金川紗耶', gen: 4, captain: false },
  { id: 'm11', name: '佐藤璃果', gen: 4, captain: false },
  { id: 'm12', name: '柴田柚菜', gen: 4, captain: false },
  { id: 'm13', name: '田村真佑', gen: 4, captain: false },
  { id: 'm14', name: '早川聖来', gen: 4, captain: false },
  { id: 'm15', name: '松尾美佑', gen: 4, captain: false },
  { id: 'm16', name: '矢久保美緒', gen: 4, captain: false },
  { id: 'm17', name: '林瑠奈', gen: 4, captain: false },
  { id: 'm18', name: '掛橋沙耶香', gen: 4, captain: false },
  // 5期生
  { id: 'm19', name: '池田瑛紗', gen: 5, captain: false },
  { id: 'm20', name: '奥田いろは', gen: 5, captain: false },
  { id: 'm21', name: '川﨑桜', gen: 5, captain: false },
  { id: 'm22', name: '菅原咲月', gen: 5, captain: false },
  { id: 'm23', name: '中西アルノ', gen: 5, captain: false },
  { id: 'm24', name: '冨里奈央', gen: 5, captain: false },
  { id: 'm25', name: '五百城茉央', gen: 5, captain: false },
  { id: 'm26', name: '一ノ瀬美空', gen: 5, captain: false },
  { id: 'm27', name: '井上和', gen: 5, captain: false },
  { id: 'm28', name: '岡本姫奈', gen: 5, captain: false },
];

// ==========================================
// レートデータ
// ratings[memberId][seriesId] = レート値（倍率）
// null = その種に生写真なし・未登録
// ==========================================
export const ratingsData = {
  'm01': { p1: 3.2, p2: 3.5, p3: 3.3, p4: 3.8, p5: 4.0, p6: 4.2 }, // 梅澤美波
  'm02': { p1: 2.8, p2: 3.0, p3: 2.9, p4: 3.1, p5: 3.2, p6: 3.0 }, // 久保史緒里
  'm03': { p1: 1.5, p2: 1.6, p3: 1.4, p4: 1.7, p5: 1.6, p6: 1.8 }, // 阪口珠美
  'm04': { p1: 1.8, p2: 2.0, p3: 1.9, p4: 2.1, p5: 2.0, p6: 2.2 }, // 向井葉月
  'm05': { p1: 4.5, p2: 5.0, p3: 4.8, p4: 5.2, p5: 5.5, p6: 5.8 }, // 山下美月
  'm06': { p1: 3.8, p2: 4.0, p3: 3.9, p4: 4.2, p5: 4.3, p6: 4.5 }, // 与田祐希
  'm07': { p1: 2.0, p2: 2.2, p3: 2.1, p4: 2.3, p5: 2.2, p6: 2.4 }, // 吉田綾乃クリスティー
  'm08': { p1: 4.2, p2: 4.5, p3: 4.3, p4: 4.7, p5: 4.8, p6: 5.0 }, // 賀喜遥香
  'm09': { p1: 1.6, p2: 1.7, p3: 1.6, p4: 1.8, p5: 1.7, p6: 1.9 }, // 黒見明香
  'm10': { p1: 1.3, p2: 1.4, p3: 1.3, p4: 1.5, p5: 1.4, p6: 1.6 }, // 金川紗耶
  'm11': { p1: 2.5, p2: 2.7, p3: 2.6, p4: 2.8, p5: 2.9, p6: 3.1 }, // 佐藤璃果
  'm12': { p1: 1.2, p2: 1.3, p3: 1.2, p4: 1.4, p5: 1.3, p6: 1.5 }, // 柴田柚菜
  'm13': { p1: 2.2, p2: 2.4, p3: 2.3, p4: 2.5, p5: 2.5, p6: 2.7 }, // 田村真佑
  'm14': { p1: 1.9, p2: 2.0, p3: 1.8, p4: 2.1, p5: 2.0, p6: 2.2 }, // 早川聖来
  'm15': { p1: 2.6, p2: 2.8, p3: 2.7, p4: 3.0, p5: 3.0, p6: 3.2 }, // 松尾美佑
  'm16': { p1: 1.7, p2: 1.8, p3: 1.7, p4: 1.9, p5: 1.8, p6: 2.0 }, // 矢久保美緒
  'm17': { p1: 2.3, p2: 2.5, p3: 2.4, p4: 2.6, p5: 2.7, p6: 2.8 }, // 林瑠奈
  'm18': { p1: 1.1, p2: 1.2, p3: 1.1, p4: 1.2, p5: 1.2, p6: 1.3 }, // 掛橋沙耶香
  'm19': { p1: 3.0, p2: 3.3, p3: 3.5, p4: 3.8, p5: 4.0, p6: 4.5 }, // 池田瑛紗
  'm20': { p1: 2.4, p2: 2.6, p3: 2.8, p4: 3.0, p5: 3.2, p6: 3.5 }, // 奥田いろは
  'm21': { p1: 1.8, p2: 2.0, p3: 2.1, p4: 2.3, p5: 2.4, p6: 2.6 }, // 川﨑桜
  'm22': { p1: 2.9, p2: 3.2, p3: 3.4, p4: 3.6, p5: 3.8, p6: 4.0 }, // 菅原咲月
  'm23': { p1: 2.1, p2: 2.3, p3: 2.4, p4: 2.5, p5: 2.7, p6: 2.9 }, // 中西アルノ
  'm24': { p1: 1.4, p2: 1.5, p3: 1.6, p4: 1.7, p5: 1.8, p6: 1.9 }, // 冨里奈央
  'm25': { p1: 3.5, p2: 3.8, p3: 4.0, p4: 4.3, p5: 4.5, p6: 4.8 }, // 五百城茉央
  'm26': { p1: 1.9, p2: 2.1, p3: 2.2, p4: 2.4, p5: 2.5, p6: 2.7 }, // 一ノ瀬美空
  'm27': { p1: 2.7, p2: 3.0, p3: 3.1, p4: 3.3, p5: 3.5, p6: 3.8 }, // 井上和
  'm28': { p1: 2.0, p2: 2.2, p3: 2.3, p4: 2.5, p5: 2.6, p6: 2.8 }, // 岡本姫奈
};

// ==========================================
// ユーティリティ関数
// ==========================================

/** 直近N種のレート一覧を取得 */
export function getRecentRates(memberId, n = 5) {
  const seriesIds = photoSeries.slice(-n).map(s => s.id);
  const memberRates = ratingsData[memberId] || {};
  return seriesIds.map(sid => ({
    seriesId: sid,
    series: photoSeries.find(s => s.id === sid),
    rate: memberRates[sid] ?? null,
  }));
}

/** 直近N種のアベレージを計算 */
export function getAverageRate(memberId, n = 5) {
  const rates = getRecentRates(memberId, n)
    .map(r => r.rate)
    .filter(r => r !== null);
  if (rates.length === 0) return null;
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}

/** 最新1種のレートを取得 */
export function getLatestRate(memberId) {
  const latest = photoSeries[photoSeries.length - 1];
  return ratingsData[memberId]?.[latest.id] ?? null;
}

/** 特定の種でのメンバー一覧をレート降順で取得 */
export function getMembersRankedBySeries(seriesId) {
  return members
    .map(m => ({
      ...m,
      rate: ratingsData[m.id]?.[seriesId] ?? null,
    }))
    .filter(m => m.rate !== null)
    .sort((a, b) => b.rate - a.rate);
}

/** レートに応じた色クラスを返す */
export function getRateColorClass(rate) {
  if (rate === null) return 'text-gray-400';
  if (rate >= 5.0) return 'text-purple-600 font-bold';
  if (rate >= 4.0) return 'text-red-500 font-bold';
  if (rate >= 3.0) return 'text-orange-500 font-semibold';
  if (rate >= 2.0) return 'text-yellow-600';
  if (rate >= 1.5) return 'text-green-600';
  return 'text-gray-500';
}

/** レートに応じた背景色クラス */
export function getRateBgClass(rate) {
  if (rate === null) return 'bg-gray-100';
  if (rate >= 5.0) return 'bg-purple-100';
  if (rate >= 4.0) return 'bg-red-50';
  if (rate >= 3.0) return 'bg-orange-50';
  if (rate >= 2.0) return 'bg-yellow-50';
  if (rate >= 1.5) return 'bg-green-50';
  return 'bg-gray-50';
}

/** 期生ラベル */
export function getGenLabel(gen) {
  return `${gen}期生`;
}

/** 期生ごとの背景色 */
export function getGenBadgeClass(gen) {
  switch (gen) {
    case 3: return 'bg-blue-100 text-blue-700';
    case 4: return 'bg-emerald-100 text-emerald-700';
    case 5: return 'bg-violet-100 text-violet-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}
