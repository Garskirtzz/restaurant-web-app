// Data state
        const CART_STORAGE_KEY = 'restaurantCart';
        const CUSTOMER_AUTH_TOKEN_KEY = 'restaurantCustomerToken';
        const CUSTOMER_SESSION_KEY = 'restaurantCustomerSession';
        const ADMIN_AUTH_TOKEN_KEY = 'restaurantAdminToken';
        let cart = [];
        let customerInfo = {
            name: '',
            tableNumber: ''
        };
        let orderNumber = null;
        let pendingCustomerAuthAction = null;
        let apiAvailable = false;
        const formatCurrency = window.RestaurantUtils.formatNumber;
        const escapeHtml = window.RestaurantUtils.escapeHTML;

        // DOM Elements
        const cartPreview = document.getElementById('cart-preview');
        const cartItemsContainer = document.getElementById('cart-items-container');
        const cartCountElement = document.getElementById('cart-count');
        const cartTotalElement = document.getElementById('cart-total');
        const cartBadgeElement = document.getElementById('cart-badge');
        const cartPreviewTotalElement = document.getElementById('cart-preview-total');
        const successOrderNumber = document.getElementById('success-order-number');
        const successOrderTotal = document.getElementById('success-order-total');
        const orderHistoryList = document.getElementById('order-history-list');
        const authNavLabel = document.getElementById('auth-nav-label');
        const signOutButton = document.getElementById('sign-out-btn');
        const toastElement = document.getElementById('toast');

        // Initialize
        document.addEventListener('DOMContentLoaded', async function () {
            apiAvailable = await RestaurantAPI.isAvailable();
            await hydrateCustomerSession();
            loadCartFromStorage();
            updateCartUI();
            loadCheckoutTablesFromApi();
            renderOrderHistory();
        });

        // Helper functions
        function generateOrderNumber() {
            const now = new Date();
            const datePart = now.getFullYear().toString().substr(-2) +
                (now.getMonth() + 1).toString().padStart(2, '0') +
                now.getDate().toString().padStart(2, '0');
            const randomPart = Math.floor(1000 + Math.random() * 9000);
            return datePart + randomPart;
        }

        function formatOrderDate(timestamp) {
            if (!timestamp) {
                return '-';
            }

            try {
                return new Intl.DateTimeFormat('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                }).format(new Date(timestamp));
            } catch (error) {
                return '-';
            }
        }

        function showToast(message) {
            toastElement.textContent = message;
            toastElement.classList.add('show');
            setTimeout(() => {
                toastElement.classList.remove('show');
            }, 3000);
        }

        function setCustomerSession(user, token = '') {
            localStorage.setItem('userLoggedIn', 'true');
            localStorage.removeItem('adminLoggedIn');
            localStorage.setItem('currentUser', user.username);
            localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(user));
            localStorage.setItem(CUSTOMER_AUTH_TOKEN_KEY, token);
        }

        function clearCustomerSession() {
            localStorage.removeItem('userLoggedIn');
            localStorage.removeItem('currentUser');
            localStorage.removeItem(CUSTOMER_AUTH_TOKEN_KEY);
            localStorage.removeItem(CUSTOMER_SESSION_KEY);
        }

        function getStoredCustomerSession() {
            const rawSession = localStorage.getItem(CUSTOMER_SESSION_KEY);

            if (!rawSession) {
                return null;
            }

            try {
                return JSON.parse(rawSession);
            } catch (error) {
                return null;
            }
        }

        function getCustomerToken() {
            return localStorage.getItem(CUSTOMER_AUTH_TOKEN_KEY) || '';
        }

        function getSignedInCustomer() {
            if (localStorage.getItem('userLoggedIn') !== 'true' || !getCustomerToken()) {
                return null;
            }

            const storedSession = getStoredCustomerSession();
            if (storedSession) {
                return storedSession;
            }

            return null;
        }

        function isCustomerSignedIn() {
            return Boolean(getSignedInCustomer());
        }

        async function hydrateCustomerSession() {
            let customer = getSignedInCustomer();

            if (customer && apiAvailable) {
                try {
                    const response = await RestaurantAPI.getCurrentUser(getCustomerToken());
                    customer = response.user;
                    localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(customer));
                    localStorage.setItem('currentUser', customer.username);
                } catch (error) {
                    clearCustomerSession();
                    customer = null;
                }
            } else if (localStorage.getItem('userLoggedIn') === 'true' && !customer) {
                clearCustomerSession();
            }

            document.body.classList.toggle('customer-signed-in', Boolean(customer));

            if (authNavLabel) {
                authNavLabel.textContent = customer ? (customer.name || customer.username) : 'Sign In';
            }

            if (signOutButton) {
                signOutButton.hidden = !customer;
            }

            if (customer) {
                customerInfo.name = customer.name || customer.username;
            } else {
                customerInfo.name = '';
                customerInfo.tableNumber = '';
            }
        }

        async function customerSignOut() {
            const token = getCustomerToken();

            if (apiAvailable && token) {
                try {
                    await RestaurantAPI.logout(token);
                } catch (error) {
                    console.error('Gagal logout dari server:', error);
                }
            }

            cart = [];
            saveCartToStorage();
            clearCustomerSession();
            await hydrateCustomerSession();
            updateCartUI();
            renderOrderHistory();
            showToast('Signed out.');
        }

        function requireCustomerSignIn(message, afterSignIn) {
            if (isCustomerSignedIn()) {
                return true;
            }

            pendingCustomerAuthAction = typeof afterSignIn === 'function' ? afterSignIn : null;
            switchAuthTab('customer');
            toggleCustomerCreateMode(false);
            openModal('auth-modal');
            showToast(message || 'Please sign in first.');
            return false;
        }

        function runPendingCustomerAuthAction() {
            const action = pendingCustomerAuthAction;
            pendingCustomerAuthAction = null;

            if (typeof action === 'function') {
                window.setTimeout(action, 0);
            }
        }

        function getCustomerCartStorageKey() {
            const customer = getSignedInCustomer();
            return customer ? `${CART_STORAGE_KEY}:${customer.username}` : null;
        }

        function normalizeApiOrder(order) {
            return {
                id: order.id || order.order_number || order.orderNumber,
                orderNumber: order.order_number || order.orderNumber || order.id,
                customerName: order.customer_name || order.customerName || '-',
                customerUsername: order.customer_username || order.customerUsername || '',
                customerAccountName: order.customer_account_name || order.customerAccountName || '',
                tableNumber: order.table_number || order.tableNumber || '',
                items: Array.isArray(order.items) ? order.items : [],
                total: Number(order.total || 0),
                status: order.status || 'pending',
                paymentMethod: order.payment_method || order.paymentMethod || 'cash',
                timestamp: order.timestamp
            };
        }

        // Cart functions
        function addToCart(name, price, buttonElement) {
            const card = buttonElement.closest('.card');
            const quantityElement = card.querySelector('.quantity-value');
            let quantity = parseInt(quantityElement.textContent);

            if (quantity < 1) {
                showToast('Silakan tentukan jumlah terlebih dahulu');
                return;
            }

            if (!requireCustomerSignIn('Silakan sign in terlebih dahulu untuk menambahkan menu.', function () {
                addToCart(name, price, buttonElement);
            })) {
                return;
            }

            const existingItemIndex = cart.findIndex(item => item.name === name);

            if (existingItemIndex !== -1) {
                cart[existingItemIndex].quantity += quantity;
            } else {
                cart.push({
                    name,
                    price,
                    quantity
                });
            }

            quantityElement.textContent = '0';
            saveCartToStorage();
            updateCartUI();
            showToast(`${quantity} ${name} ditambahkan ke keranjang`);
        }

        function updateCartItemQuantity(name, newQuantity) {
            const itemIndex = cart.findIndex(item => item.name === name);

            if (itemIndex !== -1) {
                if (newQuantity <= 0) {
                    cart.splice(itemIndex, 1);
                } else {
                    cart[itemIndex].quantity = newQuantity;
                }

                saveCartToStorage();
                updateCartUI();
            }
        }

        function removeCartItem(name) {
            cart = cart.filter(item => item.name !== name);
            saveCartToStorage();
            updateCartUI();
            showToast('Item dihapus dari keranjang');
        }

        function clearCart() {
            cart = [];
            saveCartToStorage();
            updateCartUI();
            closeModal('clear-cart-modal');
            showToast('Keranjang dikosongkan');
        }

        function calculateCartTotal() {
            return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
        }

        function saveCartToStorage() {
            const storageKey = getCustomerCartStorageKey();

            if (!storageKey) {
                return;
            }

            localStorage.setItem(storageKey, JSON.stringify(cart));
        }

        function loadCartFromStorage() {
            const storageKey = getCustomerCartStorageKey();

            if (!storageKey) {
                cart = [];
                return;
            }

            const savedCart = localStorage.getItem(storageKey);

            if (savedCart) {
                try {
                    const parsedCart = JSON.parse(savedCart);
                    cart = Array.isArray(parsedCart) ? parsedCart : [];
                } catch (error) {
                    console.error('Gagal membaca keranjang:', error);
                    cart = [];
                }
            } else {
                cart = [];
            }
        }

        async function saveOrder(order) {
            const token = getCustomerToken();

            if (apiAvailable && token) {
                const response = await RestaurantAPI.createOrder(token, {
                    customerName: order.customerName,
                    tableNumber: order.tableNumber,
                    paymentMethod: order.paymentMethod,
                    items: order.items
                });

                return normalizeApiOrder(response.order);
            }

            throw new Error('Server API tidak tersedia untuk menyimpan pesanan.');
        }

        async function loadCheckoutTablesFromApi() {
            if (!apiAvailable) {
                return;
            }

            const tableSelect = document.getElementById('table-number');
            if (!tableSelect) {
                return;
            }

            try {
                const response = await RestaurantAPI.getTables();
                const tables = response.tables || [];

                if (tables.length === 0) {
                    return;
                }

                tableSelect.innerHTML = '<option value="" disabled selected>Pilih nomor meja</option>';
                tables.forEach(table => {
                    const option = document.createElement('option');
                    option.value = table.number;
                    option.textContent = `Meja ${table.number}`;
                    tableSelect.appendChild(option);
                });
            } catch (error) {
                console.error('Gagal memuat data meja dari API:', error);
            }
        }

        async function loadCustomerOrders() {
            const customer = getSignedInCustomer();

            if (!customer) {
                return [];
            }

            const token = getCustomerToken();

            if (apiAvailable && token) {
                const response = await RestaurantAPI.getOrders(token);
                return (response.orders || []).map(normalizeApiOrder);
            }

            return [];
        }

        async function renderOrderHistory() {
            if (!orderHistoryList) {
                return;
            }

            const customer = getSignedInCustomer();

            if (!customer) {
                orderHistoryList.innerHTML = '<p class="empty-history">Please sign in to view your order history.</p>';
                return;
            }

            let orders = [];

            try {
                orders = (await loadCustomerOrders()).slice().reverse();
            } catch (error) {
                console.error('Gagal membaca riwayat pesanan:', error);
                orderHistoryList.innerHTML = '<p class="empty-history">Riwayat pesanan gagal dimuat.</p>';
                return;
            }

            if (orders.length === 0) {
                orderHistoryList.innerHTML = '<p class="empty-history">Belum ada riwayat pemesanan.</p>';
                return;
            }

            orderHistoryList.innerHTML = orders.map(order => {
                const orderId = escapeHtml(order.orderNumber || order.id || '-');
                const customerName = escapeHtml(order.customerName || '-');
                const tableNumber = escapeHtml(order.tableNumber || '-');
                const status = escapeHtml(order.status || 'pending');
                const statusText = status === 'completed' ? 'Selesai' : 'Diproses';
                const orderedItems = Array.isArray(order.items) ? order.items : [];
                const itemSummary = orderedItems.length > 0
                    ? orderedItems.map(item => `${Number(item.quantity || 0)}x ${escapeHtml(item.name || '-')}`).join(', ')
                    : '-';

                return `
                    <article class="history-order">
                        <div>
                            <div class="history-order-title">
                                <span>No. Pesanan: ${orderId}</span>
                                <span class="history-status">${statusText}</span>
                            </div>
                            <p class="history-meta">Nama: ${customerName} &middot; Meja: ${tableNumber} &middot; ${formatOrderDate(order.timestamp)}</p>
                            <p class="history-items">${itemSummary}</p>
                        </div>
                        <div class="history-total">Rp${formatCurrency(order.total)}</div>
                    </article>
                `;
            }).join('');
        }

        function updateCartUI() {
            // Update cart count and total
            const itemCount = cart.reduce((count, item) => count + item.quantity, 0);
            const total = calculateCartTotal();

            cartCountElement.textContent = itemCount;
            cartTotalElement.textContent = total.toLocaleString('id-ID');
            cartBadgeElement.textContent = itemCount;
            cartPreviewTotalElement.textContent = total.toLocaleString('id-ID');

            // Update cart items list
            if (cart.length === 0) {
                cartItemsContainer.innerHTML = '<div class="empty-cart">Keranjang kosong</div>';
                return;
            }

            cartItemsContainer.innerHTML = '';
            cart.forEach(item => {
                const itemTotal = item.price * item.quantity;
                const cartItemElement = document.createElement('div');
                cartItemElement.className = 'cart-item';
                cartItemElement.innerHTML = `
                    <div class="cart-item-info">
                        <div class="cart-item-name">${item.name}</div>
                        <div class="cart-item-price">Rp${item.price.toLocaleString('id-ID')} x ${item.quantity}</div>
                        <div class="cart-item-quantity">
                            <button class="quantity-btn" onclick="updateCartItemQuantity('${item.name}', ${item.quantity - 1})">-</button>
                            <span>${item.quantity}</span>
                            <button class="quantity-btn" onclick="updateCartItemQuantity('${item.name}', ${item.quantity + 1})">+</button>
                        </div>
                    </div>
                    <div class="cart-item-actions">
                        <div class="cart-item-total">Rp${itemTotal.toLocaleString('id-ID')}</div>
                        <button class="cart-item-remove" onclick="removeCartItem('${item.name}')">×</button>
                    </div>
                `;
                cartItemsContainer.appendChild(cartItemElement);
            });
        }

        // Modal functions
        function toggleCart() {
            const isOpen = cartPreview.classList.contains('show');

            if (!isOpen && !requireCustomerSignIn('Silakan sign in terlebih dahulu untuk membuka keranjang.', toggleCart)) {
                return;
            }

            cartPreview.classList.toggle('show');
            document.body.classList.toggle('cart-open', cartPreview.classList.contains('show'));
        }

        function openModal(modalId) {
            if (modalId === 'order-history-modal' && !requireCustomerSignIn('Silakan sign in terlebih dahulu untuk melihat order history.', openOrderHistory)) {
                return;
            }

            const modal = document.getElementById(modalId);

            if (!modal) {
                return;
            }

            if (modalId === 'order-history-modal') {
                renderOrderHistory();
            }

            modal.classList.add('is-open');
            modal.setAttribute('aria-hidden', 'false');
        }

        function openOrderHistory() {
            openModal('order-history-modal');
        }

        function closeModal(modalId) {
            const modal = document.getElementById(modalId);

            if (!modal) {
                return;
            }

            modal.classList.remove('is-open');
            modal.setAttribute('aria-hidden', 'true');
        }

        function showCheckoutModal() {
            if (!requireCustomerSignIn('Silakan sign in terlebih dahulu untuk checkout.', showCheckoutModal)) {
                return;
            }

            if (cart.length === 0) {
                showToast('Keranjang kosong, silakan tambahkan item terlebih dahulu');
                return;
            }

            const customer = getSignedInCustomer();
            document.getElementById('customer-name').value = customer ? (customer.name || customer.username) : customerInfo.name;
            document.getElementById('table-number').value = customerInfo.tableNumber;
            cartPreview.classList.remove('show');
            document.body.classList.remove('cart-open');
            openModal('checkout-modal');
        }

        function showClearCartModal() {
            if (cart.length === 0) {
                showToast('Keranjang sudah kosong');
                return;
            }
            openModal('clear-cart-modal');
        }

        function selectPaymentMethod(element) {
            const paymentMethods = document.querySelectorAll('.payment-method');
            paymentMethods.forEach(method => method.classList.remove('selected'));
            element.classList.add('selected');
            element.querySelector('input').checked = true;
        }

        function switchAuthTab(tabName) {
            const tabs = document.querySelectorAll('.auth-tab');
            const customerPanel = document.getElementById('customer-auth-panel');
            const adminPanel = document.getElementById('admin-auth-panel');
            const isAdmin = tabName === 'admin';

            tabs.forEach(tab => {
                tab.classList.toggle('active', tab.dataset.authTab === tabName);
            });

            if (customerPanel) customerPanel.hidden = isAdmin;
            if (adminPanel) adminPanel.hidden = !isAdmin;
        }

        function toggleCustomerCreateMode(showCreateForm) {
            const signInView = document.getElementById('customer-signin-view');
            const createView = document.getElementById('customer-create-view');

            if (signInView) signInView.hidden = showCreateForm;
            if (createView) createView.hidden = !showCreateForm;
        }

        function setAuthError(errorId, shouldShow, message = '') {
            const errorElement = document.getElementById(errorId);

            if (errorElement) {
                if (message) {
                    errorElement.textContent = message;
                }
                errorElement.hidden = !shouldShow;
            }
        }

        async function customerSignIn() {
            const username = document.getElementById('customer-login-username').value.trim();
            const password = document.getElementById('customer-login-password').value;
            let user = null;
            let token = '';

            if (!apiAvailable) {
                setAuthError('customer-auth-error', true, 'Server is unavailable. Please run the local API first.');
                return;
            }

            try {
                const response = await RestaurantAPI.customerLogin({ username, password });
                user = response.user;
                token = response.token;
            } catch (error) {
                setAuthError('customer-auth-error', true, 'Invalid username or password.');
                return;
            }

            if (!user) {
                setAuthError('customer-auth-error', true, 'Invalid username or password.');
                return;
            }

            setCustomerSession(user, token);
            await hydrateCustomerSession();
            loadCartFromStorage();
            updateCartUI();
            renderOrderHistory();
            setAuthError('customer-auth-error', false);
            closeModal('auth-modal');
            showToast(`Signed in as ${user.name || user.username}`);
            runPendingCustomerAuthAction();
        }

        async function createCustomerAccount() {
            const name = document.getElementById('customer-create-name').value.trim();
            const username = document.getElementById('customer-create-username').value.trim();
            const password = document.getElementById('customer-create-password').value;
            const isInvalid = !name || !username || !password;

            if (isInvalid) {
                setAuthError('customer-create-error', true, 'Complete all fields.');
                return;
            }

            if (!apiAvailable) {
                setAuthError('customer-create-error', true, 'Server is unavailable. Please run the local API first.');
                return;
            }

            try {
                await RestaurantAPI.customerRegister({ username, password, name });
            } catch (error) {
                setAuthError('customer-create-error', true, error.payload?.error || 'Username is already used.');
                return;
            }

            setAuthError('customer-create-error', false);
            toggleCustomerCreateMode(false);
            document.getElementById('customer-login-username').value = username;
            document.getElementById('customer-login-password').value = password;
            showToast('Account created. You can sign in now.');
        }

        async function adminSignInFromIndex() {
            const username = document.getElementById('index-admin-username').value.trim();
            const password = document.getElementById('index-admin-password').value;

            if (!apiAvailable) {
                setAuthError('admin-auth-error', true, 'Server is unavailable. Please run the local API first.');
                return;
            }

            try {
                const response = await RestaurantAPI.adminLogin({ username, password });
                localStorage.setItem(ADMIN_AUTH_TOKEN_KEY, response.token);
            } catch (error) {
                setAuthError('admin-auth-error', true, 'Invalid admin credentials.');
                return;
            }

            localStorage.setItem('adminLoggedIn', 'true');
            localStorage.removeItem('userLoggedIn');
            localStorage.removeItem('currentUser');
            localStorage.removeItem(CUSTOMER_AUTH_TOKEN_KEY);
            localStorage.removeItem(CUSTOMER_SESSION_KEY);
            setAuthError('admin-auth-error', false);
            window.location.href = 'admin.html';
        }

        // Payment processing
        async function processPayment() {
            const signedInCustomer = getSignedInCustomer();

            if (!signedInCustomer) {
                requireCustomerSignIn('Silakan sign in terlebih dahulu untuk menyelesaikan pesanan.', function () {
                    openModal('checkout-modal');
                });
                return;
            }

            if (cart.length === 0) {
                showToast('Keranjang kosong, silakan tambahkan item terlebih dahulu');
                return;
            }

            const customerName = document.getElementById('customer-name').value.trim() || signedInCustomer.name || signedInCustomer.username;
            const tableNumber = document.getElementById('table-number').value;

            if (!customerName || !tableNumber) {
                showToast('Silakan isi nama pelanggan dan nomor meja');
                return;
            }

            const selectedPayment = document.querySelector('input[name="payment"]:checked');

            if (!selectedPayment) {
                showToast('Silakan pilih metode pembayaran');
                return;
            }

            customerInfo.name = customerName;
            customerInfo.tableNumber = tableNumber;

            const total = calculateCartTotal();
            orderNumber = generateOrderNumber();
            const completedOrderNumber = orderNumber;
            const order = {
                id: completedOrderNumber,
                orderNumber: completedOrderNumber,
                customerName,
                customerUsername: signedInCustomer.username,
                customerAccountName: signedInCustomer.name || signedInCustomer.username,
                tableNumber,
                items: cart.map(item => ({
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    subtotal: item.price * item.quantity
                })),
                total,
                status: 'pending',
                paymentMethod: selectedPayment.value,
                timestamp: new Date().toISOString()
            };

            try {
                const savedOrder = await saveOrder(order);
                order.id = savedOrder.id;
                order.orderNumber = savedOrder.orderNumber;
                order.timestamp = savedOrder.timestamp || order.timestamp;
            } catch (error) {
                console.error('Gagal menyimpan pesanan:', error);
                showToast('Pesanan gagal disimpan. Silakan coba lagi.');
                return;
            }

            renderOrderHistory();

            successOrderNumber.textContent = order.orderNumber;
            successOrderTotal.textContent = total.toLocaleString('id-ID');

            closeModal('checkout-modal');
            openModal('success-modal');

            // Reset for new order
            cart = [];
            saveCartToStorage();
            updateCartUI();
            orderNumber = null;
        }

        // Menu functions
        function filterMenu(category, activeTab) {
            const cards = document.querySelectorAll('.card');
            const tabs = document.querySelectorAll('.category-tab');
            const menuSections = document.querySelectorAll('main section');

            tabs.forEach(tab => {
                const isActive = activeTab ? tab === activeTab : tab.dataset.category === category;
                tab.classList.toggle('active', isActive);
            });

            cards.forEach(card => {
                const shouldShow = category === 'all' || card.dataset.category === category;
                card.style.display = '';
                card.classList.toggle('is-hidden-by-filter', !shouldShow);
            });

            menuSections.forEach(section => {
                const sectionCards = Array.from(section.querySelectorAll('.card'));
                const hasVisibleCard = sectionCards.some(card => !card.classList.contains('is-hidden-by-filter'));
                section.classList.toggle('menu-section-hidden', !hasVisibleCard);
            });
        }

        function focusCard(card) {
            // Just for visual feedback, can be enhanced
            card.style.transform = 'scale(1.02)';
            setTimeout(() => {
                card.style.transform = '';
            }, 200);
        }

        function updateQuantityInCard(button, change) {
            const quantityElement = button.closest('.quantity-control').querySelector('.quantity-value');
            let quantity = parseInt(quantityElement.textContent) + change;
            quantity = Math.max(0, quantity);
            quantityElement.textContent = quantity;
        }

