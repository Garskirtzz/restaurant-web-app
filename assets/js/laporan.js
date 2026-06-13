// Owner report page: shows daily & monthly revenue for both brands.

        const ADMIN_TOKEN_KEY = 'restaurantAdminToken';
        const BRANDS = [
            { key: 'kentjana', name: 'Warkop Kentjana' },
            { key: 'balap', name: 'Warkop Balap' }
        ];
        const escapeHTML = window.RestaurantUtils.escapeHTML;

        function getToken() {
            return localStorage.getItem(ADMIN_TOKEN_KEY) || '';
        }

        function showLogin() {
            document.body.classList.remove('state-admin');
            document.body.classList.add('state-login');
            document.getElementById('login-page').style.display = 'flex';
            document.getElementById('report-page').style.display = 'none';
        }

        function showReport() {
            document.body.classList.remove('state-login');
            document.body.classList.add('state-admin');
            document.getElementById('login-page').style.display = 'none';
            document.getElementById('report-page').style.display = 'block';
        }

        function formatRupiah(value) {
            return 'Rp' + Number(value || 0).toLocaleString('id-ID');
        }

        async function login() {
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;
            const errorEl = document.getElementById('login-error');

            try {
                const response = await RestaurantAPI.adminLogin({ username, password });
                localStorage.setItem(ADMIN_TOKEN_KEY, response.token);
                errorEl.style.display = 'none';
                showReport();
                loadReport();
            } catch (error) {
                errorEl.style.display = 'block';
            }
        }

        async function logout() {
            const token = getToken();
            if (token) {
                try {
                    await RestaurantAPI.logout(token);
                } catch (error) {
                    /* ignore */
                }
            }
            localStorage.removeItem(ADMIN_TOKEN_KEY);
            showLogin();
        }

        function renderTable(rows, periodLabel) {
            if (!rows || rows.length === 0) {
                return '<p style="color: var(--text-muted); padding: 0.5rem 0;">Belum ada data.</p>';
            }

            const totalRevenue = rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
            const totalOrders = rows.reduce((sum, row) => sum + Number(row.orders || 0), 0);
            const body = rows.map(row => `
                <tr>
                    <td>${escapeHTML(row.period || '-')}</td>
                    <td>${Number(row.orders || 0)}</td>
                    <td style="text-align: right;">${formatRupiah(row.revenue)}</td>
                </tr>
            `).join('');

            return `
                <div class="table-container" style="margin-bottom: 1rem;">
                    <table>
                        <thead>
                            <tr><th>${periodLabel}</th><th>Pesanan</th><th style="text-align: right;">Penghasilan</th></tr>
                        </thead>
                        <tbody>${body}</tbody>
                        <tfoot>
                            <tr>
                                <td><strong>Total</strong></td>
                                <td><strong>${totalOrders}</strong></td>
                                <td style="text-align: right;"><strong>${formatRupiah(totalRevenue)}</strong></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            `;
        }

        function renderBrand(brand, dayReport, monthReport) {
            const todayKey = window.RestaurantUtils.getLocalDateKey();
            const monthKey = todayKey.slice(0, 7);
            const dayRows = dayReport.rows || [];
            const monthRows = monthReport.rows || [];
            const todayRow = dayRows.find(row => row.period === todayKey);
            const monthRow = monthRows.find(row => row.period === monthKey);

            return `
                <section style="margin-bottom: 2.5rem;">
                    <h2 style="margin-bottom: 1rem;">${escapeHTML(brand.name)}</h2>
                    <div class="dashboard-cards" style="margin-bottom: 1.2rem;">
                        <div class="card">
                            <div class="card-title">Penghasilan Hari Ini</div>
                            <div class="card-value">${formatRupiah(todayRow ? todayRow.revenue : 0)}</div>
                            <div class="card-info">${todayRow ? todayRow.orders : 0} pesanan &middot; ${escapeHTML(todayKey)}</div>
                        </div>
                        <div class="card">
                            <div class="card-title">Penghasilan Bulan Ini</div>
                            <div class="card-value">${formatRupiah(monthRow ? monthRow.revenue : 0)}</div>
                            <div class="card-info">${monthRow ? monthRow.orders : 0} pesanan &middot; ${escapeHTML(monthKey)}</div>
                        </div>
                    </div>
                    <h3 style="margin: 0.5rem 0 0.6rem;">Penghasilan per Hari</h3>
                    ${renderTable(dayRows, 'Tanggal')}
                    <h3 style="margin: 0.5rem 0 0.6rem;">Penghasilan per Bulan</h3>
                    ${renderTable(monthRows, 'Bulan')}
                </section>
            `;
        }

        async function loadReport() {
            const root = document.getElementById('report-root');
            root.innerHTML = '<p style="color: var(--text-muted);">Memuat laporan…</p>';
            const token = getToken();

            try {
                const sections = await Promise.all(BRANDS.map(async brand => {
                    const dayReport = await RestaurantAPI.getRevenue(token, '', '', 'day', brand.key);
                    const monthReport = await RestaurantAPI.getRevenue(token, '', '', 'month', brand.key);
                    return renderBrand(brand, dayReport, monthReport);
                }));
                root.innerHTML = sections.join('');
            } catch (error) {
                if (error.status === 401) {
                    localStorage.removeItem(ADMIN_TOKEN_KEY);
                    showLogin();
                    return;
                }
                root.innerHTML = '<p>Gagal memuat laporan. Coba muat ulang.</p>';
            }
        }

        document.addEventListener('DOMContentLoaded', async function () {
            window.RestaurantUtils.delegateActions(document, {
                login: () => login(),
                logout: () => logout(),
                refresh: () => loadReport()
            });

            const token = getToken();
            if (token) {
                try {
                    const me = await RestaurantAPI.getCurrentUser(token);
                    if (me.user && me.user.role === 'admin') {
                        showReport();
                        loadReport();
                        return;
                    }
                } catch (error) {
                    /* fall through to login */
                }
                localStorage.removeItem(ADMIN_TOKEN_KEY);
            }
            showLogin();
        });
