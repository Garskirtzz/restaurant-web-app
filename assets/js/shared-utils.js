(function () {
    const htmlEscapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, function (char) {
            return htmlEscapeMap[char];
        });
    }

    function encodeKey(value) {
        return encodeURIComponent(String(value ?? ''));
    }

    function decodeKey(value) {
        try {
            return decodeURIComponent(String(value ?? ''));
        } catch (error) {
            return String(value ?? '');
        }
    }

    function formatNumber(value) {
        return Number(value || 0).toLocaleString('id-ID');
    }

    function formatCurrency(value) {
        return 'Rp' + formatNumber(value);
    }

    function getLocalDateKey(value) {
        const date = value ? new Date(value) : new Date();

        if (Number.isNaN(date.getTime())) {
            return '';
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function readArrayFromStorage(key, fallback = []) {
        const raw = localStorage.getItem(key);

        if (!raw) {
            return [...fallback];
        }

        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [...fallback];
        } catch (error) {
            console.error(`Gagal membaca ${key}:`, error);
            return [...fallback];
        }
    }

    function writeArrayToStorage(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function getOrderId(order) {
        return String(order.id || order.orderNumber || '');
    }

    function normalizeTableKey(tableNumber) {
        const match = String(tableNumber || '').match(/\d+/);
        return match ? match[0] : '';
    }

    function formatTableNumber(tableNumber) {
        if (!tableNumber) {
            return 'Take Away';
        }

        const text = String(tableNumber);
        return /^meja\s+/i.test(text) ? text : `Meja ${text}`;
    }

    // CSP-friendly event delegation: replaces inline on* handlers.
    // Walks up from the event target to the nearest [data-action] element and
    // invokes the matching handler. Because only the nearest match runs, nested
    // actions (e.g. a button inside a clickable card) work without stopPropagation.
    function delegateActions(root, handlers, eventType) {
        root.addEventListener(eventType || 'click', function (event) {
            const trigger = event.target.closest('[data-action]');

            if (!trigger || !root.contains(trigger)) {
                return;
            }

            const handler = handlers[trigger.dataset.action];

            if (typeof handler === 'function') {
                handler(trigger, event);
            }
        });
    }

    // Applies per-domain branding: sets document.title and fills any element
    // marked with [data-brand-name]. Resolves the brand by hostname, falling
    // back to `defaults` for unknown hosts (e.g. localhost).
    function applyBranding(brandMap, defaults) {
        const brand = (brandMap && brandMap[window.location.hostname]) || defaults;

        if (!brand) {
            return;
        }

        if (brand.title) {
            document.title = brand.title;
        }

        if (brand.name) {
            document.querySelectorAll('[data-brand-name]').forEach(function (element) {
                element.textContent = brand.name;
            });
        }
    }

    window.RestaurantUtils = {
        escapeHTML,
        encodeKey,
        decodeKey,
        formatNumber,
        formatCurrency,
        getLocalDateKey,
        readArrayFromStorage,
        writeArrayToStorage,
        getOrderId,
        normalizeTableKey,
        formatTableNumber,
        delegateActions,
        applyBranding
    };
})();
