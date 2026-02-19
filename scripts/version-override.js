(() => {
  const VERSION = "99.9.99";
  const SHOWN_KEY = `rh-version-${VERSION}-shown`;

  const showVersionNotice = () => {
    const holder = document.getElementById("alert-holder");
    const text = document.getElementById("alert-text");
    if (!holder || !text) return;

    holder.style.display = "block";
    const title = chrome.i18n.getMessage("successfullyInstalled") || "Successfully Installed/Updated";
    text.innerHTML = `${title}<span>v${VERSION}</span>`;
    setTimeout(() => {
      holder.style.display = "none";
    }, 3000);
  };

  window.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      try {
        const holder = document.getElementById("alert-holder");
        if (holder) holder.style.display = "none";

        if (localStorage.getItem(SHOWN_KEY) === "true") return;
        showVersionNotice();
        localStorage.setItem(SHOWN_KEY, "true");
      } catch {
        // ignore
      }
    }, 50);
  });
})();
