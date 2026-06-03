const ADMIN_CREDENTIALS = {
            username: "admin",
            password: "password123"
        };

        const ORDERS_STORAGE_KEY = 'restaurantOrders';
        const MENU_STORAGE_KEY = 'restaurantMenu';
        const TABLES_STORAGE_KEY = 'restaurantTables';
        const USERS_STORAGE_KEY = 'restaurantUsers';
        const ADMIN_AUTH_TOKEN_KEY = 'restaurantAdminToken';
        const CUSTOMER_AUTH_TOKEN_KEY = 'restaurantCustomerToken';
        const CUSTOMER_SESSION_KEY = 'restaurantCustomerSession';

        const DEFAULT_USERS = [
            { username: "user1", password: "user123", name: "Pelanggan 1", email: "user1@example.com", phone: "081234567890", address: "Jl. Contoh No. 1" },
            { username: "user2", password: "user123", name: "Pelanggan 2", email: "user2@example.com", phone: "082345678901", address: "Jl. Contoh No. 2" }
        ];

        const DEFAULT_TABLES = [
            { number: 1, capacity: 4, status: 'available' },
            { number: 2, capacity: 4, status: 'available' },
            { number: 3, capacity: 6, status: 'available' },
            { number: 4, capacity: 6, status: 'available' },
            { number: 5, capacity: 2, status: 'available' },
            { number: 6, capacity: 2, status: 'available' },
            { number: 7, capacity: 8, status: 'available' },
            { number: 8, capacity: 8, status: 'available' }
        ];

        const DEFAULT_MENU_ITEMS = [
            { id: '1', name: 'Nasi Goreng Special', category: 'food', price: 20000, description: 'Digoreng dengan bumbu rempah, telur, dan ayam suwir.', image: '', available: true },
            { id: '2', name: 'Ayam Geprek', category: 'food', price: 15000, description: 'Ayam krispi dan nasi hangat ditambah sambal pedas.', image: '', available: true },
            { id: '3', name: 'Rice Bowl', category: 'food', price: 22000, description: 'Nasi, telur, dan daging dalam satu mangkuk.', image: '', available: true },
            { id: '4', name: 'Es Teh Manis', category: 'drink', price: 5000, description: 'Teh melati dingin dengan gula.', image: '', available: true },
            { id: '5', name: 'Jus Alpukat', category: 'drink', price: 12000, description: 'Jus alpukat segar.', image: '', available: true },
            { id: '6', name: 'Jus Mangga', category: 'drink', price: 15000, description: 'Jus mangga segar.', image: '', available: true },
            { id: '7', name: 'Es Krim Vanilla', category: 'dessert', price: 10000, description: 'Es krim vanilla lembut.', image: '', available: true },
            { id: '8', name: 'Pisang Goreng Keju', category: 'dessert', price: 15000, description: 'Pisang goreng dengan keju parut.', image: '', available: true },
            { id: '9', name: 'Kolak Pisang Ubi', category: 'dessert', price: 20000, description: 'Kolak hangat dengan santan gula merah.', image: '', available: true }
        ];

        let USER_CREDENTIALS = [...DEFAULT_USERS];
        let currentEditingId = null;
        let currentViewingOrderId = null;
        let currentUser = null;
        let currentOrderItems = [];
        let lastOrdersSnapshot = null;
        let realtimeSyncStarted = false;
        let apiAvailable = false;
        let apiOrdersCache = [];
        let apiMenuCache = [];
        let apiTablesCache = [];
        let currentDashboardOrderStatus = 'incoming';
        let knownOrderStatusIds = {
            incoming: new Set(),
            processing: new Set(),
            completed: new Set()
        };
        let unreadOrderStatusCounts = {
            incoming: 0,
            processing: 0,
            completed: 0
        };
        let orderNotificationReady = false;
        const {
            readArrayFromStorage,
            writeArrayToStorage,
            escapeHTML,
            encodeKey,
            decodeKey,
            getOrderId,
            formatCurrency,
            getLocalDateKey,
            normalizeTableKey,
            formatTableNumber
        } = window.RestaurantUtils;

        function getAdminToken() {
            return localStorage.getItem(ADMIN_AUTH_TOKEN_KEY) || '';
        }

        function getCustomerToken() {
            return localStorage.getItem(CUSTOMER_AUTH_TOKEN_KEY) || '';
        }

        function normalizeApiOrder(order) {
            return {
                id: order.id || order.order_number || order.orderNumber,
                orderNumber: order.order_number || order.orderNumber || order.id,
                customerName: order.customer_name || order.customerName || '-',
                customerUsername: order.customer_username || order.customerUsername || '',
                tableNumber: order.table_number || order.tableNumber || '',
                items: Array.isArray(order.items) ? order.items : [],
                total: Number(order.total || 0),
                status: order.status || 'pending',
                paymentMethod: order.payment_method || order.paymentMethod || 'cash',
                timestamp: order.timestamp,
                processedAt: order.processed_at || order.processedAt || '',
                completedAt: order.completed_at || order.completedAt || ''
            };
        }

        function normalizeApiMenuItem(item) {
            return {
                id: item.id,
                name: item.name || '',
                category: item.category || 'food',
                price: Number(item.price || 0),
                description: item.description || '',
                image: item.image || '',
                available: item.available !== false && Number(item.available) !== 0
            };
        }

        function normalizeApiTable(table) {
            return {
                id: table.id,
                number: table.number,
                capacity: Number(table.capacity || 0),
                status: table.status || 'available'
            };
        }

        function getOrders() {
            if (apiAvailable && getAdminToken()) {
                return apiOrdersCache;
            }

            return readArrayFromStorage(ORDERS_STORAGE_KEY);
        }

        function saveOrders(orders) {
            writeArrayToStorage(ORDERS_STORAGE_KEY, orders);
            lastOrdersSnapshot = null;
        }

        function getMenuItems() {
            if (apiAvailable && getAdminToken()) {
                return apiMenuCache;
            }

            return readArrayFromStorage(MENU_STORAGE_KEY, DEFAULT_MENU_ITEMS);
        }

        function saveMenuItems(menuItems) {
            writeArrayToStorage(MENU_STORAGE_KEY, menuItems);
        }

        function getTables() {
            if (apiAvailable && getAdminToken()) {
                return apiTablesCache;
            }

            return readArrayFromStorage(TABLES_STORAGE_KEY, DEFAULT_TABLES);
        }

        function saveTables(tables) {
            writeArrayToStorage(TABLES_STORAGE_KEY, tables);
        }

        function ensureDefaultData() {
            if (!localStorage.getItem(ORDERS_STORAGE_KEY)) {
                writeArrayToStorage(ORDERS_STORAGE_KEY, []);
            }

            if (!localStorage.getItem(MENU_STORAGE_KEY)) {
                saveMenuItems(DEFAULT_MENU_ITEMS);
            }

            if (!localStorage.getItem(TABLES_STORAGE_KEY)) {
                saveTables(DEFAULT_TABLES);
            }

            const storedUsers = localStorage.getItem(USERS_STORAGE_KEY);
            if (storedUsers) {
                USER_CREDENTIALS = readArrayFromStorage(USERS_STORAGE_KEY, DEFAULT_USERS);
            } else {
                writeArrayToStorage(USERS_STORAGE_KEY, DEFAULT_USERS);
            }
        }

        function formatDate(value) {
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('id-ID');
        }

        function formatDateTime(value) {
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('id-ID');
        }

        function getStatusText(status) {
            const normalizedStatus = status || 'pending';
            const statusTexts = {
                pending: 'Pesanan Masuk',
                processing: 'Diproses',
                completed: 'Selesai',
                cancelled: 'Dibatalkan'
            };
            return statusTexts[normalizedStatus] || normalizedStatus || '-';
        }

        function isIncomingOrder(order) {
            return (order.status || 'pending') === 'pending';
        }

        function isProcessingOrder(order) {
            return (order.status || 'pending') === 'processing';
        }

        function isActiveOrder(order) {
            return ['pending', 'processing'].includes(order.status || 'pending');
        }

        function isCompletedOrder(order) {
            return order.status === 'completed';
        }

        function getPaymentMethodText(method) {
            const methodTexts = {
                cash: 'Tunai',
                qris: 'QRIS',
                'bank-transfer': 'Transfer Bank'
            };
            return methodTexts[method] || method || '-';
        }

        function getCategoryText(category) {
            const categoryTexts = {
                food: 'Makanan',
                drink: 'Minuman',
                dessert: 'Dessert'
            };
            return categoryTexts[category] || category || '-';
        }

        function renderEmptyRow(tbody, colspan, message) {
            if (!tbody) return;

            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="${colspan}" style="text-align:center; color: var(--text-muted);">${escapeHTML(message)}</td>`;
            tbody.appendChild(row);
        }

        function sortOrdersNewestFirst(orders) {
            return [...orders].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
        }
