const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
});

test('public menu page renders core navigation and menu content', async ({ page }) => {
  await page.goto('/index.html');

  await expect(page).toHaveTitle(/Menu Digital Restoran/);
  await expect(page.getByRole('heading', { name: 'Menu Digital Restoran' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Order History/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Sign In/ })).toBeVisible();
  await expect(page.locator('.category-tab.active')).toContainText('Semua Menu');
  await expect(page.getByText('Nasi Goreng Special').first()).toBeVisible();
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

  await page.locator('.login-tab', { hasText: 'Admin' }).click();
  await page.locator('#admin-username').fill('admin');
  await page.locator('#admin-password').fill('password123');
  await page.getByRole('button', { name: 'Login Admin' }).click();

  await expect(page.locator('#admin-panel')).toBeVisible();
  await expect(page.locator('#login-page')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});
