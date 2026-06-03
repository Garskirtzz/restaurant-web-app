// Admin settings and customer profile flows

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
