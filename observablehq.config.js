export default {
  title: "PQ Explorer",
  head: `
    <link rel="preload" href="oireachtas-logo.svg" as="image" type="image/svg+xml">
    <link rel="icon" href="logo.png" type="image/png" sizes="32x32">
    <script>
      document.documentElement.lang = "en-IE";

      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute("content", "width=device-width, initial-scale=1");
      } else {
        const meta = document.createElement("meta");
        meta.name = "viewport";
        meta.content = "width=device-width, initial-scale=1";
        document.head.appendChild(meta);
      }

      (() => {
        const setupOireachtasMasthead = () => {
          if (!document.body || document.querySelector(".oireachtas-masthead")) return;

          const masthead = document.createElement("header");
          masthead.className = "oireachtas-masthead";

          const inner = document.createElement("div");
          inner.className = "oireachtas-masthead__inner";

          const homeLink = document.createElement("a");
          homeLink.className = "oireachtas-masthead__home";
          homeLink.href = "https://www.oireachtas.ie/";
          homeLink.setAttribute("aria-label", "Return to oireachtas.ie");
          homeLink.title = "Return to oireachtas.ie";

          const logo = document.createElement("img");
          logo.className = "oireachtas-masthead__logo";
          logo.alt = "";
          logo.width = 163;
          logo.height = 69;
          logo.src = document.querySelector('link[rel="preload"][as="image"]')?.href || "oireachtas-logo.svg";
          homeLink.appendChild(logo);

          const resourceLink = document.createElement("a");
          resourceLink.className = "oireachtas-masthead__resource";
          resourceLink.href = "https://bubcass.github.io/open-data-insights/";
          resourceLink.setAttribute("aria-label", "Open Data Insights home");
          resourceLink.innerHTML = \`
            <span class="oireachtas-masthead__brand-mark" aria-hidden="true"><svg viewBox="0 0 64 28" focusable="false"><path d="M12 9H26L32 5L38 9H52"/><line x1="12" y1="10.5" x2="52" y2="10.5"/><rect x="12" y="10.5" width="40" height="13.5"/><line x1="27.5" y1="10.5" x2="27.5" y2="24"/><line x1="30" y1="10.5" x2="30" y2="24"/><line x1="34" y1="10.5" x2="34" y2="24"/><line x1="36.5" y1="10.5" x2="36.5" y2="24"/><line x1="26.5" y1="24" x2="37.5" y2="24"/><rect class="oireachtas-masthead__brand-mark-fill" x="30.7" y="18.2" width="2.6" height="5.8"/><path class="oireachtas-masthead__brand-mark-fill" d="M15 13h1.7v1.7H15zm4 0h1.7v1.7H19zm4 0h1.7v1.7H23zm16.3 0H41v1.7h-1.7zm4 0H45v1.7h-1.7zm4 0H49v1.7h-1.7zM15 18h1.7v1.7H15zm4 0h1.7v1.7H19zm4 0h1.7v1.7H23zm16.3 0H41v1.7h-1.7zm4 0H45v1.7h-1.7zm4 0H49v1.7h-1.7z"/><line x1="12" y1="24" x2="52" y2="24"/></svg></span>
            <span class="oireachtas-masthead__brand-copy"><span class="oireachtas-masthead__brand-title">Open Data Insights</span><span class="oireachtas-masthead__brand-tagline">Parliamentary visual data</span></span>
          \`;

          const explorerRoot = new URL(logo.src, window.location.href);
          explorerRoot.pathname = explorerRoot.pathname.replace(/_file\\/.*$/, "");
          explorerRoot.search = "";
          explorerRoot.hash = "";

          const normalizePath = (path) => path
            .replace(/index(?:\\.html)?$/, "")
            .replace(/\\/+$/, "/");

          const syncMastheadRoute = () => {
            const isExplorerIndex = normalizePath(window.location.pathname) === normalizePath(explorerRoot.pathname);
            masthead.classList.toggle("oireachtas-masthead--index", isExplorerIndex);
          };

          const actions = document.createElement("div");
          actions.className = "oireachtas-masthead__actions";
          inner.append(homeLink, resourceLink, actions);
          masthead.appendChild(inner);
          syncMastheadRoute();

          const mobileTools = document.createElement("div");
          mobileTools.className = "mobile-reading-tools";
          mobileTools.hidden = true;
          mobileTools.innerHTML = \`
            <button class="mobile-reading-tools__back" type="button" aria-label="Go back" title="Go back">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7"/></svg>
            </button>
            <div class="mobile-reading-tools__more-wrap">
              <button class="mobile-reading-tools__more" type="button" aria-label="More options" aria-expanded="false" title="More options">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
              </button>
              <div class="mobile-reading-tools__menu" hidden></div>
            </div>
          \`;

          const backButton = mobileTools.querySelector(".mobile-reading-tools__back");
          const moreButton = mobileTools.querySelector(".mobile-reading-tools__more");
          const moreMenu = mobileTools.querySelector(".mobile-reading-tools__menu");
          backButton.addEventListener("click", () => {
            if (window.history.length > 1) window.history.back();
            else window.location.href = explorerRoot.href;
          });
          const setMoreOpen = (open) => {
            moreMenu.hidden = !open;
            moreButton.setAttribute("aria-expanded", String(open));
          };
          moreButton.addEventListener("click", () => setMoreOpen(moreMenu.hidden));
          document.addEventListener("pointerdown", (event) => {
            if (!moreMenu.hidden && !mobileTools.contains(event.target)) setMoreOpen(false);
          });
          document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && !moreMenu.hidden) {
              setMoreOpen(false);
              moreButton.focus();
            }
          });

          const mobileQuery = window.matchMedia("(max-width: 720px)");
          let updatePending = false;
          const updateMobileTools = () => {
            updatePending = false;
            const navShell = document.querySelector(".section-nav-shell");
            const pastSectionNav = navShell
              ? navShell.getBoundingClientRect().top <= 12
              : window.scrollY > masthead.offsetHeight + 48;
            const visible = mobileQuery.matches && pastSectionNav;
            mobileTools.hidden = !visible;
            if (!visible) setMoreOpen(false);
          };
          const scheduleMobileToolsUpdate = () => {
            if (updatePending) return;
            updatePending = true;
            window.requestAnimationFrame(updateMobileTools);
          };
          window.addEventListener("scroll", scheduleMobileToolsUpdate, {passive: true});
          window.addEventListener("resize", scheduleMobileToolsUpdate, {passive: true});
          window.addEventListener("popstate", syncMastheadRoute);
          window.navigation?.addEventListener("navigatesuccess", syncMastheadRoute);
          document.addEventListener("click", (event) => {
            const link = event.target.closest?.("a[href]");
            if (!link) return;
            const destination = new URL(link.href, window.location.href);
            if (destination.origin !== window.location.origin) return;
            window.setTimeout(syncMastheadRoute, 0);
            window.setTimeout(syncMastheadRoute, 120);
          });
          const titleElement = document.querySelector("title");
          if (titleElement) {
            new MutationObserver(syncMastheadRoute).observe(titleElement, {
              childList: true,
              characterData: true,
              subtree: true,
            });
          }
          mobileQuery.addEventListener("change", scheduleMobileToolsUpdate);

          document.body.prepend(masthead);
          document.body.appendChild(mobileTools);
          updateMobileTools();
        };

        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", setupOireachtasMasthead, {once: true});
        } else {
          setupOireachtasMasthead();
        }
      })();


      (() => {
        const setupOireachtasFooter = () => {
          if (!document.body || document.querySelector(".oireachtas-footer")) return;

          const footer = document.createElement("footer");
          footer.className = "oireachtas-footer";

          const nav = document.createElement("nav");
          nav.className = "oireachtas-footer__nav";
          nav.setAttribute("aria-label", "Oireachtas information");

          const list = document.createElement("ul");
          list.className = "oireachtas-footer__links";

          const links = [
            ["Accessibility", "https://www.oireachtas.ie/en/accessibility-statement/"],
            ["Cookies", "https://www.oireachtas.ie/en/cookies/"],
            ["Transparency", "https://www.oireachtas.ie/en/transparency/"],
            ["Contact us", "https://www.oireachtas.ie/en/contact-us/"],
            ["Copyright and reuse", "https://www.oireachtas.ie/en/copyright-and-reuse/"],
          ];

          for (const [label, href] of links) {
            const item = document.createElement("li");
            const link = document.createElement("a");
            link.href = href;
            link.textContent = label;
            item.appendChild(link);
            list.appendChild(item);
          }

          nav.appendChild(list);
          footer.appendChild(nav);
          document.body.appendChild(footer);
        };

        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", setupOireachtasFooter, {once: true});
        } else {
          setupOireachtasFooter();
        }
      })();
    </script>
  `,
  root: "src",
  style: "style.css",
  theme: null,
  sidebar: false,
  toc: false,
  pager: false,
  footer: "© Houses of the Oireachtas",
};
