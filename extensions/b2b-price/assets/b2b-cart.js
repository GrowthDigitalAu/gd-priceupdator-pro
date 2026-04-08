document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('gd-b2b-cart-modal');
  if (!modal) return;

  const btnCancel = document.getElementById('gd-b2b-modal-cancel');
  let currentEvent = null;

  // ─── Check for persistent alerts from previous reloads ────────────────────
  if (sessionStorage.getItem('gd_b2b_qty_alert') === 'true') {
      sessionStorage.removeItem('gd_b2b_qty_alert');
      document.querySelector('.gd-b2b-modal-title').innerText = "Minimum Quantity Restored";
      document.querySelector('.gd-b2b-modal-text').innerHTML = `You attempted to lower the quantity of an item below its wholesale requirement.<br><br>Your cart has been automatically corrected to the minimum required quantity.`;
      if (modal) modal.style.display = 'flex';
  }

  // ─── Perform a sweep on Page Load to catch unsynced cart quantities ─────
  enforceCartMinimumQuantities();

  // ─── Auto-restore: clear opt-out whenever the cart is modified ───────────
  // Intercept fetch() calls for cart/change.js and cart/add.js
  const _originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
    const isCartChange = /cart\/(change|add|update)/i.test(url) && !/cart\.js/i.test(url);
    const result = await _originalFetch.apply(this, args);
    if (isCartChange && result.ok) {
      enforceCartMinimumQuantities();
    }
    return result;
  };

  // Also intercept XMLHttpRequest for themes that use jQuery.ajax
  const _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._gdUrl = url;
    return _open.call(this, method, url, ...rest);
  };
  const _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', () => {
      const u = this._gdUrl || '';
      if (/cart\/(change|add|update)/i.test(u) && !/cart\.js/i.test(u)) {
        enforceCartMinimumQuantities();
      }
    });
    return _send.apply(this, args);
  };

  // ─── Enforce Minimum Quantities in Cart ────────────────────────────────
  async function enforceCartMinimumQuantities() {
      try {
          const res = await _originalFetch((window.Shopify?.routes?.root || '/') + 'cart.js');
          const cart = await res.json();
          let needsUpdate = false;
          let updates = {};
          
          if (cart.items) {
             cart.items.forEach(item => {
                 let minQty = 0;
                 if (item.properties && item.properties._gd_b2b_min_qty) {
                     minQty = parseInt(item.properties._gd_b2b_min_qty, 10);
                 } else if (window.GDB2B_CART_MIN_QTYS && window.GDB2B_CART_MIN_QTYS[item.variant_id]) {
                     minQty = window.GDB2B_CART_MIN_QTYS[item.variant_id];
                 }

                 console.log(`[B2B Wholesale] Checking item: ${item.title}`);
                 console.log(`[B2B Wholesale] -> Current Cart QTY: ${item.quantity}`);
                 console.log(`[B2B Wholesale] -> Required Min QTY: ${minQty || 'None'}`);

                 if (minQty > 0 && item.quantity > 0 && item.quantity < minQty) {
                      console.log(`[B2B Wholesale] -> VIOLATION DETECTED! Updating to ${minQty}...`);
                      updates[item.key] = minQty;
                      needsUpdate = true;
                 } else {
                      console.log(`[B2B Wholesale] -> Status: OK`);
                 }
             });
          }
          
          if (needsUpdate) {
              await _originalFetch((window.Shopify?.routes?.root || '/') + 'cart/update.js', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ updates })
              });
              
              // Instead of reloading, safely redirect to the cart page to cleanly wipe cart drawer state
              sessionStorage.setItem('gd_b2b_qty_alert', 'true');
              window.location.href = (window.Shopify?.routes?.root || '/') + 'cart';
          }
      } catch (e) {}
  }

  // ─── Modal UI logic ───────────────────────────────────────────────────────
  btnCancel.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // ─── Checkout button intercept ────────────────────────────────────────────
  document.addEventListener('click', async (e) => {
    const isCheckoutBtn =
      e.target.matches('[name="checkout"], [href="/checkout"], [href^="/checkout?"]') ||
      e.target.closest('[name="checkout"], [href="/checkout"], [href^="/checkout?"]');

    if (!isCheckoutBtn) return;
    if (e.target.closest('#gd-b2b-cart-modal')) return;

    try {
      // We MUST temporarily pause the click to check the cart asynchronously.
      // We only call preventDefault here; we will re-allow if no modal is needed.
      e.preventDefault();
      e.stopPropagation();

      const res = await fetch((window.Shopify?.routes?.root || '/') + 'cart.js');
      const cart = await res.json();

      // Helper to proceed to checkout natively
      const proceedToCheckout = () => {
        if (isCheckoutBtn.tagName === 'A') {
          window.location.href = isCheckoutBtn.href || '/checkout';
        } else if (isCheckoutBtn.closest && isCheckoutBtn.closest('form')) {
          isCheckoutBtn.closest('form').submit();
        } else {
          window.location.href = '/checkout';
        }
      };

      // If cart is empty or has no value, don't intercept
      if (!cart.item_count || !cart.total_price) {
        proceedToCheckout();
        return;
      }

      let hasMinQtyViolation = false;
      let minQtyViolationMsg = '';
      if (cart.items) {
          cart.items.forEach(item => {
              let minQty = 0;
              if (item.properties && item.properties._gd_b2b_min_qty) {
                  minQty = parseInt(item.properties._gd_b2b_min_qty, 10);
              } else if (window.GDB2B_CART_MIN_QTYS && window.GDB2B_CART_MIN_QTYS[item.variant_id]) {
                  minQty = window.GDB2B_CART_MIN_QTYS[item.variant_id];
              }

              if (minQty > 0 && item.quantity > 0 && item.quantity < minQty) {
                  hasMinQtyViolation = true;
                  minQtyViolationMsg += `&bull; <strong>${item.title}</strong> requires at least ${minQty}.<br>`;
              }
          });
      }

      if (hasMinQtyViolation) {
          currentEvent = e;
          document.querySelector('.gd-b2b-modal-title').innerText = "Minimum Quantity Error";
          document.querySelector('.gd-b2b-modal-text').innerHTML = `You have items in your cart that do not meet the minimum B2B order quantity:<br><br>${minQtyViolationMsg}<br>Please adjust your cart to proceed.`;
          modal.style.display = 'flex';
          return;
      }

      const minOrder = window.GDB2B_MIN_ORDER_CENTS || 0;
      const requiresMinOrderCheck = minOrder > 0 && !window.GDB2B_IS_OLD_CUSTOMER;

      if (requiresMinOrderCheck && cart.total_price < minOrder) {
        // Show the hard block modal
        currentEvent = e;
        document.querySelector('.gd-b2b-modal-title').innerText = "B2B Minimum Order Not Met";
        document.querySelector('.gd-b2b-modal-text').innerHTML = `Your wholesale subtotal is under the required <strong>$${(minOrder/100).toFixed(2)}</strong> minimum.`;
        modal.style.display = 'flex';
      } else {
        // Threshold met — re-trigger natively
        proceedToCheckout();
      }
    } catch (err) {
      console.error("Cart check failed", err);
      // On error, do nothing — let Shopify's native event handle it
    }
  }, true);
});
