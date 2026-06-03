(function () {
    const API_BASE_URL = window.location.protocol === 'file:' ? 'http://127.0.0.1:8000' : '';

    async function request(path, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        if (options.token) {
            headers.Authorization = `Bearer ${options.token}`;
        }

        const response = await fetch(`${API_BASE_URL}${path}`, {
            method: options.method || 'GET',
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            const error = new Error(payload.error || `HTTP ${response.status}`);
            error.status = response.status;
            error.payload = payload;
            throw error;
        }

        return payload;
    }

    function getToken(storageKey) {
        return localStorage.getItem(storageKey) || '';
    }

    window.RestaurantAPI = {
        async isAvailable() {
            try {
                const health = await request('/api/health');
                return Boolean(health.ok);
            } catch (error) {
                return false;
            }
        },

        customerLogin(credentials) {
            return request('/api/auth/customer/login', {
                method: 'POST',
                body: credentials
            });
        },

        customerRegister(customer) {
            return request('/api/auth/customer/register', {
                method: 'POST',
                body: customer
            });
        },

        adminLogin(credentials) {
            return request('/api/auth/admin/login', {
                method: 'POST',
                body: credentials
            });
        },

        getMenu() {
            return request('/api/menu');
        },

        createMenuItem(token, item) {
            return request('/api/menu', {
                method: 'POST',
                token,
                body: item
            });
        },

        updateMenuItem(token, itemId, item) {
            return request(`/api/menu/${encodeURIComponent(itemId)}`, {
                method: 'PUT',
                token,
                body: item
            });
        },

        deleteMenuItem(token, itemId) {
            return request(`/api/menu/${encodeURIComponent(itemId)}`, {
                method: 'DELETE',
                token
            });
        },

        getTables() {
            return request('/api/tables');
        },

        createTable(token, table) {
            return request('/api/tables', {
                method: 'POST',
                token,
                body: table
            });
        },

        updateTable(token, tableId, table) {
            return request(`/api/tables/${encodeURIComponent(tableId)}`, {
                method: 'PUT',
                token,
                body: table
            });
        },

        deleteTable(token, tableId) {
            return request(`/api/tables/${encodeURIComponent(tableId)}`, {
                method: 'DELETE',
                token
            });
        },

        getOrders(token) {
            return request('/api/orders', {
                token
            });
        },

        createOrder(token, order) {
            return request('/api/orders', {
                method: 'POST',
                token,
                body: order
            });
        },

        updateOrderStatus(token, orderId, status) {
            return request(`/api/orders/${encodeURIComponent(orderId)}/status`, {
                method: 'PUT',
                token,
                body: { status }
            });
        },

        getCustomers(token) {
            return request('/api/users/customers', {
                token
            });
        },

        getBestSeller(token, start, end) {
            const params = new URLSearchParams();
            if (start) params.set('start', start);
            if (end) params.set('end', end);
            return request(`/api/reports/best-seller?${params.toString()}`, {
                token
            });
        },

        request,
        getToken
    };
})();
