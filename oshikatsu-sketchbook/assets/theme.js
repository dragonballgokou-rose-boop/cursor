/* Oshi color theme switcher
 * data-oshi 属性で全体のアクセントカラーを切り替え、localStorage で永続化
 */
(function () {
  const KEY = "oshikatsu.oshi";
  const OSHI = [
    { id: "sakura",    label: "桜",       hex: "#ff8fa3" },
    { id: "rose",      label: "ローズ",   hex: "#e91e63" },
    { id: "coral",     label: "コーラル", hex: "#ff7a7a" },
    { id: "tangerine", label: "蜜柑",     hex: "#ff9a52" },
    { id: "lemon",     label: "レモン",   hex: "#ffd43b" },
    { id: "mint",      label: "ミント",   hex: "#4ec9a8" },
    { id: "sky",       label: "スカイ",   hex: "#58b8f4" },
    { id: "cobalt",    label: "コバルト", hex: "#3a6fe0" },
    { id: "lavender",  label: "ラベンダー", hex: "#a78bda" },
    { id: "violet",    label: "ヴァイオレット", hex: "#7d3cc6" },
    { id: "white",     label: "ホワイト", hex: "#f4f4f6" },
    { id: "black",     label: "ブラック", hex: "#1a1820" },
  ];

  const root = document.documentElement;
  const stored = localStorage.getItem(KEY);
  if (stored) root.setAttribute("data-oshi", stored);

  function apply(id) {
    root.setAttribute("data-oshi", id);
    localStorage.setItem(KEY, id);
    document.querySelectorAll(".oshi-picker__swatch").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.oshi === id ? "true" : "false");
    });
  }

  function mount() {
    const host = document.querySelector("[data-oshi-picker]");
    if (!host) return;
    host.innerHTML = `<span class="oshi-picker__label">推し色</span>` +
      OSHI.map((o) => `<button type="button" class="oshi-picker__swatch"
                              data-oshi="${o.id}"
                              title="${o.label}"
                              aria-label="${o.label}"
                              style="background:${o.hex}"
                              aria-pressed="${root.getAttribute("data-oshi") === o.id ? "true" : "false"}"></button>`).join("");
    host.classList.add("oshi-picker");
    host.addEventListener("click", (e) => {
      const t = e.target.closest("[data-oshi]");
      if (t) apply(t.dataset.oshi);
    });
  }

  if (document.readyState !== "loading") mount();
  else document.addEventListener("DOMContentLoaded", mount);

  window.OshikatsuTheme = { apply, list: OSHI };
})();
