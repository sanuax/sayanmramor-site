(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.CategoryCalculator = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  function computeOptionSurchargeSum(selected, OPTION_SURCHARGE) {
    let sum = 0;
    if (selected.complex) sum += OPTION_SURCHARGE.complex;
    if (selected.polish) sum += OPTION_SURCHARGE.polish;
    if (selected.install) sum += OPTION_SURCHARGE.install;
    return sum;
  }

  function buildSurchargeLabels(selected, OPTION_SURCHARGE) {
    const labels = [];
    if (selected.complex) labels.push('сложная форма +' + (OPTION_SURCHARGE.complex * 100) + '%');
    if (selected.polish) labels.push('полировка +' + (OPTION_SURCHARGE.polish * 100) + '%');
    if (selected.install) labels.push('монтаж +' + (OPTION_SURCHARGE.install * 100) + '%');
    return labels;
  }

  function buildPricingParams({ stone, widthM, lengthM, product, productTypes, optionSurchargeSum }) {
    return {
      stone,
      widthM,
      lengthM,
      productType: product.type,
      complexityMultiplier: product.complexityMultiplier,
      optionSurchargeSum,
      marginCm: productTypes.SAW_MARGIN_CM,
      wasteFactor: productTypes.AREA_WASTE_FACTOR,
      workMultiplier: productTypes.HARDNESS_WORK_MULTIPLIER[stone.hardness_category] || productTypes.WORK_MULTIPLIER,
      allowSeam: product.allowSeam !== false
    };
  }

  const REASON_MESSAGES = {
    no_slabs_for_stone: 'Для этого камня сейчас нет данных о слэбах в наличии.',
    no_priced_slab: 'Для этого камня есть слэбы в наличии, но актуальная цена ещё не определена — пришлите размеры менеджеру для точного расчёта.',
    insufficient_stock: 'Даже все подходящие слэбы этого камня в сумме не покрывают нужный объём — пришлите размеры менеджеру для точного расчёта.',
    no_fitting_slab: 'Указанная ширина слишком большая для цельного изделия такого типа — шов возможен только по длине. Пришлите точные размеры менеджеру — подберём решение под ваш проект.'
  };
  const DEFAULT_REASON_MESSAGE = 'Подходящего слэба нет в наличии — пришлите размеры менеджеру для точного расчёта.';

  function messageForReason(reason) {
    return REASON_MESSAGES[reason] || DEFAULT_REASON_MESSAGE;
  }

  function pluralizeSlabs(n) {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'слэб';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'слэба';
    return 'слэбов';
  }

  function formatRub(n) {
    return Math.round(n).toLocaleString('ru-RU') + ' ₽';
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('ru-RU');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const INCOMPLETE_HINT = 'Выберите материал и укажите размеры, чтобы увидеть расчёт';

  function init(productKey) {
    const product = ProductTypes.PRODUCTS[productKey];
    if (!product) throw new Error('Unknown product key: ' + productKey);

    SiteCommon.injectMaterialPickerMarkup();

    const materialField = document.getElementById('materialField');
    const materialFieldThumb = document.getElementById('materialFieldThumb');
    const materialFieldThumbImg = materialFieldThumb.querySelector('img');
    materialFieldThumbImg.addEventListener('error', () => { materialFieldThumb.hidden = true; });
    const materialFieldText = document.getElementById('materialFieldText');
    const widthInput = document.getElementById('width');
    const lengthInput = document.getElementById('length');
    const dimError = document.getElementById('dimError');
    const priceOut = document.getElementById('priceOut');
    const breakdown = document.getElementById('breakdown');
    const warningOut = document.getElementById('warningOut');
    const remainderOut = document.getElementById('remainderOut');
    const updatedAtOut = document.getElementById('updatedAtOut');
    const infoBlock = document.getElementById('infoBlock');
    const ctaBtn = document.getElementById('ctaBtn');
    const optComplex = document.getElementById('opt-complex');
    const optPolish = document.getElementById('opt-polish');
    const optInstall = document.getElementById('opt-install');

    let STONES_BY_ID = {};
    let UPDATED_AT = null;
    let DATA_LOADED = false;
    let selectedStoneId = null;
    let picker = null;
    let dimsTouched = false;

    function setPriceHint(text) { priceOut.textContent = text; priceOut.classList.add('placeholder'); }
    function setPriceValue(text) { priceOut.textContent = text; priceOut.classList.remove('placeholder'); }

    function handleMaterialSelected(stoneId) {
      const stone = STONES_BY_ID[stoneId];
      selectedStoneId = stoneId;
      materialFieldText.textContent = stone.name;
      if (stone.image) {
        materialFieldThumbImg.src = '/calculator/data/' + stone.image;
        materialFieldThumb.hidden = false;
      } else {
        materialFieldThumb.hidden = true;
      }
      calculate();
    }

    materialField.addEventListener('click', () => { if (picker) picker.open(); });

    function calculate() {
      if (!DATA_LOADED) return;

      const widthM = parseFloat(widthInput.value) || 0;
      const lengthM = parseFloat(lengthInput.value) || 0;

      warningOut.style.display = 'none';
      warningOut.innerHTML = '';
      remainderOut.textContent = '';

      if (widthM <= 0 || lengthM <= 0) {
        dimError.style.display = dimsTouched ? 'block' : 'none';
        setPriceHint(INCOMPLETE_HINT);
        breakdown.innerHTML = '';
        updatedAtOut.textContent = '';
        infoBlock.style.display = 'none';
        return;
      }
      dimError.style.display = 'none';

      if (!selectedStoneId) {
        setPriceHint(INCOMPLETE_HINT);
        breakdown.innerHTML = '';
        warningOut.style.display = 'none';
        updatedAtOut.textContent = '';
        infoBlock.style.display = 'none';
        return;
      }
      const stone = STONES_BY_ID[selectedStoneId];

      if (stone.available === false) {
        setPriceValue('Нужно уточнить у менеджера');
        warningOut.textContent = 'Этот камень сейчас распродан — пришлите размеры менеджеру для точного расчёта.';
        warningOut.style.display = 'block';
        breakdown.innerHTML = '';
        remainderOut.textContent = '';
        updatedAtOut.textContent = '';
        infoBlock.style.display = 'none';
        return;
      }

      const selectedOptions = { complex: optComplex.checked, polish: optPolish.checked, install: optInstall.checked };
      const optionSurchargeSum = computeOptionSurchargeSum(selectedOptions, ProductTypes.OPTION_SURCHARGE);
      const surchargeLabels = buildSurchargeLabels(selectedOptions, ProductTypes.OPTION_SURCHARGE);

      const params = buildPricingParams({ stone, widthM, lengthM, product, productTypes: ProductTypes, optionSurchargeSum });
      const result = Pricing.calculatePrice(params);

      if (!result.ok) {
        setPriceValue('Нужно уточнить у менеджера');
        warningOut.textContent = messageForReason(result.reason);
        warningOut.style.display = 'block';
        breakdown.innerHTML = '';
        updatedAtOut.textContent = '';
        infoBlock.style.display = 'none';
        return;
      }

      infoBlock.style.display = '';
      setPriceValue('≈ ' + formatRub(result.total));

      let html = `Площадь: <span>${(widthM * lengthM).toFixed(2)} м²</span><br>`;
      html += `Материал: <span>${escapeHtml(stone.name)}</span><br>`;
      html += `Изделие: <span>${product.label}</span>`;
      if (surchargeLabels.length) {
        html += `<br>Опции: <span>${surchargeLabels.join(', ')}</span>`;
      }
      breakdown.innerHTML = html;

      if (product.type === 'A' && result.remainderM2 !== null) {
        remainderOut.textContent = 'Остаток слэба после раскроя: ' + result.remainderM2.toFixed(2) + ' м²';
      }

      if (result.nSlabs > 1) {
        warningOut.textContent = 'Потребуется ' + result.nSlabs + ' ' + pluralizeSlabs(result.nSlabs) + ' со швом.';
        warningOut.style.display = 'block';
      }

      if (productKey === 'lestnitsa') {
        const note = 'Точный расчёт лестницы требует уточнения количества и размера ступеней у менеджера — цена ориентировочная.';
        warningOut.textContent = warningOut.textContent ? warningOut.textContent + ' ' + note : note;
        warningOut.style.display = 'block';
      }

      updatedAtOut.textContent = 'Расчёт по ценам на ' + formatDate(UPDATED_AT) + ', точная цена подтверждается менеджером.';
    }

    fetch('/calculator/data/slabs.json')
      .then(r => r.json())
      .then(data => {
        UPDATED_AT = data.updated_at;
        (data.stones || []).forEach(stone => { STONES_BY_ID[stone.id] = stone; });
        picker = MaterialPicker.init({ stones: data.stones || [], onSelect: handleMaterialSelected });
        materialField.disabled = false;
        materialFieldText.textContent = 'Выберите камень';
        DATA_LOADED = true;
        calculate();
      })
      .catch(() => {
        materialField.disabled = true;
        materialFieldText.textContent = 'Ошибка загрузки';
        warningOut.textContent = 'Не удалось загрузить данные о камне. Проверьте, что страница открыта через веб-сервер (не как локальный файл).';
        warningOut.style.display = 'block';
      });

    [widthInput, lengthInput].forEach(el => {
      el.addEventListener('input', () => { dimsTouched = true; calculate(); });
      el.addEventListener('change', () => { dimsTouched = true; calculate(); });
    });
    [optComplex, optPolish, optInstall].forEach(el => el.addEventListener('change', calculate));

    ctaBtn.addEventListener('click', () => {
      if (parseFloat(widthInput.value) > 0 && parseFloat(lengthInput.value) > 0) {
        alert('Здесь будет открываться форма заявки с уже заполненными данными расчёта (материал, размеры).');
      } else {
        dimsTouched = true;
        dimError.style.display = 'block';
      }
    });
  }

  return {
    computeOptionSurchargeSum, buildSurchargeLabels, buildPricingParams,
    messageForReason, pluralizeSlabs, formatRub, formatDate, init
  };
});
