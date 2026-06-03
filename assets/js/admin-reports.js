// Admin reporting flows

        function setDefaultReportDates() {
            const startInput = document.getElementById('report-start-date');
            const endInput = document.getElementById('report-end-date');
            const today = getLocalDateKey();

            if (startInput && !startInput.value) startInput.value = today;
            if (endInput && !endInput.value) endInput.value = today;
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
                                    <span>${percentage}% &middot; ${item.quantity} item &middot; ${formatCurrency(item.revenue)}</span>
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
