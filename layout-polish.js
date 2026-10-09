/* Keep mobile utility controls in the page chrome, outside the reading area. */
document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.site-header');
  const nav = header?.querySelector('.site-nav');
  const dock = document.querySelector('.mobile-control-dock');
  const theme = document.querySelector('.theme-toggle');
  const wind = document.querySelector('.wind-toggle');
  if (!header || !nav || !dock) return;
  const mobile = matchMedia('(max-width: 900px)');
  const placeControls = () => {
    if (mobile.matches) {
      if (theme) header.insertBefore(theme, header.querySelector('.site-search-trigger') || header.querySelector('.menu-toggle'));
      if (wind) nav.append(wind);
    } else {
      if (wind) dock.append(wind);
      if (theme) dock.append(theme);
    }
  };
  mobile.addEventListener('change', placeControls);
  placeControls();
});
