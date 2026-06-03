// Admin table management flows

        function getTablesWithLiveStatus() {
            const activeOrders = getOrders().filter(order => isActiveOrder(order) && normalizeTableKey(order.tableNumber));

            return getTables().map(table => {
                const activeOrder = activeOrders.find(order => normalizeTableKey(order.tableNumber) === String(table.number));

                return {
                    ...table,
                    status: activeOrder ? 'occupied' : 'available',
                    activeOrderId: activeOrder ? getOrderId(activeOrder) : ''
                };
            });
        }

        async function refreshTableData() {
            if (!apiAvailable || !getAdminToken()) {
                return getTables();
            }

            try {
                const response = await RestaurantAPI.getTables();
                apiTablesCache = (response.tables || []).map(normalizeApiTable);
            } catch (error) {
                console.error('Gagal memuat meja dari API:', error);
            }

            return apiTablesCache;
        }

        async function loadTables() {
            await refreshTableData();

            const tbody = document.querySelector('#tables-table tbody');
            const tables = getTablesWithLiveStatus();

            if (!apiAvailable || !getAdminToken()) {
                saveTables(tables.map(({ activeOrderId, ...table }) => table));
            }

            if (!tbody) {
                return;
            }

            tbody.innerHTML = '';

            if (tables.length === 0) {
                renderEmptyRow(tbody, 5, 'Belum ada meja');
                return;
            }

            tables.forEach(table => {
                const key = encodeKey(table.id || table.number);
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>Meja ${escapeHTML(table.number)}</td>
                    <td><span class="status ${escapeHTML(table.status)}">${table.status === 'occupied' ? 'Terisi' : 'Tersedia'}</span></td>
                    <td>${escapeHTML(table.capacity)} orang</td>
                    <td>${table.activeOrderId ? '#' + escapeHTML(table.activeOrderId) : '-'}</td>
                    <td>
                        <button class="action-btn" onclick="editTable('${key}')">Edit</button>
                        <button class="action-btn" onclick="deleteTable('${key}')">Hapus</button>
                    </td>
                `;
                tbody.appendChild(row);
            });

            loadOrderTableOptions();
        }

        function showAddTableModal() {
            document.getElementById('table-number').value = '';
            document.getElementById('table-capacity').value = '';
            document.getElementById('add-table-modal').style.display = 'flex';
        }

        async function saveTable() {
            const tableNumber = parseInt(document.getElementById('table-number').value, 10);
            const capacity = parseInt(document.getElementById('table-capacity').value, 10);

            if (Number.isNaN(tableNumber) || Number.isNaN(capacity)) {
                alert('Silakan isi nomor dan kapasitas meja dengan benar');
                return;
            }

            const tables = getTables();
            if (tables.some(table => Number(table.number) === tableNumber)) {
                alert('Meja dengan nomor tersebut sudah ada');
                return;
            }

            if (apiAvailable && getAdminToken()) {
                try {
                    await RestaurantAPI.createTable(getAdminToken(), {
                        number: String(tableNumber),
                        capacity
                    });
                    await refreshTableData();
                    closeModal('add-table-modal');
                    await loadTables();
                    loadDashboardData();
                } catch (error) {
                    console.error('Gagal menyimpan meja:', error);
                    alert(error.payload?.error || 'Meja gagal disimpan');
                }
                return;
            }

            tables.push({ number: tableNumber, capacity, status: 'available' });
            saveTables(tables);
            closeModal('add-table-modal');
            loadTables();
        }

        function editTable() {
            alert('Fitur edit meja belum tersedia');
        }

        async function deleteTable(encodedTableKey) {
            if (!confirm('Apakah Anda yakin ingin menghapus meja ini?')) {
                return;
            }

            const tableKey = decodeKey(encodedTableKey);
            const table = getTables().find(item => {
                return String(item.id || item.number) === tableKey || String(item.number) === tableKey;
            });

            if (apiAvailable && getAdminToken()) {
                if (!table || table.id == null) {
                    alert('Meja tidak ditemukan');
                    return;
                }

                try {
                    await RestaurantAPI.deleteTable(getAdminToken(), table.id);
                    await refreshTableData();
                    await loadTables();
                    loadDashboardData();
                } catch (error) {
                    console.error('Gagal menghapus meja:', error);
                    alert(error.payload?.error || 'Meja gagal dihapus');
                }
                return;
            }

            saveTables(getTables().filter(item => {
                return String(item.id || item.number) !== tableKey && String(item.number) !== tableKey;
            }));
            await loadTables();
        }
