// Admin menu management flows

        async function refreshMenuData() {
            if (!apiAvailable || !getAdminToken()) {
                return getMenuItems();
            }

            try {
                const response = await RestaurantAPI.getMenu();
                apiMenuCache = (response.menu || []).map(normalizeApiMenuItem);
            } catch (error) {
                console.error('Gagal memuat menu dari API:', error);
            }

            return apiMenuCache;
        }


        async function loadMenuItems() {
            await refreshMenuData();

            const tbody = document.querySelector('#menu-table tbody');
            if (!tbody) return;

            tbody.innerHTML = '';
            const menuItems = getMenuItems();

            if (menuItems.length === 0) {
                renderEmptyRow(tbody, 6, 'Belum ada menu');
                return;
            }

            menuItems.forEach(item => {
                const key = encodeKey(item.id || item.name);
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><img src="${escapeHTML(item.image || 'https://via.placeholder.com/50?text=Menu')}" width="50" height="50" style="object-fit: cover; border-radius: 4px;"></td>
                    <td>${escapeHTML(item.name)}</td>
                    <td>${escapeHTML(getCategoryText(item.category))}</td>
                    <td>${escapeHTML(formatCurrency(item.price))}</td>
                    <td>${item.available !== false ? 'Tersedia' : 'Tidak Tersedia'}</td>
                    <td>
                        <button class="action-btn" data-action="showEditMenuModalById" data-key="${key}">Edit</button>
                        <button class="action-btn" data-action="deleteMenuItem" data-key="${key}">Hapus</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }


        function showAddMenuModal() {
            document.getElementById('menu-name').value = '';
            document.getElementById('menu-category').value = 'food';
            document.getElementById('menu-price').value = '';
            document.getElementById('menu-description').value = '';
            document.getElementById('menu-image').value = '';
            document.getElementById('menu-available').checked = true;
            document.getElementById('add-menu-modal').style.display = 'flex';
        }


        function showEditMenuModalById(encodedId) {
            const itemId = decodeKey(encodedId);
            const item = getMenuItems().find(menuItem => String(menuItem.id || menuItem.name) === itemId);

            if (!item) {
                alert('Menu tidak ditemukan');
                return;
            }

            currentEditingId = itemId;
            document.getElementById('edit-menu-name').value = item.name;
            document.getElementById('edit-menu-category').value = item.category || 'food';
            document.getElementById('edit-menu-price').value = item.price;
            document.getElementById('edit-menu-description').value = item.description || '';
            document.getElementById('edit-menu-image').value = item.image || '';
            document.getElementById('edit-menu-available').checked = item.available !== false;
            document.getElementById('edit-menu-modal').style.display = 'flex';
        }


        async function saveMenuItem() {
            const menuItem = {
                id: Date.now().toString(),
                name: document.getElementById('menu-name').value.trim(),
                category: document.getElementById('menu-category').value,
                price: parseInt(document.getElementById('menu-price').value, 10),
                description: document.getElementById('menu-description').value.trim(),
                image: document.getElementById('menu-image').value.trim(),
                available: document.getElementById('menu-available').checked
            };

            if (!menuItem.name || Number.isNaN(menuItem.price)) {
                alert('Silakan isi nama dan harga menu dengan benar');
                return;
            }

            const menuItems = getMenuItems();
            if (menuItems.some(item => item.name.toLowerCase() === menuItem.name.toLowerCase())) {
                alert('Menu dengan nama tersebut sudah ada');
                return;
            }

            if (apiAvailable && getAdminToken()) {
                try {
                    await RestaurantAPI.createMenuItem(getAdminToken(), {
                        name: menuItem.name,
                        category: menuItem.category,
                        price: menuItem.price,
                        description: menuItem.description,
                        image: menuItem.image,
                        available: menuItem.available
                    });
                    await refreshMenuData();
                    closeModal('add-menu-modal');
                    await loadMenuItems();
                    loadAvailableMenu();
                } catch (error) {
                    console.error('Gagal menyimpan menu:', error);
                    alert(error.payload?.error || 'Menu gagal disimpan');
                }
                return;
            }

            menuItems.push(menuItem);
            saveMenuItems(menuItems);
            closeModal('add-menu-modal');
            loadMenuItems();
            loadAvailableMenu();
        }


        async function updateMenuItem() {
            const menuItem = {
                id: currentEditingId,
                name: document.getElementById('edit-menu-name').value.trim(),
                category: document.getElementById('edit-menu-category').value,
                price: parseInt(document.getElementById('edit-menu-price').value, 10),
                description: document.getElementById('edit-menu-description').value.trim(),
                image: document.getElementById('edit-menu-image').value.trim(),
                available: document.getElementById('edit-menu-available').checked
            };

            if (!menuItem.name || Number.isNaN(menuItem.price)) {
                alert('Silakan isi nama dan harga menu dengan benar');
                return;
            }

            if (apiAvailable && getAdminToken()) {
                try {
                    await RestaurantAPI.updateMenuItem(getAdminToken(), currentEditingId, {
                        name: menuItem.name,
                        category: menuItem.category,
                        price: menuItem.price,
                        description: menuItem.description,
                        image: menuItem.image,
                        available: menuItem.available
                    });
                    await refreshMenuData();
                    closeModal('edit-menu-modal');
                    await loadMenuItems();
                    loadAvailableMenu();
                } catch (error) {
                    console.error('Gagal memperbarui menu:', error);
                    alert(error.payload?.error || 'Menu gagal diperbarui');
                }
                return;
            }

            const menuItems = getMenuItems().map(item => {
                return String(item.id || item.name) === currentEditingId ? menuItem : item;
            });

            saveMenuItems(menuItems);
            closeModal('edit-menu-modal');
            loadMenuItems();
            loadAvailableMenu();
        }


        async function deleteMenuItem(encodedId) {
            if (!confirm('Apakah Anda yakin ingin menghapus menu ini?')) {
                return;
            }

            const itemId = decodeKey(encodedId);
            if (apiAvailable && getAdminToken()) {
                try {
                    await RestaurantAPI.deleteMenuItem(getAdminToken(), itemId);
                    await refreshMenuData();
                    await loadMenuItems();
                    loadAvailableMenu();
                } catch (error) {
                    console.error('Gagal menghapus menu:', error);
                    alert(error.payload?.error || 'Menu gagal dihapus');
                }
                return;
            }

            saveMenuItems(getMenuItems().filter(item => String(item.id || item.name) !== itemId));
            await loadMenuItems();
            loadAvailableMenu();
        }


        function loadAvailableMenu() {
            const tbody = document.querySelector('#available-menu-table tbody');
            if (!tbody) return;

            tbody.innerHTML = '';
            const availableItems = getMenuItems().filter(item => item.available !== false);

            if (availableItems.length === 0) {
                renderEmptyRow(tbody, 4, 'Belum ada menu tersedia');
                return;
            }

            availableItems.forEach(item => {
                const key = encodeKey(item.id || item.name);
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${escapeHTML(item.name)}</td>
                    <td>${escapeHTML(formatCurrency(item.price))}</td>
                    <td><input type="number" min="1" value="1" id="order-qty-${key}" style="width: 70px;"></td>
                    <td><button class="action-btn" data-action="addToCurrentOrder" data-key="${key}">Tambah</button></td>
                `;
                tbody.appendChild(row);
            });
        }
