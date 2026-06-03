// Admin dashboard and order management flows

        function loadDashboardData(orders = getOrders()) {
            const today = getLocalDateKey();
            const todayOrders = orders.filter(order => getLocalDateKey(order.timestamp) === today && order.status !== 'cancelled');
            const incomingToday = todayOrders.filter(isIncomingOrder).length;
            const processingToday = todayOrders.filter(isProcessingOrder).length;
            const completedToday = todayOrders.filter(isCompletedOrder).length;
            const todayRevenue = todayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);

            document.getElementById('today-orders').textContent = todayOrders.length;
            document.getElementById('orders-change').textContent = `${incomingToday} masuk \u00b7 ${processingToday} diproses`;
            document.getElementById('today-revenue').textContent = formatCurrency(todayRevenue);
            document.getElementById('revenue-change').textContent = `${completedToday} pesanan selesai`;

            const itemCounts = {};
            todayOrders.flatMap(order => order.items || []).forEach(item => {
                itemCounts[item.name] = (itemCounts[item.name] || 0) + Number(item.quantity || 0);
            });

            const bestSeller = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0];
            document.getElementById('best-seller').textContent = bestSeller ? bestSeller[0] : 'Tidak ada data';
            document.getElementById('best-seller-count').textContent = bestSeller ? `${bestSeller[1]} item terjual` : 'Belum ada penjualan';

            const tables = getTablesWithLiveStatus();
            const occupiedTables = tables.filter(table => table.status === 'occupied').length;
            document.getElementById('available-tables').textContent = `${tables.length - occupiedTables}/${tables.length}`;
            document.getElementById('occupied-tables').textContent = `${occupiedTables} meja terisi`;

            renderDashboardOrderSections(orders);
        }


        function getDashboardOrderGroups(orders) {
            const sortedOrders = sortOrdersNewestFirst(orders).filter(order => order.status !== 'cancelled');

            return {
                incoming: sortedOrders.filter(isIncomingOrder),
                processing: sortedOrders.filter(isProcessingOrder),
                completed: sortedOrders.filter(isCompletedOrder)
            };
        }


        function setDashboardOrderStatus(status) {
            currentDashboardOrderStatus = status;
            clearOrderStatusNotification(status);
            renderDashboardOrderSections(getOrders());
        }


        function renderDashboardOrderSections(orders) {
            const groups = getDashboardOrderGroups(orders);
            const labels = {
                incoming: 'Pesanan Masuk',
                processing: 'Diproses',
                completed: 'Selesai'
            };
            const emptyMessages = {
                incoming: 'Belum ada pesanan masuk',
                processing: 'Tidak ada pesanan yang sedang diproses',
                completed: 'Belum ada pesanan selesai'
            };
            const selectedStatus = groups[currentDashboardOrderStatus] ? currentDashboardOrderStatus : 'incoming';
            const selectedOrders = groups[selectedStatus];

            document.getElementById('dashboard-order-panel-title').textContent = labels[selectedStatus];
            document.getElementById('dashboard-orders-visible-count').textContent = selectedOrders.length;

            document.querySelectorAll('.order-status-tab').forEach(tab => {
                const isActive = tab.dataset.orderStatus === selectedStatus;
                tab.classList.toggle('active', isActive);
                tab.setAttribute('aria-pressed', String(isActive));
                tab.setAttribute('title', `${labels[tab.dataset.orderStatus]}: ${groups[tab.dataset.orderStatus].length} pesanan`);
            });

            renderOrderNotificationBadges();
            renderDashboardOrderTable('#dashboard-orders-table tbody', selectedOrders, emptyMessages[selectedStatus]);
        }


        function renderDashboardOrderTable(selector, orders, emptyMessage) {
            const tbody = document.querySelector(selector);
            if (!tbody) return;

            tbody.innerHTML = '';

            if (orders.length === 0) {
                renderEmptyRow(tbody, 6, emptyMessage);
                return;
            }

            orders.forEach(order => {
                tbody.appendChild(createAdminOrderRow(order, false));
            });
        }


        function loadOrders() {
            const tbody = document.querySelector('#all-orders-table tbody');
            if (!tbody) return;

            tbody.innerHTML = '';
            const orders = sortOrdersNewestFirst(getOrders());

            if (orders.length === 0) {
                renderEmptyRow(tbody, 7, 'Belum ada pesanan');
                return;
            }

            orders.forEach(order => {
                tbody.appendChild(createAdminOrderRow(order, true));
            });
        }


        function createAdminOrderRow(order, includeDate) {
            const row = document.createElement('tr');
            const orderId = getOrderId(order);
            const encodedOrderId = encodeKey(orderId);
            const processButton = isIncomingOrder(order)
                ? `<button class="action-btn" title="Proses pesanan" onclick="processOrderFromTable('${encodedOrderId}')">Proses</button>`
                : '';
            const completeButton = isProcessingOrder(order)
                ? `<button class="action-btn" title="Selesaikan" onclick="completeOrderFromTable('${encodedOrderId}')">Selesai</button>`
                : '';

            row.innerHTML = `
                <td>#${escapeHTML(orderId)}</td>
                ${includeDate ? `<td>${escapeHTML(formatDate(order.timestamp))}</td>` : ''}
                <td>${escapeHTML(order.customerName || '-')}</td>
                <td>${escapeHTML(formatTableNumber(order.tableNumber))}</td>
                <td>${escapeHTML(formatCurrency(order.total))}</td>
                <td><span class="status ${escapeHTML(order.status || 'pending')}">${escapeHTML(getStatusText(order.status))}</span></td>
                <td>
                    <button class="action-btn" title="Lihat detail" onclick="showOrderDetailModal('${encodedOrderId}')">Detail</button>
                    ${processButton}
                    ${completeButton}
                </td>
            `;

            return row;
        }


        function showOrderDetailModal(encodedOrderId) {
            currentViewingOrderId = decodeKey(encodedOrderId);
            const order = getOrders().find(item => getOrderId(item) === currentViewingOrderId);

            if (!order) {
                alert('Pesanan tidak ditemukan');
                return;
            }

            document.getElementById('detail-order-id').textContent = '#' + getOrderId(order);
            document.getElementById('detail-customer-name').textContent = order.customerName || '-';
            document.getElementById('detail-table-number').textContent = formatTableNumber(order.tableNumber);
            document.getElementById('detail-order-date').textContent = formatDateTime(order.timestamp);
            document.getElementById('detail-order-status').textContent = getStatusText(order.status);
            document.getElementById('detail-payment-method').textContent = getPaymentMethodText(order.paymentMethod);
            document.getElementById('detail-order-total').textContent = formatCurrency(order.total);

            const itemsContainer = document.getElementById('order-items-container');
            itemsContainer.innerHTML = '';

            (order.items || []).forEach(item => {
                const itemElement = document.createElement('div');
                itemElement.style.display = 'flex';
                itemElement.style.justifyContent = 'space-between';
                itemElement.style.marginBottom = '0.5rem';
                itemElement.innerHTML = `
                    <span>${escapeHTML(item.name)} (${Number(item.quantity || 0)}x)</span>
                    <span>${escapeHTML(formatCurrency(Number(item.price || 0) * Number(item.quantity || 0)))}</span>
                `;
                itemsContainer.appendChild(itemElement);
            });

            document.getElementById('process-order-btn').style.display = isIncomingOrder(order) ? 'inline-block' : 'none';
            document.getElementById('complete-order-btn').style.display = isProcessingOrder(order) ? 'inline-block' : 'none';
            document.getElementById('order-detail-modal').style.display = 'flex';
        }


        async function processOrder() {
            if (!currentViewingOrderId) {
                return;
            }

            if (apiAvailable && getAdminToken()) {
                try {
                    await RestaurantAPI.updateOrderStatus(getAdminToken(), currentViewingOrderId, 'processing');
                    closeModal('order-detail-modal');
                    await refreshOrderViews(true);
                    alert('Pesanan dipindahkan ke proses');
                } catch (error) {
                    console.error('Gagal memproses pesanan:', error);
                    alert('Pesanan gagal diproses');
                }
                return;
            }

            const orders = getOrders();
            const orderIndex = orders.findIndex(order => getOrderId(order) === currentViewingOrderId);

            if (orderIndex === -1) {
                alert('Pesanan tidak ditemukan');
                return;
            }

            orders[orderIndex] = {
                ...orders[orderIndex],
                status: 'processing',
                processedAt: new Date().toISOString()
            };

            saveOrders(orders);
            closeModal('order-detail-modal');
            refreshOrderViews(true);
            alert('Pesanan dipindahkan ke proses');
        }


        async function completeOrder() {
            if (!currentViewingOrderId) {
                return;
            }

            if (apiAvailable && getAdminToken()) {
                try {
                    await RestaurantAPI.updateOrderStatus(getAdminToken(), currentViewingOrderId, 'completed');
                    closeModal('order-detail-modal');
                    await refreshOrderViews(true);
                    alert('Pesanan telah diselesaikan');
                } catch (error) {
                    console.error('Gagal menyelesaikan pesanan:', error);
                    alert('Pesanan gagal diselesaikan');
                }
                return;
            }

            const orders = getOrders();
            const orderIndex = orders.findIndex(order => getOrderId(order) === currentViewingOrderId);

            if (orderIndex === -1) {
                alert('Pesanan tidak ditemukan');
                return;
            }

            orders[orderIndex] = {
                ...orders[orderIndex],
                status: 'completed',
                completedAt: new Date().toISOString()
            };

            saveOrders(orders);
            closeModal('order-detail-modal');
            refreshOrderViews(true);
            alert('Pesanan telah diselesaikan');
        }


        function processOrderFromTable(encodedOrderId) {
            currentViewingOrderId = decodeKey(encodedOrderId);
            processOrder();
        }


        function completeOrderFromTable(encodedOrderId) {
            currentViewingOrderId = decodeKey(encodedOrderId);
            completeOrder();
        }


        function syncOrderStatusNotifications(orders) {
            const groups = getDashboardOrderGroups(orders);
            const nextKnownIds = {
                incoming: new Set(groups.incoming.map(getOrderId).filter(Boolean)),
                processing: new Set(groups.processing.map(getOrderId).filter(Boolean)),
                completed: new Set(groups.completed.map(getOrderId).filter(Boolean))
            };
            const changes = Object.entries(groups).map(([status, statusOrders]) => {
                const previousIds = knownOrderStatusIds[status] || new Set();
                const newOrders = statusOrders.filter(order => {
                    const orderId = getOrderId(order);
                    return orderId && !previousIds.has(orderId);
                });

                return { status, orders: newOrders };
            }).filter(change => change.orders.length > 0);

            if (orderNotificationReady && changes.length > 0) {
                addOrderStatusNotifications(changes);
            }

            knownOrderStatusIds = nextKnownIds;
            orderNotificationReady = true;
        }


        function addOrderStatusNotifications(changes) {
            changes.forEach(change => {
                unreadOrderStatusCounts[change.status] = (unreadOrderStatusCounts[change.status] || 0) + change.orders.length;
            });

            renderOrderNotificationBadges();
        }


        function clearOrderStatusNotification(status) {
            if (!Object.prototype.hasOwnProperty.call(unreadOrderStatusCounts, status)) {
                return;
            }

            unreadOrderStatusCounts[status] = 0;
            renderOrderNotificationBadges();
        }


        function renderOrderNotificationBadges() {
            const badgeIds = {
                incoming: 'incoming-orders-count',
                processing: 'processing-orders-count',
                completed: 'completed-orders-count'
            };

            Object.entries(badgeIds).forEach(([status, badgeId]) => {
                const count = unreadOrderStatusCounts[status] || 0;
                const badge = document.getElementById(badgeId);
                const tab = document.querySelector(`.order-status-tab[data-order-status="${status}"]`);

                if (!badge || !tab) {
                    return;
                }

                badge.textContent = count > 99 ? '99+' : String(count);
                badge.classList.toggle('is-empty', count === 0);
                badge.setAttribute('aria-label', `${count} notifikasi baru`);
                tab.classList.toggle('has-notice', count > 0);
            });
        }


        async function fetchApiOrders() {
            const token = getAdminToken();

            if (!apiAvailable || !token) {
                return null;
            }

            const response = await RestaurantAPI.getOrders(token);
            return (response.orders || []).map(normalizeApiOrder);
        }


        async function refreshOrderViews(force = false) {
            let orders = getOrders();
            let currentOrdersSnapshot = '';

            if (apiAvailable && getAdminToken()) {
                try {
                    orders = await fetchApiOrders();
                    apiOrdersCache = orders;
                    currentOrdersSnapshot = JSON.stringify(apiOrdersCache);
                } catch (error) {
                    console.error('Gagal memuat pesanan dari API:', error);
                    currentOrdersSnapshot = JSON.stringify(apiOrdersCache);
                    orders = apiOrdersCache;
                }
            } else {
                currentOrdersSnapshot = localStorage.getItem(ORDERS_STORAGE_KEY) || '[]';
                orders = getOrders();
            }

            if (!force && currentOrdersSnapshot === lastOrdersSnapshot) {
                return;
            }

            lastOrdersSnapshot = currentOrdersSnapshot;
            syncOrderStatusNotifications(orders);

            if (document.getElementById('admin-panel').style.display !== 'none') {
                loadDashboardData(orders);
                loadOrders();
                await loadTables();
            }

            if (document.getElementById('user-panel').style.display !== 'none') {
                loadUserOrders();
                loadOrderTableOptions();
            }
        }


        function startRealtimeOrdersSync() {
            if (realtimeSyncStarted) {
                return;
            }

            realtimeSyncStarted = true;

            window.addEventListener('storage', function (event) {
                if (event.key === ORDERS_STORAGE_KEY) {
                    refreshOrderViews(true);
                }

                if (event.key === MENU_STORAGE_KEY) {
                    loadMenuItems();
                    loadAvailableMenu();
                }

                if (event.key === TABLES_STORAGE_KEY) {
                    loadTables();
                    loadOrderTableOptions();
                }
            });

            setInterval(function () {
                refreshOrderViews(false);
            }, 1000);
        }
