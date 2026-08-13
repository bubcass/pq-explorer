const sections = [
  { id: "overview", label: "Overview", href: "./" },
  { id: "deputies", label: "Deputies", href: "./deputies" },
  { id: "parties", label: "Parties", href: "./parties" },
  { id: "constituencies", label: "Constituencies", href: "./constituencies" }
];

let sectionNavInstance = 0;

export function renderSectionNav(currentSection) {
  const active = sections.find((section) => section.id === currentSection) ?? sections[0];
  const listId = `pq-explorer-sections-${++sectionNavInstance}`;
  const shell = document.createElement("div");
  shell.className = "section-nav-shell";

  const nav = document.createElement("nav");
  nav.className = "section-nav";
  nav.setAttribute("aria-label", "PQ Explorer sections");

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "section-nav__toggle";
  toggle.setAttribute("aria-controls", listId);
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", `Current section: ${active.label}. Open section navigation`);
  toggle.innerHTML = `
    <span>${active.label}</span>
    <i aria-hidden="true"></i>
  `;

  const list = document.createElement("div");
  list.className = "section-nav__list";
  list.id = listId;

  for (const section of sections) {
    const link = document.createElement("a");
    link.className = "section-nav__link";
    link.href = section.href;
    link.textContent = section.label;

    if (section.id === currentSection) {
      link.setAttribute("aria-current", "page");
    }

    list.appendChild(link);
  }

  nav.append(toggle, list);
  shell.appendChild(nav);

  if (typeof window !== "undefined") {
    let frame = null;
    let menuOpen = false;
    const mobileQuery = window.matchMedia("(max-width: 720px)");
    const mastheadQuery = window.matchMedia("(min-width: 901px)");

    const setMenuOpen = (open, {focusToggle = false} = {}) => {
      menuOpen = mobileQuery.matches && open;
      nav.classList.toggle("is-open", menuOpen);
      toggle.setAttribute("aria-expanded", String(menuOpen));
      list.hidden = mobileQuery.matches && !menuOpen;
      if (focusToggle) toggle.focus();
    };

    const syncNavigationMode = () => {
      toggle.hidden = !mobileQuery.matches;
      setMenuOpen(false);
    };

    const syncFloating = () => {
      frame = null;
      const masthead = document.querySelector(".oireachtas-masthead");
      const mastheadInner = masthead?.querySelector(".oireachtas-masthead__inner");
      const mastheadActions = mastheadInner?.querySelector(".oireachtas-masthead__actions");
      const mobileTools = document.querySelector(".mobile-reading-tools");
      const mobileMore = mobileTools?.querySelector(".mobile-reading-tools__more-wrap");
      const mastheadHeight = masthead?.offsetHeight || 0;
      const navHeight = nav.offsetHeight;
      const dockingLine = mobileQuery.matches ? 12 : mastheadHeight;
      const shouldFloat = shell.getBoundingClientRect().top <= dockingLine;
      const shouldDockInMasthead = shouldFloat && mastheadQuery.matches && mastheadInner;
      const shouldDockInMobileTools = shouldFloat && mobileQuery.matches && mobileTools;

      shell.style.height = shouldFloat ? `${navHeight}px` : "";
      shell.classList.toggle("section-nav-shell--floating", shouldFloat);
      nav.classList.toggle("section-nav--floating", shouldFloat);
      nav.classList.toggle("section-nav--masthead", Boolean(shouldDockInMasthead));
      nav.classList.toggle("section-nav--mobile-tools", Boolean(shouldDockInMobileTools));
      document.documentElement.classList.toggle("has-floating-section-nav", shouldFloat);

      if (shouldDockInMobileTools && nav.parentNode !== mobileTools) {
        mobileTools.insertBefore(nav, mobileMore || null);
      } else if (shouldDockInMasthead && nav.parentNode !== mastheadInner) {
        mastheadInner.insertBefore(nav, mastheadActions || null);
      } else if (!shouldDockInMobileTools && !shouldDockInMasthead && nav.parentNode !== shell) {
        shell.appendChild(nav);
      }
    };

    const scheduleSync = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(syncFloating);
    };

    toggle.addEventListener("click", () => setMenuOpen(!menuOpen));
    document.addEventListener("pointerdown", (event) => {
      if (menuOpen && !nav.contains(event.target)) setMenuOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menuOpen) setMenuOpen(false, {focusToggle: true});
    });
    list.addEventListener("click", (event) => {
      if (event.target.closest("a")) setMenuOpen(false);
    });
    mobileQuery.addEventListener("change", syncNavigationMode);
    mastheadQuery.addEventListener("change", scheduleSync);

    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);
    syncNavigationMode();
    window.requestAnimationFrame(syncFloating);
  }

  return shell;
}
