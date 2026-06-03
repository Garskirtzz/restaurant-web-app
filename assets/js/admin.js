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

        function showLoginError(errorElement, message) {
            if (!errorElement) return;

            if (message) {
                errorElement.textContent = message;
            }
            errorElement.style.display = 'block';
        }

        function clearStoredAuthState() {
            localStorage.removeItem('adminLoggedIn');
            localStorage.removeItem('userLoggedIn');
            localStorage.removeItem('currentUser');
            localStorage.removeItem(ADMIN_AUTH_TOKEN_KEY);
            localStorage.removeItem(CUSTOMER_AUTH_TOKEN_KEY);
            localStorage.removeItem(CUSTOMER_SESSION_KEY);
            currentUser = null;
        }

        async function adminLogin() {
            const username = document.getElementById('admin-username').value;
            const password = document.getElementById('admin-password').value;
            const errorElement = document.getElementById('admin-login-error');

            if (!apiAvailable) {
                showLoginError(errorElement, 'Server API tidak tersedia. Jalankan server lokal terlebih dahulu.');
                return;
            }

            try {
                const response = await RestaurantAPI.adminLogin({ username, password });
                localStorage.setItem(ADMIN_AUTH_TOKEN_KEY, response.token);
            } catch (error) {
                showLoginError(errorElement, 'Username atau password admin salah!');
                return;
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

            if (!apiAvailable) {
                showLoginError(errorElement, 'Server API tidak tersedia. Jalankan server lokal terlebih dahulu.');
                return;
            }

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
                showLoginError(errorElement, 'Username atau password salah!');
                return;
            }
        }

        function logout() {
            if (!confirm('Apakah Anda yakin ingin logout?')) {
                return;
            }

            clearStoredAuthState();
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

        async function initializeUserPanel() {
            ensureDefaultData();
            await refreshCurrentUserProfile();
            fillUserProfile();
            loadUserOrders();
            loadNewOrderData();
            activatePage('#user-panel', 'user-dashboard-page');
            startRealtimeOrdersSync();
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
                const token = getAdminToken();

                if (apiAvailable && token) {
                    try {
                        const response = await RestaurantAPI.getCurrentUser(token);
                        if (response.user?.role === 'admin') {
                            localStorage.removeItem('userLoggedIn');
                            localStorage.removeItem('currentUser');
                            currentUser = null;
                            showPanel('admin-panel');
                            await initializeAdminPanel();
                            return;
                        }
                    } catch (error) {
                        console.error('Session admin tidak valid:', error);
                    }
                }

                clearStoredAuthState();
            }

            if (localStorage.getItem('userLoggedIn') === 'true') {
                const rawSession = localStorage.getItem(CUSTOMER_SESSION_KEY);
                const token = getCustomerToken();

                try {
                    currentUser = rawSession ? JSON.parse(rawSession) : null;
                } catch (error) {
                    currentUser = null;
                }

                if (apiAvailable && token) {
                    try {
                        const response = await RestaurantAPI.getCurrentUser(token);
                        if (response.user?.role === 'customer') {
                            currentUser = response.user;
                            localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(currentUser));
                            localStorage.setItem('currentUser', currentUser.username);
                            showPanel('user-panel');
                            await initializeUserPanel();
                            return;
                        }
                    } catch (error) {
                        console.error('Session customer tidak valid:', error);
                    }
                }

                clearStoredAuthState();
            }

            showPanel('login-page');
        });
