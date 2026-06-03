// Customer dashboard and order creation flows

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
                    <td><button class="action-btn" data-action="showOrderDetailModal" data-key="${encodeKey(orderId)}">Detail</button></td>
                `;
                tbody.appendChild(row);
            });
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
                    <span>${escapeHTML(formatCurrency(item.price * item.quantity))} <button class="action-btn" data-action="removeCurrentOrderItem" data-key="${key}">Hapus</button></span>
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
