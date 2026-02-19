(() => {
  const HISTORY_MAX_RESULTS = 3000;
  const DISPLAY_MAX_RESULTS = 120;
  const CACHE_TTL_MS = 30 * 1000;

  const stripProtocol = (url) => (url || "").replace(/^(.*?):\/\//, "").replace(/\/$/, "");
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
      // ignore invalid URL
    }
    return joined;
  };

  const faviconUrl = (url) => {
    if (!url) return "images/blank.png";
    const u = new URL(chrome.runtime.getURL("/_favicon"));
    u.searchParams.set("pageUrl", url);
    u.searchParams.set("size", "32");
    return u.toString();
  };

  const buildItem = (entry) => {
    const a = document.createElement("a");
    const title = (entry.title || entry.url || "").trim();
    const url = entry.url || "";

    a.className = "item";
    a.href = url;
    a.target = "_blank";
    a.innerHTML = `
      <img class="favicon" alt="Favicon" src="${faviconUrl(url)}">
      <span class="title">${title.replace(/</g, "").replace(/>/g, "")}</span>
      <span class="extra-url"><span class="url">${stripProtocol(url)}</span></span>
    `;

    a.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (url) {
        chrome.tabs.create({ url, active: true }, () => window.close());
      }
    });

    return a;
  };

  const historyCache = {
    ts: 0,
    rows: [],
  };

  const loadHistoryRows = async () => {
    const now = Date.now();
    if (now - historyCache.ts < CACHE_TTL_MS && historyCache.rows.length) {
      return historyCache.rows;
    }

    const rows = await new Promise((resolve) => {
      chrome.history.search({ text: "", maxResults: HISTORY_MAX_RESULTS, startTime: 0 }, resolve);
    });

    historyCache.ts = now;
    historyCache.rows = (rows || []).map((item) => {
      const title = item?.title || "";
      const url = item?.url || "";
      const searchable = normalize(`${title} ${safeDecode(title)} ${extractUrlText(url)}`);
      return {
        title,
        url,
        searchable,
        visitCount: item?.visitCount || 0,
        lastVisitTime: item?.lastVisitTime || 0,
      };
    });

    return historyCache.rows;
  };

  const searchHistory = async (query) => {
    const raw = (query || "").trim();
    if (!raw || raw.length < minQueryLength(raw)) return [];

    const qn = normalize(safeDecode(raw));
    if (!qn) return [];

    const tokens = qn.split(/\s+/).filter(Boolean);
    const rows = await loadHistoryRows();
    const seen = new Set();
    const filtered = [];

    for (const row of rows) {
      if (!row?.url) continue;
      const hay = row.searchable;
      if (!tokens.every((tk) => hay.includes(tk))) continue;

      const key = `${row.title}|${row.url}`;
      if (seen.has(key)) continue;
      seen.add(key);

      filtered.push({
        title: row.title || row.url,
        url: row.url,
        lastVisitTime: row.lastVisitTime,
        visitCount: row.visitCount,
      });
      if (filtered.length >= DISPLAY_MAX_RESULTS) break;
    }

    return filtered;
  };

  window.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      const oldInput = document.getElementById("popup-search-input");
      const clearBtn = document.getElementById("popup-search-clear");
      const defaultContainer = document.getElementById("popup-insert");
      const searchContainer = document.getElementById("popup-search-insert");

      if (!oldInput || !clearBtn || !defaultContainer || !searchContainer) return;

      const input = oldInput.cloneNode(true);
      oldInput.parentNode.replaceChild(input, oldInput);
      input.value = "";
      input.setAttribute("autocomplete", "off");
      input.setAttribute("autocapitalize", "off");
      input.setAttribute("autocorrect", "off");
      input.setAttribute("spellcheck", "false");

      let seq = 0;
      let timer = null;

      const render = async () => {
        const currentSeq = ++seq;
        const q = input.value || "";
        if (q.trim().length < minQueryLength(q.trim())) {
          defaultContainer.style.display = "block";
          searchContainer.style.display = "none";
          searchContainer.textContent = "";
          return;
        }

        const rows = await searchHistory(q);
        if (currentSeq !== seq) return;

        searchContainer.textContent = "";
        if (!rows.length) {
          const noResults = document.createElement("div");
          noResults.className = "no-results";
          noResults.innerHTML = `<span>${chrome.i18n.getMessage("noResults") || "No results"}</span>`;
          searchContainer.appendChild(noResults);
        } else {
          for (const row of rows) {
            searchContainer.appendChild(buildItem(row));
          }
        }

        defaultContainer.style.display = "none";
        searchContainer.style.display = "block";
      };

      input.addEventListener("keyup", () => {
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(render, 120);
      });

      clearBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        input.value = "";
        input.focus();
        defaultContainer.style.display = "block";
        searchContainer.style.display = "none";
        searchContainer.textContent = "";
      });
    }, 0);
  });
})();
