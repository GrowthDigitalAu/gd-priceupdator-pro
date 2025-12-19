(function() {
  function formatMoney(cents, format) {
    if (typeof cents === 'string') cents = cents.replace('.', '');
    let value = '';
    const placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
    const formatString = format || "${{amount}}";

    function defaultOption(opt, def) {
       return (typeof opt == 'undefined' ? def : opt);
    }

    function formatWithDelimiters(number, precision, thousands, decimal) {
      precision = defaultOption(precision, 2);
      thousands = defaultOption(thousands, ',');
      decimal   = defaultOption(decimal, '.');

      if (isNaN(number) || number == null) { return 0; }

      number = (number/100.0).toFixed(precision);

      var parts   = number.split('.'),
          dollars = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands),
          cents   = parts[1] ? (decimal + parts[1]) : '';

      return dollars + cents;
    }

    switch(formatString.match(placeholderRegex)[1]) {
      case 'amount':
        value = formatWithDelimiters(cents, 2);
        break;
      case 'amount_no_decimals':
        value = formatWithDelimiters(cents, 0);
        break;
      case 'amount_with_comma_separator':
        value = formatWithDelimiters(cents, 2, '.', ',');
        break;
      case 'amount_no_decimals_with_comma_separator':
        value = formatWithDelimiters(cents, 0, '.', ',');
        break;
    }

    return formatString.replace(placeholderRegex, value);
  }

  function updateTarget(container, html) {
    if (container) container.innerHTML = html;
  }

  function initB2BPrice(config) {
    const { isB2B, moneyFormat, variantsData, blockId, selectedVariantId } = config;
    let currentHtml = '';

    function updatePriceDisplay(variantId) {
      const data = variantsData[variantId];
      if (!data) return;

      let html = '';

      if (isB2B && data.b2b_price && data.b2b_price > 0) {
         html = `
            <div class="b2b-price-wrapper b2b-customer-price">
                <span class="b2b-price-current">${formatMoney(data.b2b_price, moneyFormat)}</span>
                <span class="b2b-price-original" style="text-decoration: line-through;">
                  ${formatMoney(data.price, moneyFormat)}
                </span>
            </div>
         `;
      } 
      else if (data.compare_at_price && data.compare_at_price > data.price) {
         html = `
            <div class="b2b-price-wrapper b2b-regular-sale">
                <span class="b2b-price-current">${formatMoney(data.price, moneyFormat)}</span>
                <span class="b2b-price-compare" style="text-decoration: line-through;">
                  ${formatMoney(data.compare_at_price, moneyFormat)}
                </span>
            </div>
         `;
      }
      else {
         html = `
            <div class="b2b-price-wrapper b2b-regular-price">
                <span class="b2b-price-current">${formatMoney(data.price, moneyFormat)}</span>
            </div>
         `;
      }
      
      currentHtml = html; 

      const internalContainer = document.getElementById("b2b-price-container-" + blockId);
      updateTarget(internalContainer, html);

      const externalContainers = document.querySelectorAll('.gd-b2b-price-update');
      externalContainers.forEach(container => updateTarget(container, html));
    }

    let currentVariantId = selectedVariantId;
    
    updatePriceDisplay(currentVariantId);

    setInterval(() => {
        const params = new URLSearchParams(window.location.search);
        const variantFromUrl = params.get('variant');
        
        if (variantFromUrl && variantFromUrl !== currentVariantId) {
            currentVariantId = variantFromUrl;
            updatePriceDisplay(variantFromUrl);
        }
    }, 500);
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { 
            if (node.classList && node.classList.contains('gd-b2b-price-update')) {
               updateTarget(node, currentHtml);
            } else if (node.querySelectorAll) {
               const children = node.querySelectorAll('.gd-b2b-price-update');
               children.forEach(child => updateTarget(child, currentHtml));
            }
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Initialization Pattern
  window.b2bPriceConfigs = window.b2bPriceConfigs || [];
  window.b2bPriceConfigs.forEach(initB2BPrice);
  
  // Override push to capture future additions
  const oldPush = window.b2bPriceConfigs.push;
  window.b2bPriceConfigs.push = function(config) {
    oldPush.call(this, config);
    initB2BPrice(config);
  };

})();
