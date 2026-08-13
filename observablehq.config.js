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
          resourceLink.textContent = "Open Data Insights";
          resourceLink.href = "https://bubcass.github.io/open-data-insights/";
          resourceLink.setAttribute("aria-label", "Open Data Insights home");

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
