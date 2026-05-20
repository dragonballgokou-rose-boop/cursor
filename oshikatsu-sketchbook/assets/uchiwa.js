/* =========================================================================
   Uchiwa Maker
   公式ジャンボうちわ規定サイズ（うちわ面 285mm × 295mm + 持ち手）の
   デザインを作成し、SVG/PNG で書き出す。
   ========================================================================= */
(function () {
  "use strict";

  /* うちわのジオメトリ（単位 mm） */
  const FACE_W = 285;
  const FACE_H = 295;
  const FACE_R = 60;             // 角丸
  const HANDLE_W = 70;
  const HANDLE_H = 100;
  const HANDLE_R = 16;
  const TOTAL_H_WITH_HANDLE = FACE_H + HANDLE_H;

  /* テンプレート定義 */
  const TEMPLATES = {
    blank: { text: "推し♡", bg: "#000000", fill: "#ff2d8a", o1: "#ffffff", o1w: 8, o2: "#000000", o2w: 16, deco: "heart", decoColor: "#ffd43b", font: "uchiwa" },
    pop:   { text: "指さして！", bg: "#000000", fill: "#fff200", o1: "#ffffff", o1w: 8, o2: "#ff2d8a", o2w: 18, deco: "star", decoColor: "#ff2d8a", font: "uchiwa" },
    cute:  { text: "好き♡",   bg: "#ffe2e8", fill: "#e91e63", o1: "#ffffff", o1w: 8, o2: "#7d3cc6", o2w: 14, deco: "heart", decoColor: "#7d3cc6", font: "maru" },
    cool:  { text: "ROCK", bg: "#1a1820", fill: "#58b8f4", o1: "#ffffff", o1w: 6, o2: "#3a6fe0", o2w: 14, deco: "none",  decoColor: "#58b8f4", font: "uchiwa" },
    name:  { text: "ななちゃん", bg: "#000000", fill: "#ff9a52", o1: "#ffffff", o1w: 7, o2: "#ff2d8a", o2w: 14, deco: "heart", decoColor: "#ffd43b", font: "uchiwa" },
  };

  /* 蛍光プリセット色（規定の文字色は1色のみ） */
  const FLUORO = [
    { id: "pink",   label: "蛍光ピンク",   color: "#ff2d8a" },
    { id: "yellow", label: "蛍光イエロー", color: "#fff200" },
    { id: "orange", label: "蛍光オレンジ", color: "#ff7a18" },
    { id: "green",  label: "蛍光グリーン", color: "#a8ff35" },
    { id: "blue",   label: "蛍光ブルー",   color: "#1ed7ff" },
    { id: "white",  label: "ホワイト",     color: "#ffffff" },
    { id: "black",  label: "ブラック",     color: "#1a1820" },
  ];

  /* 背景プリセット */
  const BG_PRESETS = [
    { id: "black",     label: "黒",       color: "#000000" },
    { id: "white",     label: "白",       color: "#ffffff" },
    { id: "pink",      label: "ピンク",   color: "#ffe2e8" },
    { id: "mint",      label: "ミント",   color: "#cbf2e3" },
    { id: "sky",       label: "スカイ",   color: "#d3eaff" },
    { id: "lavender",  label: "ラベンダー", color: "#e7dcff" },
    { id: "yellow",    label: "イエロー", color: "#fff5c2" },
  ];

  const FONT_FAMILIES = {
    uchiwa: '"Zen Kaku Gothic Black", "Zen Kaku Gothic New", "Hiragino Sans", sans-serif',
    maru:   '"Zen Maru Gothic", "M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", sans-serif',
  };

  /* ----- state ----- */
  const state = {
    text: "推し♡",
    bg: "#000000",
    fill: "#ff2d8a",
    o1: "#ffffff",      // 内側縁取り
    o1w: 8,
    o2: "#000000",      // 外側縁取り
    o2w: 16,
    deco: "heart",      // "heart" | "star" | "none"
    decoColor: "#ffd43b",
    font: "uchiwa",
    showHandle: true,
  };

  /* ----- DOM 参照 ----- */
  const $ = (id) => document.getElementById(id);
  const svgHost = $("uchiwa-svg");

  /* SVG 文字列を組み立てる */
  function buildSVG({ withHandle = true, embedFonts = true } = {}) {
    const lines = state.text.split(/\n/).slice(0, 3);
    const lineCount = lines.length || 1;

    // 1行あたりの最大文字数で文字サイズを概算（mm 単位）
    const maxLen = lines.reduce((m, l) => Math.max(m, [...l].length), 1);
    // ストローク半径ぶん文字は外側に広がる。サイズ計算ではその分を確保する。
    const outline = (state.o1w || 0) + (state.o2w || 0);
    // 余白を 30mm ずつとり、その内側にストロークを含めた文字が収まるようにする
    const innerW = FACE_W - 60 - outline * 2;
    const innerH = FACE_H - 60 - outline * 2;
    const sizeByW = (innerW / Math.max(maxLen, 1)) * 1.6; // 全角・半角混在の係数
    const sizeByH = (innerH / lineCount) * 0.95;
    const fontSize = Math.max(28, Math.min(sizeByW, sizeByH, 220));

    const fontFamily = FONT_FAMILIES[state.font] || FONT_FAMILIES.uchiwa;

    // 行ごとの y 座標
    const totalTextH = fontSize * lineCount * 1.05;
    const topY = (FACE_H - totalTextH) / 2 + fontSize * 0.85;

    const totalH = withHandle ? TOTAL_H_WITH_HANDLE : FACE_H;
    const viewBox = `0 0 ${FACE_W} ${totalH}`;

    /* 装飾要素（hearts/stars をランダムシードで散らす） */
    function deco() {
      if (state.deco === "none") return "";
      const positions = [
        [40, 60, 24],  [240, 50, 18],
        [55, 250, 20], [232, 245, 26],
        [30, 150, 16], [255, 155, 14],
        [70, 30, 14],  [220, 270, 14],
      ];
      return positions.map(([x, y, s]) => decoShape(state.deco, x, y, s, state.decoColor)).join("");
    }

    function decoShape(kind, cx, cy, size, color) {
      if (kind === "heart") {
        const s = size / 32;
        return `<g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${s})" opacity="0.85">
          <path d="M16 29 C 4 21, 0 13, 6 7 C 11 2, 16 6, 16 10 C 16 6, 21 2, 26 7 C 32 13, 28 21, 16 29 Z"
                fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
        </g>`;
      }
      if (kind === "star") {
        const s = size / 32;
        return `<g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${s})" opacity="0.9">
          <path d="M16 2 L20 12 L31 12 L22 19 L25 30 L16 23 L7 30 L10 19 L1 12 L12 12 Z"
                fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
        </g>`;
      }
      return "";
    }

    /* テキスト要素：外側ストローク → 内側ストローク → 塗り の3層 */
    function textLayers() {
      const tspans = lines.map((line, i) => {
        const y = topY + i * fontSize * 1.05;
        const safe = escapeXML(line);
        return `<tspan x="${FACE_W / 2}" y="${y}">${safe}</tspan>`;
      }).join("");

      const baseAttrs = `text-anchor="middle"
        font-family='${fontFamily}'
        font-weight="900"
        font-size="${fontSize}"
        paint-order="stroke fill"
        stroke-linejoin="round"
        stroke-linecap="round"`;

      return `
        ${state.o2w > 0 ? `<text ${baseAttrs} fill="${state.o2}" stroke="${state.o2}" stroke-width="${(state.o1w + state.o2w) * 2}">${tspans}</text>` : ""}
        ${state.o1w > 0 ? `<text ${baseAttrs} fill="${state.o1}" stroke="${state.o1}" stroke-width="${state.o1w * 2}">${tspans}</text>` : ""}
        <text ${baseAttrs} fill="${state.fill}">${tspans}</text>
      `;
    }

    const fontImport = embedFonts
      ? `<defs><style type="text/css">@import url('https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@800&amp;family=Zen+Kaku+Gothic+New:wght@900&amp;family=Zen+Maru+Gothic:wght@900&amp;display=swap');</style></defs>`
      : "";

    const handle = withHandle
      ? `<rect x="${(FACE_W - HANDLE_W) / 2}" y="${FACE_H - 10}" width="${HANDLE_W}" height="${HANDLE_H + 10}"
              rx="${HANDLE_R}" ry="${HANDLE_R}" fill="#d6c7a0" stroke="#a8916a" stroke-width="2"/>
         <rect x="${(FACE_W - HANDLE_W) / 2 + 8}" y="${FACE_H + 14}" width="${HANDLE_W - 16}" height="6"
              rx="3" ry="3" fill="#a8916a" opacity="0.4"/>`
      : "";

    return `<svg xmlns="http://www.w3.org/2000/svg"
      viewBox="${viewBox}"
      width="${FACE_W}mm" height="${totalH}mm"
      role="img" aria-label="うちわデザイン: ${escapeXML(state.text)}">
      ${fontImport}
      ${handle}
      <rect x="0" y="0" width="${FACE_W}" height="${FACE_H}"
            rx="${FACE_R}" ry="${FACE_R}" fill="${state.bg}"
            stroke="rgba(0,0,0,0.08)" stroke-width="1"/>
      ${deco()}
      ${textLayers()}
    </svg>`;
  }

  function escapeXML(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  function render() {
    svgHost.innerHTML = buildSVG({ withHandle: state.showHandle, embedFonts: false });
    // CSS class for sizing
    const inner = svgHost.querySelector("svg");
    if (inner) {
      inner.removeAttribute("width");
      inner.removeAttribute("height");
      inner.style.width = "100%";
      inner.style.height = "auto";
      inner.style.maxHeight = "560px";
    }
  }

  /* ----- ダウンロード ----- */
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadSVG() {
    const svgText = buildSVG({ withHandle: state.showHandle, embedFonts: true });
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n` + svgText], { type: "image/svg+xml;charset=utf-8" });
    downloadBlob(blob, `uchiwa-${Date.now()}.svg`);
  }

  async function downloadPNG(scale = 4) {
    // 1mm を scale px に拡大
    const totalH = state.showHandle ? TOTAL_H_WITH_HANDLE : FACE_H;
    const pxW = FACE_W * scale;
    const pxH = totalH * scale;

    const svgText = buildSVG({ withHandle: state.showHandle, embedFonts: false });
    const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = () => rej(new Error("SVG をビットマップ化できませんでした"));
      });
      const canvas = document.createElement("canvas");
      canvas.width = pxW; canvas.height = pxH;
      const ctx = canvas.getContext("2d");
      // 透過うちわ面の場合は、白背景を敷くか選ぶ
      ctx.drawImage(img, 0, 0, pxW, pxH);
      const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
      downloadBlob(blob, `uchiwa-${Date.now()}.png`);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /* ----- UI bindings ----- */
  function buildSwatchGroup(host, items, current, onPick) {
    host.innerHTML = items.map((it) => `<button type="button"
      data-value="${it.color}"
      style="background:${it.color}"
      aria-pressed="${it.color === current ? "true" : "false"}"
      title="${it.label}"
      aria-label="${it.label}"></button>`).join("");
    host.addEventListener("click", (e) => {
      const b = e.target.closest("[data-value]");
      if (!b) return;
      host.querySelectorAll("button").forEach((x) =>
        x.setAttribute("aria-pressed", x === b ? "true" : "false")
      );
      onPick(b.dataset.value);
    });
  }

  function applyTemplate(name) {
    const t = TEMPLATES[name];
    if (!t) return;
    Object.assign(state, t);
    syncControls();
    render();
  }

  function syncControls() {
    $("u-text").value = state.text;
    $("u-o1w").value = state.o1w; $("u-o1w-val").textContent = state.o1w;
    $("u-o2w").value = state.o2w; $("u-o2w-val").textContent = state.o2w;
    $("u-deco").value = state.deco;
    $("u-font").value = state.font;
    $("u-handle").checked = state.showHandle;
    $("u-fill-color").value = state.fill;
    $("u-bg-color").value = state.bg;
    document.querySelectorAll("#u-bg-presets button").forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.value === state.bg ? "true" : "false")
    );
    document.querySelectorAll("#u-fill-presets button").forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.value === state.fill ? "true" : "false")
    );
  }

  function init() {
    /* テンプレートボタン */
    document.querySelectorAll("[data-template]").forEach((btn) => {
      btn.addEventListener("click", () => applyTemplate(btn.dataset.template));
    });

    /* テキスト */
    $("u-text").addEventListener("input", (e) => { state.text = e.target.value || " "; render(); });

    /* 背景プリセット */
    buildSwatchGroup($("u-bg-presets"), BG_PRESETS, state.bg, (v) => {
      state.bg = v; $("u-bg-color").value = v; render();
    });
    $("u-bg-color").addEventListener("input", (e) => {
      state.bg = e.target.value;
      document.querySelectorAll("#u-bg-presets button").forEach((b) => b.setAttribute("aria-pressed", "false"));
      render();
    });

    /* 文字色プリセット */
    buildSwatchGroup($("u-fill-presets"), FLUORO, state.fill, (v) => {
      state.fill = v; $("u-fill-color").value = v; render();
    });
    $("u-fill-color").addEventListener("input", (e) => {
      state.fill = e.target.value;
      document.querySelectorAll("#u-fill-presets button").forEach((b) => b.setAttribute("aria-pressed", "false"));
      render();
    });

    /* 縁取り色 */
    $("u-o1").addEventListener("input", (e) => { state.o1 = e.target.value; render(); });
    $("u-o2").addEventListener("input", (e) => { state.o2 = e.target.value; render(); });

    /* 縁取り幅 */
    $("u-o1w").addEventListener("input", (e) => {
      state.o1w = +e.target.value; $("u-o1w-val").textContent = e.target.value; render();
    });
    $("u-o2w").addEventListener("input", (e) => {
      state.o2w = +e.target.value; $("u-o2w-val").textContent = e.target.value; render();
    });

    /* 装飾 */
    $("u-deco").addEventListener("change", (e) => { state.deco = e.target.value; render(); });
    $("u-deco-color").addEventListener("input", (e) => { state.decoColor = e.target.value; render(); });

    /* フォント */
    $("u-font").addEventListener("change", (e) => { state.font = e.target.value; render(); });

    /* 持ち手 */
    $("u-handle").addEventListener("change", (e) => { state.showHandle = e.target.checked; render(); });

    /* 書き出し */
    $("u-export-svg").addEventListener("click", () => downloadSVG());
    $("u-export-png").addEventListener("click", () => downloadPNG(4));
    $("u-export-png-print").addEventListener("click", () => downloadPNG(8));

    /* 初期化色を input[type=color] に反映 */
    $("u-o1").value = state.o1;
    $("u-o2").value = state.o2;
    $("u-deco-color").value = state.decoColor;

    syncControls();
    render();
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
