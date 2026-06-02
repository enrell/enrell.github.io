(() => {
  const page = document.querySelector(".post-page--with-toc");
  if (!page) return;

  const tocColumn = page.querySelector(".post-toc-column");
  const article = page.querySelector(".post-single");
  const postHeader = page.querySelector(".post-header");

  const mqDesktop = window.matchMedia("(min-width: 769px)");
  const mqWide = window.matchMedia("(min-width: 1101px)");

  const readPx = (token, fallback) => {
    const value = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(token)
    );
    return Number.isFinite(value) ? value : fallback;
  };

  let layoutRaf = 0;

  const clearFixedLayout = () => {
    if (!tocColumn) return;
    tocColumn.classList.remove("post-toc-column--fixed");
    tocColumn.style.removeProperty("top");
    tocColumn.style.removeProperty("left");
    tocColumn.style.removeProperty("width");
    tocColumn.style.removeProperty("max-height");
  };

  const applyLayout = () => {
    if (!tocColumn || !article) return;

    if (!mqDesktop.matches) {
      clearFixedLayout();
      return;
    }

    const gap = readPx("--gap", 24);
    const tocWidth = readPx("--toc-width", 220);
    const headerOffset = readPx("--header-height", 60);
    const articleRect = article.getBoundingClientRect();
    const left = articleRect.left - tocWidth - gap;
    const hasGutter = left >= gap && articleRect.width > 0;

    if (!hasGutter || !mqWide.matches) {
      clearFixedLayout();
      return;
    }

    const minTop = headerOffset + 12;
    const top = postHeader
      ? Math.max(minTop, postHeader.getBoundingClientRect().top)
      : minTop;
    const maxHeight = Math.max(160, window.innerHeight - top - gap);

    tocColumn.classList.add("post-toc-column--fixed");
    tocColumn.style.top = `${top}px`;
    tocColumn.style.left = `${left}px`;
    tocColumn.style.width = `${tocWidth}px`;
    tocColumn.style.maxHeight = `${maxHeight}px`;
  };

  const scheduleLayout = () => {
    cancelAnimationFrame(layoutRaf);
    layoutRaf = requestAnimationFrame(applyLayout);
  };

  mqDesktop.addEventListener("change", scheduleLayout);
  mqWide.addEventListener("change", scheduleLayout);
  window.addEventListener("resize", scheduleLayout, { passive: true });
  window.addEventListener("scroll", scheduleLayout, { passive: true });

  if (typeof ResizeObserver !== "undefined" && article) {
    const observer = new ResizeObserver(scheduleLayout);
    observer.observe(article);
    if (postHeader) observer.observe(postHeader);
    const main = document.querySelector(".main");
    if (main) observer.observe(main);
  }

  scheduleLayout();

  const tocLinks = document.querySelectorAll(
    ".post-toc-inner a[href^='#'], .menu-toc-nav a[href^='#']"
  );
  if (!tocLinks.length) return;

  const sections = Array.from(tocLinks)
    .map((link) => {
      const id = decodeURIComponent(link.getAttribute("href").slice(1));
      const el = document.getElementById(id);
      return el ? { link, el } : null;
    })
    .filter(Boolean);

  const uniqueSections = [];
  const seen = new Set();
  sections.forEach((entry) => {
    if (seen.has(entry.el)) return;
    seen.add(entry.el);
    uniqueSections.push(entry);
  });

  if (!uniqueSections.length) return;

  const headerOffset = readPx("--header-height", 60);

  const setActive = (id) => {
    tocLinks.forEach((link) => {
      const active =
        decodeURIComponent(link.getAttribute("href").slice(1)) === id;
      link.classList.toggle("is-active", active);
      link.closest("li")?.classList.toggle("is-active", active);
    });
  };

  const updateSpy = () => {
    const scrollPos = window.scrollY + headerOffset + 32;
    let current = uniqueSections[0];
    for (const section of uniqueSections) {
      if (section.el.offsetTop <= scrollPos) current = section;
    }
    setActive(current.el.id);
  };

  let spyRaf = 0;
  window.addEventListener(
    "scroll",
    () => {
      if (spyRaf) return;
      spyRaf = requestAnimationFrame(() => {
        updateSpy();
        spyRaf = 0;
      });
    },
    { passive: true }
  );

  updateSpy();
})();