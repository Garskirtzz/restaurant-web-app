const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
});

async function loginAdmin(page) {
  await page.goto('/admin.html');
  await page.locator('.login-tab', { hasText: 'Admin' }).click();
  await page.locator('#admin-username').fill('admin');
  await page.locator('#admin-password').fill('password123');
  await page.getByRole('button', { name: 'Login Admin' }).click();
  await expect(page.locator('#admin-panel')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

async function expectNoMojibake(page) {
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toMatch(/[ÃÂðâ�]/);
}

async function requestAdminToken(request) {
  const response = await request.post('/api/auth/admin/login', {
    data: {
      username: 'admin',
      password: 'password123'
    }
  });

  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  return payload.token;
}

test('public menu page renders core navigation and menu content', async ({ page }) => {
  await page.goto('/index.html');

  await expect(page).toHaveTitle(/Menu Digital Restoran/);
  await expect(page.getByRole('heading', { name: 'Menu Digital Restoran' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Order History/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Sign In/ })).toBeVisible();
  await expect(page.locator('.category-tab.active')).toContainText('Semua Menu');
  await expect(page.getByText('Nasi Goreng Special').first()).toBeVisible();
  await expectNoMojibake(page);
});

test('sign in modal exposes customer and admin flows', async ({ page }) => {
  await page.goto('/index.html');

  await page.getByRole('button', { name: /Sign In/ }).click();
  await expect(page.locator('#auth-modal')).toBeVisible();
  await expect(page.locator('#customer-auth-panel')).toBeVisible();
  await expect(page.locator('#customer-login-username')).toBeVisible();

  await page.locator('.auth-tab[data-auth-tab="admin"]').click();
  await expect(page.locator('#admin-auth-panel')).toBeVisible();
  await expect(page.locator('#index-admin-username')).toBeVisible();
});

test('admin login shows dashboard without overlapping login layer', async ({ page }) => {
  await page.goto('/admin.html');

  await expect(page.locator('#login-page')).toBeVisible();
  await expect(page.locator('#admin-panel')).toBeHidden();

  await loginAdmin(page);

  await expect(page.locator('#admin-panel')).toBeVisible();
  await expect(page.locator('#login-page')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expectNoMojibake(page);
});

test('admin dashboard rejects stale localStorage login flag without token', async ({ page }) => {
  await page.goto('/admin.html');
  await page.evaluate(() => {
    localStorage.setItem('adminLoggedIn', 'true');
    localStorage.removeItem('restaurantAdminToken');
  });
  await page.reload();

  await expect(page.locator('#login-page')).toBeVisible();
  await expect(page.locator('#admin-panel')).toBeHidden();
});

test('api logout revokes active admin token', async ({ request }) => {
  const token = await requestAdminToken(request);
  const headers = { Authorization: `Bearer ${token}` };

  const beforeLogout = await request.get('/api/users/me', { headers });
  expect(beforeLogout.ok()).toBeTruthy();

  const logout = await request.post('/api/auth/logout', { headers });
  expect(logout.ok()).toBeTruthy();

  const afterLogout = await request.get('/api/users/me', { headers });
  expect(afterLogout.status()).toBe(401);
});

test('api rejects invalid menu payload before database write', async ({ request }) => {
  const token = await requestAdminToken(request);
  const response = await request.post('/api/menu', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: 'Menu Invalid',
      category: 'food',
      price: 'not-a-number'
    }
  });

  expect(response.status()).toBe(400);
});

test('admin settings save to API-backed restaurant settings', async ({ page, request }) => {
  await loginAdmin(page);

  const uniqueName = `QA Restaurant ${Date.now()}`;
  const loadSettingsPromise = page.waitForResponse(response => {
    return response.url().endsWith('/api/settings') && response.request().method() === 'GET';
  });
  await page.locator('#admin-panel .sidebar-menu a[href="#settings"]').click();
  await loadSettingsPromise;
  await expect(page.getByRole('heading', { name: 'Pengaturan', exact: true })).toBeVisible();
  await page.locator('#restaurant-name').fill(uniqueName);
  await page.locator('#restaurant-address').fill('Jl. Playwright No. 10');
  await page.locator('#restaurant-phone').fill('0800000000');
  await page.locator('#restaurant-hours').fill('09:00 - 21:00');

  const dialogPromise = page.waitForEvent('dialog').then(dialog => dialog.accept());
  const saveResponsePromise = page.waitForResponse(response => {
    return response.url().endsWith('/api/settings') && response.request().method() === 'PUT';
  });

  await page.getByRole('button', { name: 'Simpan Pengaturan' }).click();
  await saveResponsePromise;
  await dialogPromise;

  const response = await request.get('/api/settings');
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  expect(payload.settings.name).toBe(uniqueName);
  expect(payload.settings.address).toBe('Jl. Playwright No. 10');
});
