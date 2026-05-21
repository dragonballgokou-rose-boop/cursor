/* =========================================================================
   Sketchbook Editor
   推し活スケッチブックのページを組み立て、コンビニ印刷用 PNG (300dpi) で書き出す。
   要素: 画像 / テキスト / 和紙テープ / ステッカー（ハート・スター）
   ========================================================================= */
(function () {
  "use strict";

  /* コンビニ印刷でよく使う紙サイズ（mm） — 縦向きを基準。横向きはトグルで切り替え */
  const PAPERS = {
    "l":      { id: "l",      label: "L判",      w: 89,  h: 127 },
    "2l":     { id: "2l",     label: "2L判",     w: 127, h: 178 },
    "square": { id: "square", label: "ましかく", w: 89,  h: 89  },
    "kg":     { id: "kg",     label: "KGサイズ", w: 102, h: 152 },
    "a4":     { id: "a4",     label: "A4",       w: 210, h: 297 },
    "b5":     { id: "b5",     label: "B5",       w: 182, h: 257 },
    "a3":     { id: "a3",     label: "A3",       w: 297, h: 420 },
  };

  /* 背景プリセット */
  const BG_PRESETS = [
    { id: "paper",  label: "生成り紙", color: "#fffaf3" },
    { id: "white",  label: "白",       color: "#ffffff" },
    { id: "pink",   label: "ピンク",   color: "#fff1f3" },
    { id: "mint",   label: "ミント",   color: "#f0fbf6" },
    { id: "sky",    label: "スカイ",   color: "#f0f7ff" },
    { id: "cream",  label: "クリーム", color: "#fff7df" },
    { id: "ink",    label: "墨",       color: "#2a2730" },
  ];

  const BG_OVERLAYS = [
    { id: "none",  label: "プレーン" },
    { id: "grid",  label: "方眼" },
    { id: "ruled", label: "罫線" },
    { id: "dot",   label: "ドット" },
  ];

  const FONTS = [
    { id: "maru",   label: "まる ゴシック", family: '"Zen Maru Gothic", "M PLUS Rounded 1c", sans-serif', weight: 700 },
    { id: "kaku",   label: "極太角ゴ",      family: '"Zen Kaku Gothic Black", "Zen Kaku Gothic New", sans-serif', weight: 900 },
    { id: "hand",   label: "手書き風",      family: '"Caveat", "Zen Kurenaido", cursive', weight: 700 },
    { id: "kurenaido", label: "鉛筆風",     family: '"Zen Kurenaido", cursive', weight: 400 },
  ];

  const WASHI_PRESETS = [
    { color: "#ff8fa3", label: "桜" },
    { color: "#4ec9a8", label: "ミント" },
    { color: "#ffd43b", label: "レモン" },
    { color: "#a78bda", label: "ラベンダー" },
    { color: "#58b8f4", label: "スカイ" },
    { color: "#ff9a52", label: "蜜柑" },
  ];

  /* ===== state ===== */
  const state = {
    paper: "2l",
    orientation: "portrait",  // "portrait" | "landscape"
    bgColor: "#fffaf3",
    bgOverlay: "none",
    elements: [],     // { id, type, x, y, w, h, rotation, ... }
    selectedId: null,
    nextId: 1,
  };

  const $ = (id) => document.getElementById(id);
  let stage, surface, layer;

  /* ========== Geometry helpers ========== */
  function paper() {
    const p = PAPERS[state.paper] || PAPERS["2l"];
    if (state.orientation === "landscape" && p.w !== p.h) {
      return { id: p.id, label: p.label, w: p.h, h: p.w };
    }
    return p;
  }
  function mmToScreen() {
    // SVG viewBox は mm 単位。surface の幅を mm/px 比に使う。
    return surface.getBoundingClientRect().width / paper().w;
  }

  /* ========== Render ========== */
  function render() {
    const p = paper();

    // 紙の比率を CSS aspect-ratio で
    surface.style.aspectRatio = `${p.w} / ${p.h}`;
    surface.style.background = state.bgColor;
    surface.dataset.overlay = state.bgOverlay;

    // SVG レイヤを再構築
    layer.setAttribute("viewBox", `0 0 ${p.w} ${p.h}`);
    layer.setAttribute("preserveAspectRatio", "xMidYMid meet");

    layer.innerHTML = state.elements.map((el) => renderElement(el)).join("");

    // ハンドル（HTML overlay）
    renderHandles();
    renderElementList();
    renderInspector();
  }

  function renderElement(el) {
    const tr = `transform="rotate(${el.rotation || 0} ${el.x + el.w / 2} ${el.y + el.h / 2})"`;
    if (el.type === "photo") {
      return `<image href="${el.src}" x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}"
                ${tr} preserveAspectRatio="xMidYMid slice"
                style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.18));" />
              <rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" ${tr}
                fill="none" stroke="white" stroke-width="${Math.min(el.w, el.h) * 0.04}" />`;
    }
    if (el.type === "text") {
      const font = FONTS.find((f) => f.id === el.font) || FONTS[0];
      const lines = (el.text || "").split(/\n/);
      const lineH = el.size * 1.2;
      const tspans = lines.map((s, i) =>
        `<tspan x="${el.x}" y="${el.y + el.size + i * lineH}">${escapeXML(s)}</tspan>`
      ).join("");
      const outlineW = +el.outlineW || 0;
      const strokeAttrs = outlineW > 0
        ? `stroke="${el.outline || "#ffffff"}" stroke-width="${outlineW}"
           stroke-linejoin="round" stroke-linecap="round"
           paint-order="stroke fill"`
        : "";
      return `<text ${tr}
        font-family='${font.family}' font-weight="${font.weight}" font-size="${el.size}"
        fill="${el.color}" ${strokeAttrs}>${tspans}</text>`;
    }
    if (el.type === "washi") {
      // 和紙テープ：斜めストライプ＋色
      const stripe = el.w * 0.04;
      return `<g ${tr} opacity="0.92">
        <defs>
          <pattern id="washi-${el.id}" patternUnits="userSpaceOnUse" width="${stripe * 2}" height="${stripe * 2}" patternTransform="rotate(45)">
            <rect width="${stripe * 2}" height="${stripe * 2}" fill="${el.color}"/>
            <rect width="${stripe}" height="${stripe * 2}" fill="rgba(255,255,255,0.35)"/>
          </pattern>
        </defs>
        <rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" fill="url(#washi-${el.id})" />
        ${el.label ? `<text x="${el.x + el.w / 2}" y="${el.y + el.h / 2 + el.h * 0.16}"
          text-anchor="middle" font-size="${el.h * 0.5}"
          font-family='"M PLUS Rounded 1c", sans-serif' font-weight="700"
          fill="#2a2730">${escapeXML(el.label)}</text>` : ""}
      </g>`;
    }
    if (el.type === "sticker") {
      const s = el.w;
      const cx = el.x + el.w / 2;
      const cy = el.y + el.h / 2;
      const rot = el.rotation || 0;
      if (el.shape === "heart") {
        const scale = s / 32;
        return `<g transform="rotate(${rot} ${cx} ${cy}) translate(${el.x} ${el.y}) scale(${scale})">
          <path d="M16 30 C 3 21, 0 12, 7 6 C 12 1, 16 6, 16 10 C 16 6, 20 1, 25 6 C 32 12, 29 21, 16 30 Z"
                fill="${el.color}" stroke="white" stroke-width="1.6" stroke-linejoin="round"/>
        </g>`;
      }
      if (el.shape === "star") {
        const scale = s / 32;
        return `<g transform="rotate(${rot} ${cx} ${cy}) translate(${el.x} ${el.y}) scale(${scale})">
          <path d="M16 2 L20 12 L31 12 L22 19 L25 30 L16 23 L7 30 L10 19 L1 12 L12 12 Z"
                fill="${el.color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
        </g>`;
      }
      if (el.shape === "circle") {
        return `<g ${tr}>
          <circle cx="${cx}" cy="${cy}" r="${s / 2}" fill="${el.color}" stroke="white" stroke-width="${s * 0.05}"/>
          ${el.label ? `<text x="${cx}" y="${cy + s * 0.12}" text-anchor="middle" font-size="${s * 0.34}"
            font-family='"Zen Maru Gothic", sans-serif' font-weight="700" fill="white">${escapeXML(el.label)}</text>` : ""}
        </g>`;
      }
    }
    return "";
  }

  /* 紙サイズが変わったとき、はみ出した要素を内側にクランプ */
  function clampElementsToPaper() {
    const p = paper();
    for (const el of state.elements) {
      // 大きすぎる要素は紙幅に縮める
      if (el.w > p.w) {
        const ratio = p.w / el.w;
        el.w = p.w;
        if (["photo", "washi"].includes(el.type)) el.h *= ratio;
      }
      if (el.h > p.h) {
        const ratio = p.h / el.h;
        el.h = p.h;
        if (["photo"].includes(el.type)) el.w *= ratio;
      }
      el.x = Math.max(0, Math.min(p.w - el.w, el.x));
      el.y = Math.max(0, Math.min(p.h - el.h, el.y));
    }
  }

  function escapeXML(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  /* ========== Drag handles overlay ========== */
  const handlesHost = () => $("sb-handles");

  function renderHandles() {
    const host = handlesHost();
    const ratio = mmToScreen();
    host.innerHTML = state.elements.map((el) => {
      const left   = el.x * ratio;
      const top    = el.y * ratio;
      const width  = el.w * ratio;
      const height = el.h * ratio;
      const selected = el.id === state.selectedId;
      const grips = selected ? `
        <div class="sb-grip sb-grip--nw"  data-grip="nw"  data-id="${el.id}"></div>
        <div class="sb-grip sb-grip--ne"  data-grip="ne"  data-id="${el.id}"></div>
        <div class="sb-grip sb-grip--sw"  data-grip="sw"  data-id="${el.id}"></div>
        <div class="sb-grip sb-grip--se"  data-grip="se"  data-id="${el.id}"></div>
        <div class="sb-grip sb-grip--rot" data-grip="rot" data-id="${el.id}" title="ドラッグで回転"></div>
      ` : "";
      return `<div class="sb-handle ${selected ? "is-selected" : ""}" data-id="${el.id}"
        style="left:${left}px; top:${top}px; width:${width}px; height:${height}px;
               transform: rotate(${el.rotation || 0}deg); transform-origin: center;"
        title="${el.type}">${grips}</div>`;
    }).join("");
  }

  function renderElementList() {
    const host = $("sb-list");
    if (!state.elements.length) {
      host.innerHTML = `<p class="text-mute text-small">まだ要素がありません。右のボタンから追加してね。</p>`;
      return;
    }
    host.innerHTML = state.elements.slice().reverse().map((el) => {
      const isSel = el.id === state.selectedId;
      const label = elementLabel(el);
      return `<div class="sb-list__item ${isSel ? "is-selected" : ""}" data-id="${el.id}">
        <span class="sb-list__icon">${typeIcon(el.type, el.shape)}</span>
        <span class="sb-list__label">${escapeXML(label)}</span>
        <div class="sb-list__buttons">
          <button data-act="up"  title="前面へ" aria-label="前面へ">▲</button>
          <button data-act="dn"  title="背面へ" aria-label="背面へ">▼</button>
          <button data-act="del" title="削除" aria-label="削除">✕</button>
        </div>
      </div>`;
    }).join("");
  }

  function typeIcon(t, shape) {
    if (t === "photo")   return "🖼";
    if (t === "text")    return "T";
    if (t === "washi")   return "▰";
    if (t === "sticker") return shape === "heart" ? "♡" : (shape === "star" ? "★" : "●");
    return "·";
  }
  function elementLabel(el) {
    if (el.type === "photo")   return "画像";
    if (el.type === "text")    return el.text || "(空テキスト)";
    if (el.type === "washi")   return el.label ? `和紙: ${el.label}` : "和紙テープ";
    if (el.type === "sticker") return el.shape === "circle" ? `丸シール: ${el.label || ""}` : `${el.shape === "heart" ? "ハート" : "スター"}`;
    return el.type;
  }

  function renderInspector() {
    const host = $("sb-inspector");
    const el = state.elements.find((e) => e.id === state.selectedId);
    if (!el) {
      host.innerHTML = `<p class="text-mute text-small">編集したい要素をプレビューやリストから選択してね。</p>`;
      return;
    }

    let extra = "";
    if (el.type === "text") {
      const outlineW = +el.outlineW || 0;
      extra = `
        <div class="field">
          <label class="field__label">テキスト</label>
          <textarea class="textarea" data-prop="text" rows="2">${escapeXML(el.text)}</textarea>
        </div>
        <div class="field">
          <label class="field__label">フォント</label>
          <select class="select" data-prop="font">
            ${FONTS.map((f) => `<option value="${f.id}" ${f.id === el.font ? "selected" : ""}>${f.label}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label class="field__label">サイズ (mm)</label>
          <div class="range-row">
            <input type="range" min="4" max="80" value="${el.size}" data-prop="size" />
            <span class="range-row__value"><span data-bind="size">${el.size}</span></span>
          </div>
        </div>
        <div class="field">
          <label class="field__label">文字色</label>
          <input class="input" type="color" value="${el.color}" data-prop="color" />
        </div>
        <div class="field">
          <label class="field__label">フチ（縁取り）</label>
          <div style="display: grid; grid-template-columns: auto 1fr; gap: 8px; align-items: center;">
            <input class="input" type="color" value="${el.outline || "#ffffff"}" data-prop="outline" style="width: 44px; height: 36px; padding: 2px;"/>
            <div class="range-row">
              <input type="range" min="0" max="8" step="0.5" value="${outlineW}" data-prop="outlineW" />
              <span class="range-row__value"><span data-bind="outlineW">${outlineW}</span></span>
            </div>
          </div>
          <small class="field__hint">幅 0 でフチなし。白＋濃い文字色が見やすい組み合わせ。</small>
        </div>
      `;
    }
    if (el.type === "photo") {
      extra = `<p class="text-small text-mute">画像はポラロイド風に白縁付き。
        プレビュー上で<strong>角をドラッグでサイズ変更</strong>、<strong>上の○をドラッグで回転</strong>、ドラッグで移動できます。比率は自動で維持されます。</p>`;
    }
    if (el.type === "washi") {
      extra = `
        <div class="field">
          <label class="field__label">ラベル（任意）</label>
          <input class="input" type="text" value="${escapeXML(el.label || "")}" data-prop="label" />
        </div>
        <div class="field">
          <label class="field__label">色</label>
          <input class="input" type="color" value="${el.color}" data-prop="color" />
        </div>
      `;
    }
    if (el.type === "sticker") {
      extra = `
        <div class="field">
          <label class="field__label">色</label>
          <input class="input" type="color" value="${el.color}" data-prop="color" />
        </div>
        ${el.shape === "circle" ? `
        <div class="field">
          <label class="field__label">文字（任意）</label>
          <input class="input" type="text" maxlength="6" value="${escapeXML(el.label || "")}" data-prop="label" />
        </div>` : ""}
      `;
    }

    host.innerHTML = `
      <div class="sb-inspector__title">${typeIcon(el.type, el.shape)} ${elementLabel(el)}</div>
      ${extra}
      <div class="field">
        <label class="field__label">幅 (mm)</label>
        <div class="range-row">
          <input type="range" min="6" max="${paper().w}" value="${el.w.toFixed(0)}" data-prop="w" />
          <span class="range-row__value"><span data-bind="w">${el.w.toFixed(0)}</span></span>
        </div>
      </div>
      <div class="field">
        <label class="field__label">高さ (mm)</label>
        <div class="range-row">
          <input type="range" min="6" max="${paper().h}" value="${el.h.toFixed(0)}" data-prop="h" />
          <span class="range-row__value"><span data-bind="h">${el.h.toFixed(0)}</span></span>
        </div>
      </div>
      <div class="field">
        <label class="field__label">回転 (°)</label>
        <div class="range-row">
          <input type="range" min="-180" max="180" value="${el.rotation || 0}" data-prop="rotation" />
          <span class="range-row__value"><span data-bind="rotation">${el.rotation || 0}</span></span>
        </div>
      </div>
      <div style="display:flex; gap: 8px; margin-top: var(--space-3);">
        <button class="btn btn--ghost btn--sm" data-act="duplicate">複製</button>
        <button class="btn btn--ghost btn--sm" data-act="del">削除</button>
      </div>
    `;
  }

  /* ========== Mutate helpers ========== */
  function addElement(el) {
    el.id = state.nextId++;
    el.rotation = el.rotation ?? 0;
    state.elements.push(el);
    state.selectedId = el.id;
    render();
  }

  function update(id, patch) {
    const el = state.elements.find((e) => e.id === id);
    if (!el) return;
    Object.assign(el, patch);
    render();
  }

  function remove(id) {
    const i = state.elements.findIndex((e) => e.id === id);
    if (i < 0) return;
    state.elements.splice(i, 1);
    if (state.selectedId === id) state.selectedId = null;
    render();
  }

  function reorder(id, dir) {
    const i = state.elements.findIndex((e) => e.id === id);
    if (i < 0) return;
    const j = dir === "up" ? Math.min(i + 1, state.elements.length - 1) : Math.max(i - 1, 0);
    if (i === j) return;
    const [el] = state.elements.splice(i, 1);
    state.elements.splice(j, 0, el);
    render();
  }

  function duplicate(id) {
    const el = state.elements.find((e) => e.id === id);
    if (!el) return;
    const copy = JSON.parse(JSON.stringify(el));
    copy.id = state.nextId++;
    copy.x = Math.min(el.x + 10, paper().w - el.w);
    copy.y = Math.min(el.y + 10, paper().h - el.h);
    state.elements.push(copy);
    state.selectedId = copy.id;
    render();
  }

  /* ========== Add buttons ========== */
  function addText() {
    addElement({
      type: "text", x: 10, y: 20, w: paper().w - 20, h: 16,
      text: "ライブ最高だった！", color: "#2a2730", size: 12, font: "hand",
      outline: "#ffffff", outlineW: 0,
    });
  }
  function addWashi() {
    const w = Math.min(80, paper().w - 20);
    addElement({
      type: "washi", x: 10, y: 10, w, h: 14,
      color: "#ff8fa3", label: "MEMO", rotation: -3,
    });
  }
  function addSticker(shape) {
    const size = 24;
    addElement({
      type: "sticker", shape, x: paper().w / 2 - size / 2, y: paper().h / 2 - size / 2,
      w: size, h: size, color: shape === "star" ? "#ffd43b" : "#ff8fa3",
      label: shape === "circle" ? "推" : "",
    });
  }

  function addPhotoFromFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target.result;
      // 画像の自然サイズで縦横比を取る
      const img = new Image();
      img.onload = () => {
        const naturalRatio = (img.naturalWidth && img.naturalHeight)
          ? img.naturalWidth / img.naturalHeight : 1;
        // 紙の 70% を初期サイズに（縦長／横長に応じてはみ出さないようクランプ）
        let w = paper().w * 0.7;
        let h = w / naturalRatio;
        if (h > paper().h * 0.8) {
          h = paper().h * 0.8;
          w = h * naturalRatio;
        }
        addElement({
          type: "photo", src,
          x: (paper().w - w) / 2, y: (paper().h - h) / 2,
          w, h, rotation: 0,
        });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  /* ========== Pointer interaction ========== */
  const activePointers = new Map(); // pointerId -> { x, y, elId }
  let pinchState = null;            // 2本指ピンチ中の状態
  let singleDragCleanup = null;     // 1本指ドラッグ中のクリーンアップ関数

  function setupPointerDrag() {
    const overlay = $("sb-handles");

    overlay.addEventListener("pointerdown", (e) => {
      // リサイズ・回転のグリップ（既存挙動）
      const grip = e.target.closest("[data-grip]");
      if (grip) {
        e.stopPropagation();
        const id = +grip.dataset.id;
        const el = state.elements.find((x) => x.id === id);
        if (!el) return;
        state.selectedId = id;
        if (grip.dataset.grip === "rot") startRotate(el, e, grip);
        else startResize(el, grip.dataset.grip, e, grip);
        return;
      }

      const target = e.target.closest("[data-id]");
      if (!target) { state.selectedId = null; render(); return; }
      const id = +target.dataset.id;
      const el = state.elements.find((x) => x.id === id);
      if (!el) return;

      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, elId: id });
      try { target.setPointerCapture(e.pointerId); } catch (_) {}

      // 既に選択中の要素に 2 本目の指が乗ったらピンチ開始
      const samePtrs = [...activePointers.entries()].filter(([_id, p]) => p.elId === id);
      if (samePtrs.length === 2) {
        // 1本指ドラッグが走っていたら止める
        if (singleDragCleanup) { singleDragCleanup(); singleDragCleanup = null; }
        startPinch(el, samePtrs.map(([_id, p]) => p));
        return;
      }

      // 1本指：選択→移動
      if (state.selectedId !== id) { state.selectedId = id; render(); }
      singleDragCleanup = startMove(el, e, target);
    });

    document.addEventListener("pointermove", (e) => {
      const p = activePointers.get(e.pointerId);
      if (p) { p.x = e.clientX; p.y = e.clientY; }
      if (pinchState) updatePinch();
    });
    function endPointer(e) {
      const wasActive = activePointers.has(e.pointerId);
      activePointers.delete(e.pointerId);
      if (pinchState && wasActive) {
        // 1本だけ離れたらピンチ終了（残りは特に何もしない）
        endPinch();
      }
    }
    document.addEventListener("pointerup", endPointer);
    document.addEventListener("pointercancel", endPointer);

    // 背景タップで選択解除
    surface.addEventListener("click", (e) => {
      if (e.target === surface || e.target === layer) {
        state.selectedId = null;
        render();
      }
    });
  }

  function startPinch(el, twoPtrs) {
    const [p1, p2] = twoPtrs;
    const surfRect = surface.getBoundingClientRect();
    const ratio = mmToScreen();
    pinchState = {
      el,
      surfRect,
      ratio,
      startD: Math.hypot(p2.x - p1.x, p2.y - p1.y),
      startA: Math.atan2(p2.y - p1.y, p2.x - p1.x),
      startMid: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
      startCenter: { x: el.x + el.w / 2, y: el.y + el.h / 2 },
      startW: el.w,
      startH: el.h,
      startRot: el.rotation || 0,
      ids: [...activePointers.entries()].filter(([_id, p]) => p.elId === el.id).map(([id]) => id),
    };
  }

  function updatePinch() {
    const [id1, id2] = pinchState.ids;
    const p1 = activePointers.get(id1);
    const p2 = activePointers.get(id2);
    if (!p1 || !p2) return;
    const { el, surfRect, ratio, startD, startA, startMid, startCenter, startW, startH, startRot } = pinchState;

    const newD = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const newA = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const newMid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

    const scale = Math.max(0.05, newD / Math.max(startD, 1));
    const dRotRad = newA - startA;

    // 元 mid → center のオフセット (mm)
    const offMmX = startCenter.x - (startMid.x - surfRect.left) / ratio;
    const offMmY = startCenter.y - (startMid.y - surfRect.top) / ratio;
    // オフセットを回転＆スケール
    const cosR = Math.cos(dRotRad);
    const sinR = Math.sin(dRotRad);
    const newOffX = (offMmX * cosR - offMmY * sinR) * scale;
    const newOffY = (offMmX * sinR + offMmY * cosR) * scale;
    // 新しい mid (mm)
    const newMidMmX = (newMid.x - surfRect.left) / ratio;
    const newMidMmY = (newMid.y - surfRect.top) / ratio;
    // 新しい中心
    const newCenterX = newMidMmX + newOffX;
    const newCenterY = newMidMmY + newOffY;

    el.w = Math.max(8, startW * scale);
    el.h = Math.max(8, startH * scale);
    el.x = newCenterX - el.w / 2;
    el.y = newCenterY - el.h / 2;
    let r = startRot + dRotRad * 180 / Math.PI;
    while (r > 180) r -= 360;
    while (r < -180) r += 360;
    el.rotation = Math.round(r * 10) / 10;
    render();
  }

  function endPinch() {
    pinchState = null;
  }

  function startMove(el, e, target) {
    const ratio = mmToScreen();
    const startMX = e.clientX;
    const startMY = e.clientY;
    const startElX = el.x;
    const startElY = el.y;
    try { target.setPointerCapture(e.pointerId); } catch (_) {}

    function onMove(ev) {
      if (pinchState) return; // ピンチに切り替わったら無視
      const dx = (ev.clientX - startMX) / ratio;
      const dy = (ev.clientY - startMY) / ratio;
      el.x = Math.max(-el.w / 2, Math.min(paper().w - el.w / 2, startElX + dx));
      el.y = Math.max(-el.h / 2, Math.min(paper().h - el.h / 2, startElY + dy));
      render();
    }
    function cleanup() {
      try { target.releasePointerCapture(e.pointerId); } catch (_) {}
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", cleanup);
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", cleanup);
    return cleanup;
  }

  function startResize(el, grip, e, target) {
    const ratio = mmToScreen();
    const startMX = e.clientX;
    const startMY = e.clientY;
    const startEl = { x: el.x, y: el.y, w: el.w, h: el.h };
    const r = (el.rotation || 0) * Math.PI / 180;
    const cos = Math.cos(r), sin = Math.sin(r);

    // 反対側のコーナー（アンカー）を「画面 mm 座標」で記録 — 回転を考慮
    const ax = grip.includes("e") ? -startEl.w / 2 : startEl.w / 2;
    const ay = grip.includes("s") ? -startEl.h / 2 : startEl.h / 2;
    const centerX = startEl.x + startEl.w / 2;
    const centerY = startEl.y + startEl.h / 2;
    const anchorMmX = centerX + (ax * cos - ay * sin);
    const anchorMmY = centerY + (ax * sin + ay * cos);

    const aspect = startEl.w / startEl.h;
    const preserveAspect = el.type === "photo" || el.type === "sticker";

    target.setPointerCapture?.(e.pointerId);

    function onMove(ev) {
      // 画面差分 (mm)
      const dxS = (ev.clientX - startMX) / ratio;
      const dyS = (ev.clientY - startMY) / ratio;
      // 要素ローカル系へ unrotate
      const dx =  dxS * cos + dyS * sin;
      const dy = -dxS * sin + dyS * cos;

      let w = startEl.w, h = startEl.h;
      if (grip.includes("e")) w = Math.max(8, startEl.w + dx);
      if (grip.includes("w")) w = Math.max(8, startEl.w - dx);
      if (grip.includes("s")) h = Math.max(8, startEl.h + dy);
      if (grip.includes("n")) h = Math.max(8, startEl.h - dy);

      if (preserveAspect) {
        // 比例維持：相対変化の大きい方を採用
        const wChange = Math.abs(Math.log(w / startEl.w));
        const hChange = Math.abs(Math.log(h / startEl.h));
        if (wChange >= hChange) h = w / aspect;
        else                    w = h * aspect;
      }
      // ステッカーは正方形を保つ
      if (el.type === "sticker") h = w;

      // 新しいアンカー位置（ローカル）から逆算して新しい中心を出す
      const naxL = grip.includes("e") ? -w / 2 : w / 2;
      const nayL = grip.includes("s") ? -h / 2 : h / 2;
      const newCx = anchorMmX - (naxL * cos - nayL * sin);
      const newCy = anchorMmY - (naxL * sin + nayL * cos);

      el.x = newCx - w / 2;
      el.y = newCy - h / 2;
      el.w = w;
      el.h = h;
      render();
    }
    function onUp() {
      target.releasePointerCapture?.(e.pointerId);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  function startRotate(el, e, target) {
    const box = handlesHost().querySelector(`.sb-handle[data-id="${el.id}"]`);
    const rect = box.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
    const startRot = el.rotation || 0;
    target.setPointerCapture?.(e.pointerId);

    function onMove(ev) {
      const angle = Math.atan2(ev.clientY - cy, ev.clientX - cx);
      let rot = startRot + (angle - startAngle) * 180 / Math.PI;
      while (rot > 180)  rot -= 360;
      while (rot < -180) rot += 360;
      if (ev.shiftKey) rot = Math.round(rot / 15) * 15; // Shift で 15° スナップ
      el.rotation = Math.round(rot * 10) / 10;
      render();
    }
    function onUp() {
      target.releasePointerCapture?.(e.pointerId);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  /* ========== Inspector input binding ========== */
  function setupInspector() {
    const insp = $("sb-inspector");
    insp.addEventListener("input", (e) => {
      const id = state.selectedId;
      if (!id) return;
      const t = e.target.closest("[data-prop]");
      if (!t) return;
      const prop = t.dataset.prop;
      let val = t.value;
      if (["w", "h", "size", "rotation", "outlineW"].includes(prop)) val = +val;
      const patch = { [prop]: val };
      // mm-range live readout
      const lo = insp.querySelector(`[data-bind="${prop}"]`);
      if (lo) lo.textContent = val;
      update(id, patch);
    });
    insp.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (!act || !state.selectedId) return;
      if (act === "del")       remove(state.selectedId);
      if (act === "duplicate") duplicate(state.selectedId);
    });
  }

  function setupListEvents() {
    const host = $("sb-list");
    host.addEventListener("click", (e) => {
      const item = e.target.closest("[data-id]");
      if (!item) return;
      const id = +item.dataset.id;
      const btn = e.target.closest("[data-act]");
      if (btn) {
        const act = btn.dataset.act;
        if (act === "up")  reorder(id, "up");
        if (act === "dn")  reorder(id, "down");
        if (act === "del") remove(id);
      } else {
        state.selectedId = id;
        render();
      }
    });
  }

  /* ========== Export ========== */
  function buildExportSVG() {
    const p = paper();
    // クローンしてフォント埋め込み版を作る
    const tmp = layer.cloneNode(true);
    // overlay class などは入っていないので素直に使える
    const inner = tmp.innerHTML;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.w} ${p.h}"
      width="${p.w}mm" height="${p.h}mm">
      <defs>
        <style type="text/css">@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&amp;family=M+PLUS+Rounded+1c:wght@800&amp;family=Zen+Kaku+Gothic+New:wght@900&amp;family=Zen+Kurenaido&amp;family=Zen+Maru+Gothic:wght@500;700;900&amp;display=swap');</style>
      </defs>
      <rect x="0" y="0" width="${p.w}" height="${p.h}" fill="${state.bgColor}"/>
      ${buildOverlaySVG(p)}
      ${inner}
    </svg>`;
  }

  function buildOverlaySVG(p) {
    if (state.bgOverlay === "none") return "";
    if (state.bgOverlay === "grid") {
      // 5mm 方眼
      let out = "";
      for (let x = 0; x <= p.w; x += 5) out += `<line x1="${x}" y1="0" x2="${x}" y2="${p.h}" stroke="rgba(0,0,0,0.06)" stroke-width="0.2"/>`;
      for (let y = 0; y <= p.h; y += 5) out += `<line x1="0" y1="${y}" x2="${p.w}" y2="${y}" stroke="rgba(0,0,0,0.06)" stroke-width="0.2"/>`;
      return out;
    }
    if (state.bgOverlay === "ruled") {
      let out = "";
      for (let y = 10; y <= p.h - 5; y += 8) out += `<line x1="6" y1="${y}" x2="${p.w - 6}" y2="${y}" stroke="rgba(160,120,80,0.18)" stroke-width="0.2"/>`;
      return out;
    }
    if (state.bgOverlay === "dot") {
      let out = "";
      for (let y = 4; y <= p.h; y += 4)
        for (let x = 4; x <= p.w; x += 4)
          out += `<circle cx="${x}" cy="${y}" r="0.25" fill="rgba(0,0,0,0.18)"/>`;
      return out;
    }
    return "";
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadSVG() {
    const svgText = buildExportSVG();
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n` + svgText], { type: "image/svg+xml;charset=utf-8" });
    downloadBlob(blob, `sketch-${paper().id}-${Date.now()}.svg`);
  }

  async function downloadPNG(dpi = 300) {
    const p = paper();
    // mm × (dpi / 25.4)
    const scale = dpi / 25.4;
    const pxW = Math.round(p.w * scale);
    const pxH = Math.round(p.h * scale);

    const svgText = buildExportSVG();
    const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = () => rej(new Error("PNG への書き出しに失敗しました"));
      });
      const canvas = document.createElement("canvas");
      canvas.width = pxW; canvas.height = pxH;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = state.bgColor;
      ctx.fillRect(0, 0, pxW, pxH);
      ctx.drawImage(img, 0, 0, pxW, pxH);
      const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
      downloadBlob(blob, `sketch-${p.id}-${dpi}dpi-${pxW}x${pxH}.png`);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /* ========== Save / Load JSON ========== */
  const LS_KEY = "oshikatsu.sketchbook.v1";
  function saveLocal() {
    localStorage.setItem(LS_KEY, JSON.stringify({
      paper: state.paper, bgColor: state.bgColor, bgOverlay: state.bgOverlay,
      elements: state.elements, nextId: state.nextId,
    }));
    flash("保存しました（ブラウザ内）");
  }
  function loadLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return flash("保存データがありません");
      const data = JSON.parse(raw);
      Object.assign(state, data);
      // 旧フォーマット (l-land / 2l-land / a4-land) を新形式に変換
      if (state.paper && state.paper.endsWith("-land")) {
        state.paper = state.paper.slice(0, -5);
        state.orientation = "landscape";
      }
      if (!state.orientation) state.orientation = "portrait";
      state.selectedId = null;
      // UI 同期
      $("sb-paper").value = state.paper;
      $("sb-bg-color").value = state.bgColor;
      $("sb-bg-overlay").value = state.bgOverlay;
      $("sb-orient")?.querySelectorAll("[data-orient]").forEach((x) =>
        x.setAttribute("aria-pressed", x.dataset.orient === state.orientation ? "true" : "false")
      );
      render();
      flash("読み込みました");
    } catch (e) { flash("読み込みに失敗"); }
  }
  function clearAll() {
    if (!confirm("全要素を削除します。よろしいですか？")) return;
    state.elements = [];
    state.selectedId = null;
    render();
  }

  let flashTimer = null;
  function flash(msg) {
    const el = $("sb-flash");
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => el.classList.remove("is-visible"), 1800);
  }

  /* ========== Init ========== */
  function init() {
    stage   = $("sb-stage");
    surface = $("sb-surface");
    layer   = $("sb-layer");

    // 紙サイズセレクト
    const ps = $("sb-paper");
    ps.innerHTML = Object.values(PAPERS).map((p) =>
      `<option value="${p.id}">${p.label}（${p.w}×${p.h}mm）</option>`).join("");
    ps.value = state.paper;
    ps.addEventListener("change", (e) => {
      state.paper = e.target.value;
      clampElementsToPaper();
      render();
    });

    // 縦・横トグル
    const orientHost = $("sb-orient");
    if (orientHost) {
      orientHost.addEventListener("click", (e) => {
        const b = e.target.closest("[data-orient]");
        if (!b) return;
        state.orientation = b.dataset.orient;
        orientHost.querySelectorAll("[data-orient]").forEach((x) =>
          x.setAttribute("aria-pressed", x === b ? "true" : "false")
        );
        clampElementsToPaper();
        render();
      });
      orientHost.querySelectorAll("[data-orient]").forEach((x) =>
        x.setAttribute("aria-pressed", x.dataset.orient === state.orientation ? "true" : "false")
      );
    }

    // 背景プリセット
    const bp = $("sb-bg-presets");
    bp.innerHTML = BG_PRESETS.map((b) =>
      `<button type="button" data-color="${b.color}" title="${b.label}"
        aria-label="${b.label}"
        style="background:${b.color}"></button>`).join("");
    bp.addEventListener("click", (e) => {
      const b = e.target.closest("[data-color]");
      if (!b) return;
      state.bgColor = b.dataset.color;
      $("sb-bg-color").value = b.dataset.color;
      bp.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
      render();
    });
    $("sb-bg-color").value = state.bgColor;
    $("sb-bg-color").addEventListener("input", (e) => { state.bgColor = e.target.value; render(); });

    // オーバーレイ
    const ov = $("sb-bg-overlay");
    ov.innerHTML = BG_OVERLAYS.map((o) => `<option value="${o.id}">${o.label}</option>`).join("");
    ov.value = state.bgOverlay;
    ov.addEventListener("change", (e) => { state.bgOverlay = e.target.value; render(); });

    // 追加ボタン
    $("sb-add-text").addEventListener("click", addText);
    $("sb-add-washi").addEventListener("click", addWashi);
    $("sb-add-heart").addEventListener("click", () => addSticker("heart"));
    $("sb-add-star").addEventListener("click",  () => addSticker("star"));
    $("sb-add-circle").addEventListener("click", () => addSticker("circle"));

    // 画像追加（File input + drag&drop）
    const fileInput = $("sb-add-photo-input");
    $("sb-add-photo").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
      for (const f of e.target.files) addPhotoFromFile(f);
      fileInput.value = "";
    });
    surface.addEventListener("dragover", (e) => { e.preventDefault(); surface.classList.add("is-dragover"); });
    surface.addEventListener("dragleave", () => surface.classList.remove("is-dragover"));
    surface.addEventListener("drop", (e) => {
      e.preventDefault();
      surface.classList.remove("is-dragover");
      for (const f of e.dataTransfer.files) {
        if (f.type.startsWith("image/")) addPhotoFromFile(f);
      }
    });

    // 書き出し
    $("sb-export-png").addEventListener("click", () => downloadPNG(300));
    $("sb-export-png-screen").addEventListener("click", () => downloadPNG(150));
    $("sb-export-svg").addEventListener("click", downloadSVG);

    // 保存・読み込み
    $("sb-save").addEventListener("click", saveLocal);
    $("sb-load").addEventListener("click", loadLocal);
    $("sb-clear").addEventListener("click", clearAll);

    // Pointer / inspector
    setupPointerDrag();
    setupInspector();
    setupListEvents();

    // 初期コンテンツ
    addElement({ type: "washi", x: 10, y: 10, w: 80, h: 12, color: "#ff8fa3", label: "2026.05.20 LIVE", rotation: -3 });
    addElement({ type: "text",  x: 10, y: 30, w: paper().w - 20, h: 16,
                 text: "推しの全国ツアー\n参戦してきた！！", color: "#2a2730", size: 9, font: "hand" });
    addElement({ type: "sticker", shape: "heart", x: paper().w - 28, y: paper().h - 28, w: 22, h: 22, color: "#ff2d8a", rotation: 8 });
    state.selectedId = null;
    render();

    // リサイズで再描画
    window.addEventListener("resize", render);
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
