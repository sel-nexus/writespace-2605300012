/** Capture browser failures automatically before the first navigation. */
import { test as base, expect } from '@playwright/test';
export const test = base.extend({
  browserErrors: [
    async ({ page }, use) => {
      const errors = [];
      const onConsole = (message) => {
        if (message.type() === 'error') errors.push(message.text());
      };
      const onPageError = (error) => errors.push(error.message);
      page.on('console', onConsole);
      page.on('pageerror', onPageError);
      try {
        await use(errors);
      } finally {
        page.off('console', onConsole);
        page.off('pageerror', onPageError);
        expect(errors).toEqual([]);
      }
    },
    { auto: true },
  ],
});
export { expect };
