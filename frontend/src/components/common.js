function createBrand() {
  const brand = document.createElement('a');
  const mark = document.createElement('span');
  const label = document.createElement('span');
  const accent = document.createElement('em');

  brand.className = 'brand';
  brand.href = '/';
  brand.setAttribute('aria-label', 'PriceLens home');
  mark.className = 'brand__mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = '⌕';
  label.textContent = 'Price';
  accent.textContent = 'Lens';
  label.append(accent);
  brand.append(mark, label);

  return brand;
}

function createLink(label, href, className, active = false) {
  const link = document.createElement('a');
  link.className = className;
  link.href = href;
  link.textContent = label;

  if (active) {
    link.setAttribute('aria-current', 'page');
  }

  return link;
}

function initializeHeader(header) {
  const activeRoute = header.dataset.activeRoute;
  const isHome = header.dataset.variant === 'home';
  const container = document.createElement('div');
  const navigation = document.createElement('nav');

  container.className = 'header__inner';
  navigation.className = 'header__links';
  navigation.setAttribute('aria-label', 'Main navigation');

  if (isHome) {
    navigation.append(createLink('Open watchlist', '/watchlist', 'btn btn--light'));
  } else {
    navigation.append(
      createLink('Watchlist', '/watchlist', 'nav-link', activeRoute === 'watchlist'),
      createLink('Add product', '/products/add', 'btn btn--primary', activeRoute === 'add-product'),
    );
  }

  container.append(createBrand(), navigation);
  header.replaceChildren(container);
}

function initializeFooter(footer) {
  const container = document.createElement('div');
  const message = document.createElement('p');

  container.className = 'footer__inner';
  message.textContent = 'PriceLens — a calm decision-support tool. Prices are observed, not live.';
  container.append(createBrand(), message);
  footer.replaceChildren(container);
}

export function initializePageShell() {
  const header = document.querySelector('#site-header');
  const footer = document.querySelector('#site-footer');

  if (header) {
    initializeHeader(header);
  }

  if (footer) {
    initializeFooter(footer);
  }
}

export function renderRouteError(message) {
  const status = document.querySelector('[id$="page-status"], [data-page-status]');

  if (status) {
    status.classList.add('status--error');
    status.textContent = message;
  }
}
