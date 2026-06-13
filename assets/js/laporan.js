// Owner report site: tabbed (Harian/Bulanan) animated charts comparing both brands.

        const ADMIN_TOKEN_KEY = 'restaurantAdminToken';
        const escapeHTML = window.RestaurantUtils.escapeHTML;
        const COLORS = { kentjana: '#212529', balap: '#f45656' };

        const STATE = { tab: 'harian', harian: [], bulanan: [] };

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

        // Merge per-brand revenue rows into [{ period, label, kentjana, balap }].
        function mergeSeries(kentjanaRows, balapRows, type) {
            const map = new Map();
            const add = (rows, key) => (rows || []).forEach(row => {
                if (!map.has(row.period)) {
                    map.set(row.period, { period: row.period, kentjana: 0, balap: 0 });
                }
                map.get(row.period)[key] = Number(row.revenue || 0);
            });
            add(kentjanaRows, 'kentjana');
            add(balapRows, 'balap');

            const sorted = Array.from(map.values()).sort((a, b) => (a.period < b.period ? -1 : 1));
            const recent = sorted.slice(type === 'harian' ? -8 : -6);
            recent.forEach(d => {
                d.label = type === 'harian'
                    ? `${d.period.slice(8, 10)}/${d.period.slice(5, 7)}`
                    : d.period;
            });
            return recent;
        }

        function renderChart(series) {
            if (!series.length) {
                return '<p class="report-empty">Belum ada data untuk periode ini.</p>';
            }

            const maxValue = Math.max(1, ...series.flatMap(d => [d.kentjana, d.balap]));
            const maxHeight = 190;
            const bar = (value, brand, delay) => {
                const height = value > 0 ? Math.max(4, Math.round((value / maxValue) * maxHeight)) : 0;
                return `<div class="bar bar-${brand}" style="height: ${height}px; animation-delay: ${delay}ms"></div>`;
            };

            const columns = series.map((d, i) => `
                <div class="chart-col">
                    <div class="chart-bars">
                        ${bar(d.kentjana, 'kentjana', i * 70)}
                        ${bar(d.balap, 'balap', i * 70 + 90)}
                    </div>
                    <div class="chart-xlabel">${escapeHTML(d.label)}</div>
                </div>
            `).join('');

            const kentjanaTotal = series.reduce((s, d) => s + d.kentjana, 0);
            const balapTotal = series.reduce((s, d) => s + d.balap, 0);

            return `
                <div class="chart-legend">
                    <span><i class="legend-dot" style="background: ${COLORS.kentjana}"></i> Warkop Kentjana — <strong>${formatRupiah(kentjanaTotal)}</strong></span>
                    <span><i class="legend-dot" style="background: ${COLORS.balap}"></i> Warkop Balap — <strong>${formatRupiah(balapTotal)}</strong></span>
                </div>
                <div class="chart">${columns}</div>
            `;
        }

        function renderTable(series, periodLabel) {
            if (!series.length) {
                return '';
            }
            const rows = series.slice().reverse().map(d => `
                <tr>
                    <td>${escapeHTML(d.label)}</td>
                    <td>${formatRupiah(d.kentjana)}</td>
                    <td>${formatRupiah(d.balap)}</td>
                </tr>
            `).join('');
            const kentjanaTotal = series.reduce((s, d) => s + d.kentjana, 0);
            const balapTotal = series.reduce((s, d) => s + d.balap, 0);

            return `
                <div class="report-table-wrap">
                    <table class="report-table">
                        <thead>
                            <tr><th>${periodLabel}</th><th>Warkop Kentjana</th><th>Warkop Balap</th></tr>
                        </thead>
                        <tbody>${rows}</tbody>
                        <tfoot>
                            <tr><td>Total</td><td>${formatRupiah(kentjanaTotal)}</td><td>${formatRupiah(balapTotal)}</td></tr>
                        </tfoot>
                    </table>
                </div>
            `;
        }

        function renderActiveTab() {
            document.querySelectorAll('.report-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.tab === STATE.tab);
            });

            const series = STATE.tab === 'harian' ? STATE.harian : STATE.bulanan;
            const title = STATE.tab === 'harian' ? 'Penghasilan Harian' : 'Penghasilan Bulanan';
            const periodLabel = STATE.tab === 'harian' ? 'Tanggal' : 'Bulan';

            document.getElementById('report-content').innerHTML = `
                <div class="chart-card">
                    <h3>${title}</h3>
                    ${renderChart(series)}
                </div>
                ${renderTable(series, periodLabel)}
            `;
        }

        async function loadReport() {
            const content = document.getElementById('report-content');
            content.innerHTML = '<p class="report-empty">Memuat laporan…</p>';
            const token = getToken();

            try {
                const [kentjanaDay, kentjanaMonth, balapDay, balapMonth] = await Promise.all([
                    RestaurantAPI.getRevenue(token, '', '', 'day', 'kentjana'),
                    RestaurantAPI.getRevenue(token, '', '', 'month', 'kentjana'),
                    RestaurantAPI.getRevenue(token, '', '', 'day', 'balap'),
                    RestaurantAPI.getRevenue(token, '', '', 'month', 'balap')
                ]);
                STATE.harian = mergeSeries(kentjanaDay.rows, balapDay.rows, 'harian');
                STATE.bulanan = mergeSeries(kentjanaMonth.rows, balapMonth.rows, 'bulanan');
                renderActiveTab();
            } catch (error) {
                if (error.status === 401) {
                    localStorage.removeItem(ADMIN_TOKEN_KEY);
                    showLogin();
                    return;
                }
                content.innerHTML = '<p class="report-empty">Gagal memuat laporan. Coba muat ulang.</p>';
            }
        }

        function selectTab(element) {
            STATE.tab = element.dataset.tab === 'bulanan' ? 'bulanan' : 'harian';
            renderActiveTab();
        }

        document.addEventListener('DOMContentLoaded', async function () {
            window.RestaurantUtils.delegateActions(document, {
                login: () => login(),
                logout: () => logout(),
                refresh: () => loadReport(),
                tab: (element) => selectTab(element)
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
