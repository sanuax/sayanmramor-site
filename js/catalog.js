(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.Catalog = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  function formatProductPrice(priceRub) {
    if (typeof priceRub !== 'number' || !Number.isFinite(priceRub)) return 'Цена по запросу';
    return Math.round(priceRub).toLocaleString('ru-RU') + ' ₽';
  }

  function isAvailable(product) {
    return product.available !== false;
  }

  function buildProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-tile';

    const imageWrap = document.createElement('div');
    imageWrap.className = 'product-tile-image';
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = product.name || '';
    img.src = (product.photos && product.photos[0]) || '';
    img.addEventListener('error', () => { imageWrap.classList.add('image-broken'); img.remove(); });
    imageWrap.appendChild(img);
    if (!isAvailable(product)) {
      const badge = document.createElement('span');
      badge.className = 'badge-oos';
      badge.textContent = 'Нет в наличии';
      imageWrap.appendChild(badge);
    }

    const name = document.createElement('div');
    name.className = 'product-tile-name';
    name.textContent = product.name;

    const price = document.createElement('div');
    price.className = 'product-tile-price';
    price.textContent = formatProductPrice(product.price_rub);

    card.appendChild(imageWrap);
    card.appendChild(name);
    card.appendChild(price);

    if (product.description) {
      const desc = document.createElement('div');
      desc.className = 'product-tile-description';
      desc.textContent = product.description;
      card.appendChild(desc);
    }

    return card;
  }

  function renderCatalog(container, products) {
    container.innerHTML = '';
    if (!products || products.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'catalog-empty';
      empty.textContent = 'Пока нет готовых изделий — загляните позже.';
      container.appendChild(empty);
      return;
    }
    products.forEach(product => container.appendChild(buildProductCard(product)));
  }

  return { formatProductPrice, isAvailable, buildProductCard, renderCatalog };
});
