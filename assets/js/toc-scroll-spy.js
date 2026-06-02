(() => {
  const tocColumn = document.querySelector(".post-toc-column");
  const tocInner = document.querySelector(".post-toc-inner");
  const content = document.querySelector(".post-content");
  const postHeader = document.querySelector(".post-page--with-toc .post-header");

  const TOC_LAYOUT_BREAKPOINT = 1100;

  const headerOffset =
    Number.parseInt(
      getComputedStyle(document.documentElement).getPropertyValue("--header-height"),
      10
    ) || 60;

  const alignTocColumn = () => {
    if (!tocColumn) return;

    if (window.innerWidth <= TOC_LAYOUT_BREAKPOINT) {
      tocColumn.style.top = "";
      tocColumn.classList.remove("is-positioned");
      return;
    }

    const minTop = headerOffset + 12;
    const top = postHeader
      ? Math.max(minTop, postHeader.getBoundingClientRect().top)
      : minTop;

    tocColumn.style.top = `${top}px`;
    tocColumn.classList.add("is-positioned");
  };

  alignTocColumn();
  window.addEventListener("resize", alignTocColumn, { passive: true });

  if (!tocInner || !content) return;

  const sections = Array.from(tocInner.querySelectorAll('a[href^="#"]'))
    .map((link) => {
      const id = decodeURIComponent(link.getAttribute("href").slice(1));
      const el = document.getElementById(id);
      return el ? { link, el } : null;
    })
    .filter(Boolean);

  if (!sections.length) return;

  const setActive = (activeLink) => {
    sections.forEach(({ link }) => {
      const on = link === activeLink;
      link.classList.toggle("is-active", on);
      link.closest("li")?.classList.toggle("is-active", on);
    });
  };

  const update = () => {
    const scrollPos = window.scrollY + headerOffset + 32;
    let current = sections[0];
    for (const section of sections) {
      if (section.el.offsetTop <= scrollPos) current = section;
    }
    setActive(current.link);
  };

  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        update();
        ticking = false;
      });
    },
    { passive: true }
  );

  update();
})();