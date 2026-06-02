import * as params from "@params";

(() => {
  const sInput = document.getElementById("headerSearchInput");
  const resList = document.getElementById("headerSearchResults");
  const searchbox = document.getElementById("headerSearchbox");
  if (!sInput || !resList || !searchbox) return;

  let fuse = null;
  let resultsAvailable = false;
  let first = null;
  let last = null;
  let currentElem = null;

  const setResultsOpen = (open) => {
    sInput.setAttribute("aria-expanded", open ? "true" : "false");
    resList.hidden = !open;
    searchbox.classList.toggle("is-open", open);
  };

  const buildFuseOptions = () => {
    const opts = params.fuseOpts;
    if (!opts) {
      return {
        distance: 100,
        threshold: 0.4,
        ignoreLocation: true,
        keys: ["title", "permalink", "summary", "content"],
      };
    }
    return {
      isCaseSensitive: opts.iscasesensitive ?? false,
      includeScore: opts.includescore ?? false,
      includeMatches: opts.includematches ?? false,
      minMatchCharLength: opts.minmatchcharlength ?? 1,
      shouldSort: opts.shouldsort ?? true,
      findAllMatches: opts.findallmatches ?? false,
      keys: opts.keys ?? ["title", "permalink", "summary", "content"],
      location: opts.location ?? 0,
      threshold: opts.threshold ?? 0.4,
      distance: opts.distance ?? 100,
      ignoreLocation: opts.ignorelocation ?? true,
    };
  };

  const loadIndex = () => {
    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      if (xhr.status !== 200) return;
      try {
        const data = JSON.parse(xhr.responseText);
        if (data) fuse = new Fuse(data, buildFuseOptions());
      } catch {
        /* ignore parse errors */
      }
    };
    xhr.open("GET", params.indexUrl);
    xhr.send();
  };

  const activeToggle = (ae) => {
    resList.querySelectorAll(".focus").forEach((el) => el.classList.remove("focus"));
    if (ae) {
      ae.focus();
      document.activeElement = currentElem = ae;
      ae.parentElement?.classList.add("focus");
    }
  };

  const reset = () => {
    resultsAvailable = false;
    resList.innerHTML = "";
    setResultsOpen(false);
    sInput.value = "";
    sInput.focus();
  };

  const runSearch = () => {
    if (!fuse) return;
    const query = sInput.value.trim();
    if (!query) {
      reset();
      return;
    }

    const limit = params.fuseOpts?.limit;
    const results = limit
      ? fuse.search(query, { limit })
      : fuse.search(query);

    if (results.length === 0) {
      resultsAvailable = false;
      resList.innerHTML = "";
      setResultsOpen(false);
      return;
    }

    let html = "";
    for (const item of results) {
      const title = item.item.title;
      const url = item.item.permalink;
      html += `<li class="header-search-result" role="option"><span class="header-search-result-title">${title}</span><a href="${url}" tabindex="-1" aria-label="${title}"></a></li>`;
    }

    resList.innerHTML = html;
    resultsAvailable = true;
    setResultsOpen(true);
    first = resList.firstChild;
    last = resList.lastChild;
  };

  sInput.addEventListener("input", runSearch);

  sInput.addEventListener("search", () => {
    if (!sInput.value) reset();
  });

  sInput.addEventListener("focus", () => {
    if (sInput.value.trim() && resList.children.length) setResultsOpen(true);
  });

  document.addEventListener("click", (e) => {
    if (!searchbox.contains(e.target)) setResultsOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || document.activeElement?.isContentEditable) return;
      e.preventDefault();
      sInput.focus();
      return;
    }

    const inbox = searchbox.contains(document.activeElement);
    if (!inbox) return;

    const key = e.key;
    let ae = document.activeElement;
    if (ae === sInput) {
      resList.querySelectorAll(".focus").forEach((el) => el.classList.remove("focus"));
    } else if (currentElem) {
      ae = currentElem;
    }

    if (key === "Escape") {
      e.preventDefault();
      reset();
    } else if (!resultsAvailable) {
      return;
    } else if (key === "ArrowDown") {
      e.preventDefault();
      if (ae === sInput) activeToggle(first?.lastChild);
      else if (ae.parentElement !== last) activeToggle(ae.parentElement?.nextSibling?.lastChild);
    } else if (key === "ArrowUp") {
      e.preventDefault();
      if (ae.parentElement === first) activeToggle(sInput);
      else if (ae !== sInput) activeToggle(ae.parentElement?.previousSibling?.lastChild);
    } else if (key === "Enter" && ae !== sInput && ae.tagName === "A") {
      ae.click();
    }
  });

  loadIndex();
})();