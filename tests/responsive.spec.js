const { test, expect } = require('@playwright/test');

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 }
};

async function expectNoBodyHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;

    return {
      viewport: root.clientWidth,
      rootScrollWidth: root.scrollWidth,
      bodyScrollWidth: body.scrollWidth
    };
  });

  expect(overflow.rootScrollWidth).toBeLessThanOrEqual(overflow.viewport + 1);
  expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.viewport + 1);
}

async function loginAdmin(page) {
  await page.goto('/admin.html');
  await page.locator('.login-tab', { hasText: 'Admin' }).click();
  await page.locator('#admin-username').fill('admin');
  await page.locator('#admin-password').fill('password123');
  await page.getByRole('button', { name: 'Login Admin' }).click();
  await expect(page.locator('#admin-panel')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

test.describe('responsive public menu layout', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`index page stays contained on ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/index.html');

      await expect(page.getByRole('heading', { name: 'Menu Digital Restoran' })).toBeVisible();
      await expect(page.getByRole('button', { name: /Order History/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /Sign In/ })).toBeVisible();
      await expect(page.locator('main .card').first()).toBeVisible();
      await expect(page.locator('main .card img').first()).toBeVisible();
      await expectNoBodyHorizontalOverflow(page);
    });
  }
});

test.describe('responsive admin layout', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`admin login and dashboard stay separated on ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/admin.html');

      await expect(page.locator('#login-page')).toBeVisible();
      await expect(page.locator('#admin-panel')).toBeHidden();
      await expectNoBodyHorizontalOverflow(page);

      await loginAdmin(page);
      await expect(page.locator('#login-page')).toBeHidden();
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      await expect(page.locator('.order-status-tabs')).toBeVisible();
      await expectNoBodyHorizontalOverflow(page);
    });
  }
});
