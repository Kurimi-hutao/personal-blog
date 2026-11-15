// Configured at build time. No cookies, browser identifiers or account secrets.
(() => {
  const script = document.currentScript;
  const src = script?.dataset.source;
  if (!src || location.hostname !== 'joestarzhang.cn' || navigator.doNotTrack === '1' || navigator.globalPrivacyControl) return;
  if (/\/(admin|reward|offline|404)\.html$/.test(location.pathname)) return;
  window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
  window.plausible.init = window.plausible.init || function (options) { window.plausible.o = options || {}; };
  window.plausible.init({ autoCapturePageviews: false });
  const tracker = document.createElement('script');
  tracker.async = true; tracker.src = src;
  tracker.onload = () => {
    const slug = new URLSearchParams(location.search).get('slug');
    const route = slug && window.SEO_URLS?.[slug];
    const url = route ? new URL(route, location.href).href : document.querySelector('link[rel="canonical"]')?.href || location.origin + location.pathname;
    window.plausible('pageview', { u: url });
  };
  document.head.append(tracker);
})();
