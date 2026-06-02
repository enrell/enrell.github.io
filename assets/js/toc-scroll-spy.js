(() => {
  const page = document.querySelector(".post-page--with-toc");
  if (!page) return;

  const tocColumn = page.querySelector(".post-toc-column");
  const tocInner = page.querySelector(".post-toc-inner");
  const content = page.querySelector(".post-content");
  const article = page.querySelector(".post-single");
  const postHeader = page.querySelector(".post-header");
  const disclosure = page.querySelector(".post-toc-disclosure");

  const mq = window.matchMedia("(max-width: 1100px)");

  const readPx = (token, fallback) => {
    const value = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(token)
    );
    return Number.isFinite(value) ? value : fallback;
  };

  let layoutRaf = 0;

  const setDisclosureMode = () => {
    if (!disclosure) return;
    if (mq.matches) {
      if (disclosure.dataset.userToggled !== "true") {
        disclosure.removeAttribute("open");
      }
      return;
    }
    disclosure.setAttribute("open", "");
  };

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

    if (mq.matches) {
      clearFixedLayout();
      setDisclosureMode();
      return;
    }

    const gap = readPx("--gap", 24);
    const tocWidth = readPx("--toc-width", 220);
    const headerOffset = readPx("--header-height", 60);
    const articleRect = article.getBoundingClientRect();
    const left = articleRect.left - tocWidth - gap;
    const hasGutter = left >= gap && articleRect.width > 0;

    if (!hasGutter) {
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
    setDisclosureMode();
  };

  const scheduleLayout = () => {
    cancelAnimationFrame(layoutRaf);
    layoutRaf = requestAnimationFrame(applyLayout);
  };

  mq.addEventListener("change", scheduleLayout);
  window.addEventListener("resize", scheduleLayout, { passive: true });
  window.addEventListener("scroll", scheduleLayout, { passive: true });

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(scheduleLayout);
    observer.observe(article);
    if (postHeader) observer.observe(postHeader);
    const main = document.querySelector(".main");
    if (main) observer.observe(main);
  }

  disclosure?.addEventListener("toggle", () => {
    disclosure.dataset.userToggled = "true";
  });

  tocInner?.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || !mq.matches || !disclosure) return;
    disclosure.removeAttribute("open");
  });

  scheduleLayout();

  if (!tocInner || !content) return;

  const sections = Array.from(tocInner.querySelectorAll('a[href^="#"]'))
    .map((link) => {
      const id = decodeURIComponent(link.getAttribute("href").slice(1));
      const el = document.getElementById(id);
      return el ? { link, el } : null;
    })
    .filter(Boolean);

  if (!sections.length) return;

  const headerOffset = readPx("--header-height", 60);

  const setActive = (activeLink) => {
    sections.forEach(({ link }) => {
      const on = link === activeLink;
      link.classList.toggle("is-active", on);
      link.closest("li")?.classList.toggle("is-active", on);
    });
  };

  const updateSpy = () => {
    const scrollPos = window.scrollY + headerOffset + 32;
    let current = sections[0];
    for (const section of sections) {
      if (section.el.offsetTop <= scrollPos) current = section;
    }
    setActive(current.link);
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