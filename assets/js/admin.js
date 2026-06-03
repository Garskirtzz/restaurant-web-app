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

        function togglePassword(inputId) {
            const input = document.getElementById(inputId);

            if (!input) {
                return;
            }

            input.type = input.type === 'password' ? 'text' : 'password';
        }

        function switchLoginTab(tab) {
            const userForm = document.getElementById('user-login-form');
            const adminForm = document.getElementById('admin-login-form');
            const tabs = document.querySelectorAll('.login-tab');

            tabs.forEach(tabElement => tabElement.classList.remove('active'));

            if (tab === 'admin') {
                if (userForm) userForm.style.display = 'none';
                if (adminForm) adminForm.style.display = 'block';
                if (tabs[1]) tabs[1].classList.add('active');
            } else {
                if (userForm) userForm.style.display = 'block';
                if (adminForm) adminForm.style.display = 'none';
                if (tabs[0]) tabs[0].classList.add('active');
            }
        }

        function showPanel(panelId) {
            const loginPage = document.getElementById('login-page');
            const adminPanel = document.getElementById('admin-panel');
            const userPanel = document.getElementById('user-panel');
            const activePanel = ['login-page', 'admin-panel', 'user-panel'].includes(panelId) ? panelId : 'login-page';
            const stateClass = {
                'login-page': 'state-login',
                'admin-panel': 'state-admin',
                'user-panel': 'state-user'
            }[activePanel];

            document.body.classList.remove('state-login', 'state-admin', 'state-user');
            document.body.classList.add(stateClass);

            setPanelVisibility(loginPage, activePanel === 'login-page', 'flex');
            setPanelVisibility(adminPanel, activePanel === 'admin-panel', 'block');
            setPanelVisibility(userPanel, activePanel === 'user-panel', 'block');
        }

        function setPanelVisibility(element, isVisible, displayValue) {
            if (!element) return;

            element.hidden = !isVisible;
            element.setAttribute('aria-hidden', String(!isVisible));
            element.style.display = isVisible ? displayValue : 'none';
        }

        async function adminLogin() {
            const username = document.getElementById('admin-username').value;
            const password = document.getElementById('admin-password').value;
            const errorElement = document.getElementById('admin-login-error');

            if (apiAvailable) {
                try {
                    const response = await RestaurantAPI.adminLogin({ username, password });
                    localStorage.setItem(ADMIN_AUTH_TOKEN_KEY, response.token);
                } catch (error) {
                    if (errorElement) errorElement.style.display = 'block';
                    return;
                }
            } else {
                if (username !== ADMIN_CREDENTIALS.username || password !== ADMIN_CREDENTIALS.password) {
                    if (errorElement) errorElement.style.display = 'block';
                    return;
                }
            }

            localStorage.setItem('adminLoggedIn', 'true');
            localStorage.removeItem('userLoggedIn');
            localStorage.removeItem('currentUser');
            localStorage.removeItem(CUSTOMER_AUTH_TOKEN_KEY);
            localStorage.removeItem(CUSTOMER_SESSION_KEY);
            currentUser = null;
            if (errorElement) errorElement.style.display = 'none';
            showPanel('admin-panel');
            await initializeAdminPanel();
        }

        async function userLogin() {
            const username = document.getElementById('user-username').value;
            const password = document.getElementById('user-password').value;
            const errorElement = document.getElementById('user-login-error');

            if (apiAvailable) {
                try {
                    const response = await RestaurantAPI.customerLogin({ username, password });
                    localStorage.setItem(CUSTOMER_AUTH_TOKEN_KEY, response.token);
                    localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(response.user));
                    localStorage.setItem('userLoggedIn', 'true');
                    localStorage.removeItem('adminLoggedIn');
                    localStorage.removeItem(ADMIN_AUTH_TOKEN_KEY);
                    localStorage.setItem('currentUser', response.user.username);
                    currentUser = response.user;
                    if (errorElement) errorElement.style.display = 'none';
                    showPanel('user-panel');
                    await initializeUserPanel();
                    return;
                } catch (error) {
                    if (errorElement) errorElement.style.display = 'block';
                    return;
                }
            }

            const user = USER_CREDENTIALS.find(item => item.username === username && item.password === password);

            if (user) {
                localStorage.setItem('userLoggedIn', 'true');
                localStorage.removeItem('adminLoggedIn');
                localStorage.setItem('currentUser', username);
                currentUser = user;
                showPanel('user-panel');
                await initializeUserPanel();
                return;
            }

            if (errorElement) errorElement.style.display = 'block';
        }

        function logout() {
            if (!confirm('Apakah Anda yakin ingin logout?')) {
                return;
            }

            localStorage.removeItem('adminLoggedIn');
            localStorage.removeItem('userLoggedIn');
            localStorage.removeItem('currentUser');
            localStorage.removeItem(ADMIN_AUTH_TOKEN_KEY);
            localStorage.removeItem(CUSTOMER_AUTH_TOKEN_KEY);
            localStorage.removeItem(CUSTOMER_SESSION_KEY);
            currentUser = null;
            showPanel('login-page');
        }

        function setupNavigation() {
            document.querySelectorAll('#admin-panel .sidebar-menu a').forEach(link => {
                link.addEventListener('click', function (event) {
                    event.preventDefault();
                    activatePage('#admin-panel', this.getAttribute('href').substring(1) + '-page');
                });
            });

            document.querySelectorAll('#user-panel .sidebar-menu a').forEach(link => {
                link.addEventListener('click', function (event) {
                    event.preventDefault();
                    activatePage('#user-panel', this.getAttribute('href').substring(1) + '-page');
                });
            });
        }

        async function activatePage(panelSelector, pageId) {
            const panel = document.querySelector(panelSelector);
            if (!panel) return;

            panel.querySelectorAll('.sidebar-menu a').forEach(link => {
                const isActive = link.getAttribute('href') === '#' + pageId.replace(/-page$/, '');
                link.classList.toggle('active', isActive);
            });

            panel.querySelectorAll('main > div').forEach(page => {
                page.style.display = page.id === pageId ? 'block' : 'none';
            });

            if (pageId === 'dashboard-page') {
                loadDashboardData();
            } else if (pageId === 'orders-page') {
                loadOrders();
            } else if (pageId === 'menu-page') {
                await loadMenuItems();
            } else if (pageId === 'tables-page') {
                await loadTables();
            } else if (pageId === 'reports-page') {
                setDefaultReportDates();
                await generateCustomReport();
            } else if (pageId === 'settings-page') {
                await loadSettings();
            } else if (pageId === 'user-dashboard-page' || pageId === 'user-orders-page') {
                loadUserOrders();
            } else if (pageId === 'user-profile-page') {
                await refreshCurrentUserProfile();
                fillUserProfile();
            } else if (pageId === 'new-order-page') {
                loadNewOrderData();
            }
        }

        async function initializeAdminPanel() {
            ensureDefaultData();
            setDefaultReportDates();
            await loadSettings();
            await refreshMenuData();
            await refreshTableData();
            await refreshOrderViews(true);
            await loadMenuItems();
            const initialPage = getInitialAdminPage();
            await activatePage('#admin-panel', initialPage);
            startRealtimeOrdersSync();
        }

        function getInitialAdminPage() {
            const allowedPages = new Set(['dashboard', 'menu', 'tables', 'reports', 'settings']);
            const hash = window.location.hash.replace('#', '');
            return allowedPages.has(hash) ? `${hash}-page` : 'dashboard-page';
        }

        async function refreshCurrentUserProfile() {
            if (!apiAvailable || !getCustomerToken()) {
                return currentUser;
            }

            try {
                const response = await RestaurantAPI.getCurrentUser(getCustomerToken());
                currentUser = response.user;
                localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(currentUser));
                localStorage.setItem('currentUser', currentUser.username);
            } catch (error) {
                console.error('Gagal memuat profil customer dari API:', error);
            }

            return currentUser;
        }

        async function initializeUserPanel() {
            ensureDefaultData();
            await refreshCurrentUserProfile();
            fillUserProfile();
            loadUserOrders();
            loadNewOrderData();
            activatePage('#user-panel', 'user-dashboard-page');
            startRealtimeOrdersSync();
        }

        function setDefaultReportDates() {
            const startInput = document.getElementById('report-start-date');
            const endInput = document.getElementById('report-end-date');
            const today = getLocalDateKey();

            if (startInput && !startInput.value) startInput.value = today;
            if (endInput && !endInput.value) endInput.value = today;
        }

        function loadUserOrders() {
            if (!currentUser) return;

            const userOrders = sortOrdersNewestFirst(getOrders().filter(order => order.customerName === currentUser.name));
            document.getElementById('user-active-orders').textContent = userOrders.filter(isActiveOrder).length;
            document.getElementById('user-total-orders').textContent = userOrders.length;

            renderUserOrdersTable('#user-recent-orders-table tbody', userOrders.slice(0, 5));
            renderUserOrdersTable('#user-all-orders-table tbody', userOrders);
        }

        function renderUserOrdersTable(selector, orders) {
            const tbody = document.querySelector(selector);
            if (!tbody) return;

            tbody.innerHTML = '';

            if (orders.length === 0) {
                renderEmptyRow(tbody, 5, 'Belum ada pesanan');
                return;
            }

            orders.forEach(order => {
                const row = document.createElement('tr');
                const orderId = getOrderId(order);
                row.innerHTML = `
                    <td>#${escapeHTML(orderId)}</td>
                    <td>${escapeHTML(formatDate(order.timestamp))}</td>
                    <td>${escapeHTML(formatCurrency(order.total))}</td>
                    <td><span class="status ${escapeHTML(order.status || 'pending')}">${escapeHTML(getStatusText(order.status))}</span></td>
                    <td><button class="action-btn" onclick="showOrderDetailModal('${encodeKey(orderId)}')">Detail</button></td>
                `;
                tbody.appendChild(row);
            });
        }

        function fillUserProfile() {
            if (!currentUser) return;

            document.getElementById('user-profile-name').value = currentUser.name || '';
            document.getElementById('user-profile-email').value = currentUser.email || '';
            document.getElementById('user-profile-phone').value = currentUser.phone || '';
            document.getElementById('user-profile-address').value = currentUser.address || '';
        }

        async function saveUserProfile() {
            if (!currentUser) return;

            const profile = {
                name: document.getElementById('user-profile-name').value.trim(),
                email: document.getElementById('user-profile-email').value.trim(),
                phone: document.getElementById('user-profile-phone').value.trim(),
                address: document.getElementById('user-profile-address').value.trim()
            };

            if (apiAvailable && getCustomerToken()) {
                try {
                    const response = await RestaurantAPI.updateCurrentUser(getCustomerToken(), profile);
                    currentUser = response.user;
                    localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(currentUser));
                    localStorage.setItem('currentUser', currentUser.username);
                    fillUserProfile();
                    alert('Profil berhasil diperbarui');
                } catch (error) {
                    console.error('Gagal memperbarui profil:', error);
                    alert(error.payload?.error || 'Profil gagal diperbarui');
                }
                return;
            }

            currentUser = {
                ...currentUser,
                ...profile
            };

            USER_CREDENTIALS = USER_CREDENTIALS.map(user => user.username === currentUser.username ? currentUser : user);
            writeArrayToStorage(USERS_STORAGE_KEY, USER_CREDENTIALS);
            alert('Profil berhasil diperbarui');
        }

        function loadNewOrderData() {
            loadOrderTableOptions();
            loadAvailableMenu();
            renderCurrentOrder();
        }

        function loadOrderTableOptions() {
            const select = document.getElementById('order-table');
            if (!select) return;

            const selectedValue = select.value;
            const tables = getTablesWithLiveStatus();
            select.innerHTML = '<option value="">Pilih Meja</option>';

            tables.forEach(table => {
                const option = document.createElement('option');
                option.value = table.number;
                option.textContent = `Meja ${table.number}${table.status === 'occupied' ? ' - terisi' : ''}`;
                option.disabled = table.status === 'occupied';
                select.appendChild(option);
            });

            select.value = selectedValue;
        }

        function addToCurrentOrder(encodedId) {
            const itemId = decodeKey(encodedId);
            const item = getMenuItems().find(menuItem => String(menuItem.id || menuItem.name) === itemId);
            const quantityInput = document.getElementById(`order-qty-${encodedId}`);
            const quantity = parseInt(quantityInput ? quantityInput.value : '1', 10);

            if (!item || Number.isNaN(quantity) || quantity < 1) {
                return;
            }

            const existingItem = currentOrderItems.find(orderItem => String(orderItem.id || orderItem.name) === itemId);

            if (existingItem) {
                existingItem.quantity += quantity;
            } else {
                currentOrderItems.push({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    quantity
                });
            }

            renderCurrentOrder();
        }

        function renderCurrentOrder() {
            const container = document.getElementById('current-order-items');
            const totalElement = document.getElementById('order-total-amount');
            if (!container || !totalElement) return;

            container.innerHTML = '';

            if (currentOrderItems.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Belum ada item pesanan</p>';
                totalElement.textContent = 'Total: Rp0';
                return;
            }

            currentOrderItems.forEach(item => {
                const key = encodeKey(item.id || item.name);
                const itemElement = document.createElement('div');
                itemElement.className = 'order-item';
                itemElement.innerHTML = `
                    <span>${escapeHTML(item.name)} (${Number(item.quantity)}x)</span>
                    <span>${escapeHTML(formatCurrency(item.price * item.quantity))} <button class="action-btn" onclick="removeCurrentOrderItem('${key}')">Hapus</button></span>
                `;
                container.appendChild(itemElement);
            });

            const total = currentOrderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
            totalElement.textContent = `Total: ${formatCurrency(total)}`;
        }

        function removeCurrentOrderItem(encodedId) {
            const itemId = decodeKey(encodedId);
            currentOrderItems = currentOrderItems.filter(item => String(item.id || item.name) !== itemId);
            renderCurrentOrder();
        }

        function clearOrder() {
            currentOrderItems = [];
            renderCurrentOrder();
        }

        function submitOrder() {
            const tableNumber = document.getElementById('order-table').value;

            if (!tableNumber) {
                alert('Silakan pilih meja');
                return;
            }

            if (currentOrderItems.length === 0) {
                alert('Silakan tambahkan item pesanan');
                return;
            }

            const total = currentOrderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const orderId = `${getLocalDateKey().replace(/-/g, '').slice(2)}${Math.floor(1000 + Math.random() * 9000)}`;
            const order = {
                id: orderId,
                orderNumber: orderId,
                customerName: currentUser ? currentUser.name : 'Pelanggan',
                tableNumber,
                items: currentOrderItems.map(item => ({
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    subtotal: item.price * item.quantity
                })),
                total,
                status: 'pending',
                paymentMethod: 'cash',
                timestamp: new Date().toISOString()
            };

            saveOrders([...getOrders(), order]);
            clearOrder();
            refreshOrderViews(true);
            alert('Pesanan berhasil dibuat');
        }

        function generateDailyReport() {
            const today = getLocalDateKey();
            const startInput = document.getElementById('report-start-date');
            const endInput = document.getElementById('report-end-date');

            if (startInput) startInput.value = today;
            if (endInput) endInput.value = today;
            generateCustomReport();
        }

        function generateMonthlyReport() {
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            document.getElementById('report-start-date').value = getLocalDateKey(firstDay);
            document.getElementById('report-end-date').value = getLocalDateKey(lastDay);
            generateCustomReport();
        }

        function getItemSalesStats(orders) {
            const itemStats = new Map();

            orders.forEach(order => {
                (order.items || []).forEach(item => {
                    const name = item.name || 'Menu tanpa nama';
                    const quantity = Number(item.quantity || 0);
                    const revenue = Number(item.subtotal || (Number(item.price || 0) * quantity));
                    const current = itemStats.get(name) || { name, quantity: 0, revenue: 0 };

                    current.quantity += quantity;
                    current.revenue += revenue;
                    itemStats.set(name, current);
                });
            });

            return Array.from(itemStats.values()).sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);
        }

        function renderBestSellerPieChart(itemStats) {
            if (itemStats.length === 0) {
                return '<p class="no-data-message" style="padding: 1rem;">Belum ada item terjual pada periode ini.</p>';
            }

            const palette = ['#212529', '#6c757d', '#adb5bd', '#f45656', '#ced4da', '#343a40'];
            const primaryItems = itemStats.slice(0, 5);
            const otherItems = itemStats.slice(5);
            const otherQuantity = otherItems.reduce((sum, item) => sum + item.quantity, 0);
            const otherRevenue = otherItems.reduce((sum, item) => sum + item.revenue, 0);
            const chartItems = otherQuantity > 0
                ? [...primaryItems, { name: 'Lainnya', quantity: otherQuantity, revenue: otherRevenue }]
                : primaryItems;
            const totalQuantity = chartItems.reduce((sum, item) => sum + item.quantity, 0);

            if (totalQuantity === 0) {
                return '<p class="no-data-message" style="padding: 1rem;">Belum ada item terjual pada periode ini.</p>';
            }

            let cursor = 0;
            const segments = chartItems.map((item, index) => {
                const start = cursor;
                const slice = (item.quantity / totalQuantity) * 100;
                const end = index === chartItems.length - 1 ? 100 : cursor + slice;
                cursor = end;
                return `${palette[index % palette.length]} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
            }).join(', ');
            const topShare = Math.round((chartItems[0].quantity / totalQuantity) * 100);

            return `
                <div class="best-seller-visual">
                    <div class="best-seller-pie" style="--pie-gradient: conic-gradient(${segments});">
                        <div class="best-seller-pie-label">
                            <strong>${topShare}%</strong>
                            <span>Top Share</span>
                        </div>
                    </div>
                    <div class="best-seller-legend">
                        ${chartItems.map((item, index) => {
                            const percentage = Math.round((item.quantity / totalQuantity) * 100);
                            const color = palette[index % palette.length];
                            return `
                                <div class="legend-item">
                                    <i class="legend-swatch" style="--swatch: ${color}"></i>
                                    <strong>${escapeHTML(item.name)}</strong>
                                    <span>${percentage}% · ${item.quantity} item · ${formatCurrency(item.revenue)}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        async function generateCustomReport() {
            const startDate = document.getElementById('report-start-date').value;
            const endDate = document.getElementById('report-end-date').value;
            const reportResults = document.getElementById('report-results');

            if (!startDate || !endDate) {
                alert('Silakan pilih tanggal laporan');
                return;
            }

            if (apiAvailable && getAdminToken()) {
                try {
                    apiOrdersCache = await fetchApiOrders();
                } catch (error) {
                    console.error('Gagal memuat pesanan laporan dari API:', error);
                }
            }

            const filteredOrders = getOrders().filter(order => {
                const orderDate = getLocalDateKey(order.timestamp);
                return orderDate >= startDate && orderDate <= endDate && order.status !== 'cancelled';
            });
            const totalRevenue = filteredOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
            const completedOrders = filteredOrders.filter(order => order.status === 'completed').length;
            const pendingOrders = filteredOrders.filter(isActiveOrder).length;
            let itemStats = getItemSalesStats(filteredOrders);

            if (apiAvailable && getAdminToken()) {
                try {
                    const response = await RestaurantAPI.getBestSeller(getAdminToken(), startDate, endDate);
                    itemStats = (response.items || []).map(item => ({
                        name: item.name || 'Menu tanpa nama',
                        quantity: Number(item.quantity || 0),
                        revenue: Number(item.revenue || 0)
                    }));
                } catch (error) {
                    console.error('Gagal memuat Best Seller dari API:', error);
                }
            }

            const bestItem = itemStats[0];

            if (filteredOrders.length === 0) {
                reportResults.innerHTML = '<div class="card"><p>Tidak ada data pesanan untuk periode ini.</p></div>';
                return;
            }

            reportResults.innerHTML = `
                <div class="report-grid">
                    <div class="report-summary">
                        <h3 style="margin-bottom: 1rem;">Ringkasan Laporan</h3>
                        <div class="report-metric">
                            <span>Total Pesanan</span>
                            <strong>${filteredOrders.length}</strong>
                        </div>
                        <div class="report-metric">
                            <span>Total Pendapatan</span>
                            <strong>${formatCurrency(totalRevenue)}</strong>
                        </div>
                        <div class="report-metric">
                            <span>Status</span>
                            <strong>${completedOrders} selesai</strong>
                            <p style="color: var(--text-muted); margin-top: 4px;">${pendingOrders} pesanan aktif</p>
                        </div>
                    </div>
                    <div class="report-chart-card">
                        <h3 style="margin-bottom: 0.4rem;">Best Seller</h3>
                        <p style="color: var(--text-muted);">Berdasarkan jumlah item terjual pada periode laporan. ${bestItem ? `Tertinggi: ${escapeHTML(bestItem.name)}.` : ''}</p>
                        ${renderBestSellerPieChart(itemStats)}
                    </div>
                </div>
            `;
        }

        function fillSettingsForm(settings = {}) {
            const fields = {
                'restaurant-name': settings.name || '',
                'restaurant-address': settings.address || '',
                'restaurant-phone': settings.phone || '',
                'restaurant-hours': settings.hours || ''
            };

            Object.entries(fields).forEach(([id, value]) => {
                const element = document.getElementById(id);
                if (element) element.value = value;
            });
        }

        async function loadSettings() {
            if (apiAvailable) {
                try {
                    const response = await RestaurantAPI.getSettings();
                    fillSettingsForm(response.settings || {});
                    return;
                } catch (error) {
                    console.error('Gagal memuat pengaturan dari API:', error);
                }
            }

            try {
                fillSettingsForm(JSON.parse(localStorage.getItem('restaurantSettings') || '{}'));
            } catch (error) {
                fillSettingsForm({});
            }
        }

        async function saveSettings() {
            const settings = {
                name: document.getElementById('restaurant-name').value.trim(),
                address: document.getElementById('restaurant-address').value.trim(),
                phone: document.getElementById('restaurant-phone').value.trim(),
                hours: document.getElementById('restaurant-hours').value.trim()
            };

            if (apiAvailable && getAdminToken()) {
                try {
                    const response = await RestaurantAPI.updateSettings(getAdminToken(), settings);
                    fillSettingsForm(response.settings || settings);
                    alert('Pengaturan berhasil disimpan');
                } catch (error) {
                    console.error('Gagal menyimpan pengaturan:', error);
                    alert(error.payload?.error || 'Pengaturan gagal disimpan');
                }
                return;
            }

            localStorage.setItem('restaurantSettings', JSON.stringify(settings));
            alert('Pengaturan berhasil disimpan');
        }

        function resetSettings() {
            fillSettingsForm({});
        }

        function closeModal(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) modal.style.display = 'none';
        }

        document.addEventListener('DOMContentLoaded', async function () {
            showPanel('login-page');
            apiAvailable = await RestaurantAPI.isAvailable();
            ensureDefaultData();
            setupNavigation();
            startRealtimeOrdersSync();

            if (localStorage.getItem('adminLoggedIn') === 'true') {
                localStorage.removeItem('userLoggedIn');
                localStorage.removeItem('currentUser');
                currentUser = null;
                showPanel('admin-panel');
                await initializeAdminPanel();
                return;
            }

            if (localStorage.getItem('userLoggedIn') === 'true') {
                const username = localStorage.getItem('currentUser');
                const rawSession = localStorage.getItem(CUSTOMER_SESSION_KEY);

                try {
                    currentUser = rawSession ? JSON.parse(rawSession) : null;
                } catch (error) {
                    currentUser = null;
                }

                if (!currentUser) {
                    currentUser = USER_CREDENTIALS.find(user => user.username === username) || null;
                }

                if (currentUser) {
                    showPanel('user-panel');
                    await initializeUserPanel();
                    return;
                }

                localStorage.removeItem('userLoggedIn');
                localStorage.removeItem('currentUser');
            }

            showPanel('login-page');
        });
