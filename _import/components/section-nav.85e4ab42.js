const sections = [
  { id: "overview", label: "Overview", href: "./" },
  { id: "deputies", label: "Deputies", href: "./deputies" },
  { id: "parties", label: "Parties", href: "./parties" },
  { id: "constituencies", label: "Constituencies", href: "./constituencies" }
];

export function renderSectionNav(currentSection) {
  const shell = document.createElement("div");
  shell.className = "section-nav-shell";

  const nav = document.createElement("div");
  nav.className = "section-nav";
  nav.setAttribute("role", "navigation");
  nav.setAttribute("aria-label", "PQ Explorer sections");

  const list = document.createElement("div");
  list.className = "section-nav__list";

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

  nav.appendChild(list);
  shell.appendChild(nav);

  if (typeof window !== "undefined") {
    const syncFloating = () => {
      const shouldFloat = shell.getBoundingClientRect().top <= 0;
      shell.classList.toggle("section-nav-shell--floating", shouldFloat);

      if (shouldFloat) {
        shell.style.height = `${nav.offsetHeight}px`;
      } else {
        shell.style.height = "";
      }
    };

    const onScroll = () => window.requestAnimationFrame(syncFloating);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.requestAnimationFrame(syncFloating);
  }

  return shell;
}
