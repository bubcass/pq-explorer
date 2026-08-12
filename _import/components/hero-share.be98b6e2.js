const SHARE_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M14.5 5.5 19 10l-4.5 4.5"></path>
    <path d="M18.5 10H10a5 5 0 0 0-5 5v2"></path>
  </svg>
`;

const COPIED_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m7 12.5 3.2 3.2L17.5 8"></path>
  </svg>
`;

export function enhanceHeroWithShare(hero, {title, text} = {}) {
  const content = hero?.querySelector?.(".hero__content") || hero;
  const subtitle = content?.querySelector?.(".hero__subtitle, .spotlights-hero__subtitle");
  mountMastheadActions({
    title,
    text: text || subtitle?.textContent?.trim(),
  });
  ensureBackToTop();
  return hero;
}

export function mountMastheadActions({title, text} = {}) {
  const actions = document.querySelector(".oireachtas-masthead__actions");
  if (!actions) {
    window.addEventListener(
      "load",
      () => mountMastheadActions({title, text}),
      {once: true}
    );
    return;
  }

  actions.replaceChildren();

  const status = document.createElement("span");
  status.className = "oireachtas-masthead__status";
  status.setAttribute("aria-live", "polite");

  const createShareButton = (className, buttonStatus = status) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.setAttribute("aria-label", "Share this page");
    button.title = "Share this page";
    button.innerHTML = SHARE_ICON;

    button.addEventListener("click", async () => {
      const url = window.location.href;
      const shareData = {
        title: title || document.title,
        text: text || document.querySelector(".hero__subtitle, .spotlights-hero__subtitle")?.textContent?.trim(),
        url,
      };

      try {
        if (typeof navigator.share === "function") {
          await navigator.share(shareData);
          return;
        }

        await copyText(url);
        showCopied(button, buttonStatus);
      } catch (error) {
        if (error?.name === "AbortError") return;
        try {
          await copyText(url);
          showCopied(button, buttonStatus);
        } catch {
          buttonStatus.textContent = "Unable to copy link";
        }
      }
    });
    return button;
  };

  const button = createShareButton("oireachtas-masthead__action");
  actions.append(button, status);

  const mobileMenu = document.querySelector(".mobile-reading-tools__menu");
  if (mobileMenu) {
    const mobileStatus = document.createElement("span");
    mobileStatus.className = "oireachtas-masthead__status";
    mobileStatus.setAttribute("aria-live", "polite");
    const mobileShare = createShareButton("mobile-reading-tools__menu-action", mobileStatus);
    mobileShare.insertAdjacentHTML("beforeend", "<span>Share</span>");
    mobileMenu.replaceChildren(mobileShare, mobileStatus);
  }
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Copy command failed");
}

function showCopied(button, status) {
  const isMenuAction = button.classList.contains("mobile-reading-tools__menu-action");
  button.classList.add("is-copied");
  button.setAttribute("aria-label", "Link copied");
  button.title = "Link copied";
  button.innerHTML = `${COPIED_ICON}${isMenuAction ? "<span>Link copied</span>" : ""}`;
  status.textContent = "Link copied";

  window.setTimeout(() => {
    button.classList.remove("is-copied");
    button.setAttribute("aria-label", "Share this page");
    button.title = "Share this page";
    button.innerHTML = `${SHARE_ICON}${isMenuAction ? "<span>Share</span>" : ""}`;
    status.textContent = "";
  }, 2_000);
}

function ensureBackToTop() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (document.querySelector(".page-back-to-top")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "page-back-to-top";
  button.setAttribute("aria-label", "Back to top");
  button.title = "Back to top";
  button.hidden = true;
  button.innerHTML = `<span class="page-back-to-top__chevron" aria-hidden="true">⌃</span>`;

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  button.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: reducedMotion?.matches ? "auto" : "smooth",
    });
  });

  let updatePending = false;
  const updateVisibility = () => {
    updatePending = false;
    button.hidden = window.scrollY <= 640;
  };
  const onScroll = () => {
    if (updatePending) return;
    updatePending = true;
    window.requestAnimationFrame(updateVisibility);
  };

  window.addEventListener("scroll", onScroll, {passive: true});
  document.body.appendChild(button);
  updateVisibility();
}
