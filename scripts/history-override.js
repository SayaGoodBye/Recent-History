(() => {
  const HISTORY_MAX_RESULTS = 5000;
  const DEFAULT_RENDER_COUNT = 300;
  const SEARCH_RENDER_COUNT = 300;

  const zh = {
    recentHistory: "最近访问历史",
    allHistory: "所有历史",
    options: "设置",
    currentHistory: "当前日期",
    totalHistoryItems: "总计历史条数：",
    deleteItems: "删除项目",
    noResults: "未找到结果",
    loading: "正在载入...",
    visits: "访问"
  };

  const hasCjk = (s) => /[\u3400-\u9FFF\uF900-\uFAFF]/.test(s || "");
  const minQueryLength = (q) => (hasCjk(q) ? 1 : 2);
  const safeDecode = (text) => {
    if (!text) return "";
    let value = String(text).replace(/\+/g, "%20");
    for (let i = 0; i < 2; i++) {
      try {
        const decoded = decodeURIComponent(value);
        if (decoded === value) break;
        value = decoded;
      } catch {
        break;
      }
    }
    return value;
  };
  const normalize = (text) =>
    (text || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/[\s\-_./:?=&%#|\\()[\]{}"'`~!@$^*,;+<>]+/g, " ")
      .trim();

  const faviconUrl = (url) => {
    if (!url) return "images/blank.png";
    const u = new URL(chrome.runtime.getURL("/_favicon"));
    u.searchParams.set("pageUrl", url);
    u.searchParams.set("size", "32");
    return u.toString();
  };

  const extractUrlText = (url) => {
    if (!url) return "";
    let joined = `${url} ${safeDecode(url)}`;
    try {
      const u = new URL(url);
      const params = [];
      u.searchParams.forEach((v, k) => {
        params.push(k, v, safeDecode(k), safeDecode(v));
      });
      joined += ` ${u.hostname} ${safeDecode(u.hostname)} ${u.pathname} ${safeDecode(u.pathname)} ${params.join(" ")}`;
    } catch {
      // ignore
    }
    return joined;
  };

  const cache = { rows: null };
  const loadRows = async () => {
    if (cache.rows) return cache.rows;
    const raw = await new Promise((resolve) => {
      chrome.history.search({ text: "", maxResults: HISTORY_MAX_RESULTS, startTime: 0 }, resolve);
    });
    cache.rows = (raw || [])
      .map((item) => {
        const title = item?.title || "";
        const url = item?.url || "";
        if (!url) return null;
        const searchable = normalize(`${title} ${safeDecode(title)} ${extractUrlText(url)}`);
        return {
          title,
          url,
          visitCount: item?.visitCount || 0,
          lastVisitTime: item?.lastVisitTime || 0,
          searchable,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.lastVisitTime - a.lastVisitTime);
    return cache.rows;
  };

  const formatTime = (epoch) => {
    if (!epoch) return "";
    const d = new Date(epoch);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  const escapeHtml = (s) =>
    String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const renderRows = (container, rows) => {
    container.textContent = "";
    if (!rows.length) {
      container.innerHTML = `<div class="no-results"><span>${zh.noResults}</span></div>`;
      return;
    }

    for (const row of rows) {
      const holder = document.createElement("div");
      holder.className = "item-holder";
      holder.innerHTML = `
        <div class="item">
          <span class="time">${escapeHtml(formatTime(row.lastVisitTime))}</span>
          <a target="_blank" class="link" href="${escapeHtml(row.url)}">
            <img class="favicon" alt="Favicon" src="${escapeHtml(faviconUrl(row.url))}">
            <span class="title" title="${escapeHtml(row.url)}" rel="${escapeHtml(zh.visits)}: ${row.visitCount}">${escapeHtml(row.title || row.url)}</span>
          </a>
        </div>
        <div class="clearitem" style="clear:both;"></div>
      `;
      container.appendChild(holder);
    }
  };

  const applyZh = () => {
    document.querySelectorAll('.lang[data-lang-string]').forEach((el) => {
      const key = el.getAttribute('data-lang-string');
      if (key && zh[key]) el.textContent = zh[key];
    });
    const del1 = document.getElementById('delete-button');
    const del2 = document.getElementById('delete-range-button');
    if (del1) del1.value = zh.deleteItems;
    if (del2) del2.value = zh.deleteItems;
  };

  window.addEventListener("DOMContentLoaded", () => {
    setTimeout(async () => {
      applyZh();

      const form = document.getElementById("rh-search-form");
      const oldInput = document.getElementById("rh-search");
      const clearBtn = document.getElementById("rh-clear-search");
      const defaultContainer = document.getElementById("rh-views-insert");
      const searchContainer = document.getElementById("rh-views-search-insert");
      const total = document.getElementById("calendar-total-value");

      if (!oldInput || !defaultContainer || !searchContainer) return;

      if (form) form.setAttribute("autocomplete", "off");

      const input = oldInput.cloneNode(true);
      oldInput.parentNode.replaceChild(input, oldInput);
      input.value = "";
      input.setAttribute("autocomplete", "off");
      input.setAttribute("autocapitalize", "off");
      input.setAttribute("autocorrect", "off");
      input.setAttribute("spellcheck", "false");

      const rows = await loadRows();
      renderRows(defaultContainer, rows.slice(0, DEFAULT_RENDER_COUNT));
      if (total) total.textContent = String(rows.length);
      defaultContainer.style.display = "block";
      searchContainer.style.display = "none";

      let timer = null;
      const renderSearch = async () => {
        const q = (input.value || "").trim();
        if (!q || q.length < minQueryLength(q)) {
          defaultContainer.style.display = "block";
          searchContainer.style.display = "none";
          searchContainer.textContent = "";
          return;
        }

        const norm = normalize(safeDecode(q));
        const tokens = norm.split(/\s+/).filter(Boolean);
        const matched = rows.filter((r) => tokens.every((t) => r.searchable.includes(t))).slice(0, SEARCH_RENDER_COUNT);
        renderRows(searchContainer, matched);
        defaultContainer.style.display = "none";
        searchContainer.style.display = "block";
      };

      input.addEventListener("keyup", () => {
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(renderSearch, 120);
      });

      if (clearBtn) {
        clearBtn.addEventListener("click", (ev) => {
          ev.preventDefault();
          input.value = "";
          input.focus();
          defaultContainer.style.display = "block";
          searchContainer.style.display = "none";
          searchContainer.textContent = "";
        });
      }
    }, 150);
  });
})();
