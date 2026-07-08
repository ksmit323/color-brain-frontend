/**
 * Scroll-reveal: toggles `.is-visible` on `.reveal` sections via IntersectionObserver.
 * Uses a MutationObserver so late WASM-rendered content is still observed.
 * Respects `prefers-reduced-motion` — all sections show immediately with no animation.
 */
(function () {
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function markVisible(el) {
    el.classList.add("is-visible");
  }

  function showAll() {
    document.querySelectorAll(".reveal").forEach(markVisible);
  }

  if (reduced) {
    showAll();
    new MutationObserver(showAll).observe(document.body, {
      childList: true,
      subtree: true,
    });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          markVisible(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );

  function observeNew() {
    document.querySelectorAll(".reveal:not([data-reveal])").forEach(function (el) {
      el.setAttribute("data-reveal", "");
      observer.observe(el);
    });
  }

  observeNew();
  new MutationObserver(observeNew).observe(document.body, {
    childList: true,
    subtree: true,
  });
})();