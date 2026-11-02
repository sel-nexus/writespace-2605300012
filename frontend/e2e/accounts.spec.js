/** Exercise account management through real UI navigation with automatic browser error capture. */
import { test, expect } from "./fixtures.js";

/** Enter demo credentials and submit the native Login form. */
async function login(page, username, password) {
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
}
/** Explicitly log out through the account dropdown, then return to Login by UI. */
async function logoutToLogin(page, displayName) {
  await page
    .getByRole("navigation", { name: "Authenticated navigation" })
    .getByRole("button", { name: new RegExp(displayName) })
    .click();
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(
    await page.evaluate(() => localStorage.getItem("writespace_session")),
  ).toBeNull();
  await page.getByRole("link", { name: "Start Reading", exact: true }).click();
}
/** Create a local account using labelled native fields and role selection. */
async function create(page, displayName, username, role) {
  await page.getByLabel("Display name", { exact: true }).fill(displayName);
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(" demo-only ");
  await page.getByLabel("Role", { exact: true }).selectOption(role);
  await page.getByRole("button", { name: "Create User", exact: true }).click();
  await expect(
    page.getByText(`Account created: ${displayName.trim()}.`, { exact: true }),
  ).toBeVisible();
}
/** Read the actual browser account collection for state assertions. */
async function storedUsers(page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("writespace_users")),
  );
}

test("Admin login → Manage Users → create roles → cancel/confirm delete → reload → created-account login and self guard", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Start Reading", exact: true }).click();
  await login(page, "admin", "admin");
  await page.getByRole("link", { name: "Manage Users", exact: true }).click();
  await expect(page).toHaveURL(/\/users$/);
  const table = page.getByRole("table", { name: "Accounts table" });
  await expect(table).toBeVisible();
  const fixed = table.getByRole("button", {
    name: "Delete Admin",
    exact: true,
  });
  await expect(fixed).toBeDisabled();
  await expect(fixed).toHaveAttribute(
    "title",
    "Default admin cannot be deleted.",
  );
  expect(await storedUsers(page)).toBeNull();
  await create(page, " Rae Reader ", " Rae ", "user");
  await create(page, " Alex Admin ", " Alex ", "admin");
  const accounts = await storedUsers(page);
  expect(
    accounts.map(({ displayName, username, password, role }) => ({
      displayName,
      username,
      password,
      role,
    })),
  ).toEqual([
    {
      displayName: "Rae Reader",
      username: "Rae",
      password: " demo-only ",
      role: "user",
    },
    {
      displayName: "Alex Admin",
      username: "Alex",
      password: " demo-only ",
      role: "admin",
    },
  ]);
  for (const account of accounts) {
    expect(Object.keys(account).sort()).toEqual([
      "createdAt",
      "displayName",
      "id",
      "password",
      "role",
      "username",
    ]);
    expect(account.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(new Date(account.createdAt).toISOString()).toBe(account.createdAt);
  }
  await expect(
    table
      .locator("tbody tr")
      .filter({ hasText: "Rae Reader" })
      .getByRole("status"),
  ).toHaveText("user");
  await expect(
    table
      .locator("tbody tr")
      .filter({ hasText: "Alex Admin" })
      .getByRole("status"),
  ).toHaveText("Admin");
  await create(page, "Temporary", "temporary", "user");
  const beforeDelete = await storedUsers(page);
  page.once("dialog", (dialog) => dialog.dismiss());
  await table
    .getByRole("button", { name: "Delete Temporary", exact: true })
    .click();
  expect(await storedUsers(page)).toEqual(beforeDelete);
  page.once("dialog", (dialog) => dialog.accept());
  await table
    .getByRole("button", { name: "Delete Temporary", exact: true })
    .click();
  await expect(table.getByText("Temporary", { exact: true })).toHaveCount(0);
  expect(await storedUsers(page)).toEqual(accounts);
  await page.reload();
  await expect(table.getByText("Rae Reader", { exact: true })).toBeVisible();
  await expect(fixed).toBeDisabled();
  expect(await storedUsers(page)).toEqual(accounts);
  await logoutToLogin(page, "Admin");
  await login(page, " rae ", " demo-only ");
  await expect(page).toHaveURL(/\/blogs$/);
  const userSession = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("writespace_session")),
  );
  expect(userSession).toEqual({
    userId: accounts[0].id,
    username: "Rae",
    displayName: "Rae Reader",
    role: "user",
  });
  await expect(
    page.getByRole("link", { name: "Users", exact: true }),
  ).toHaveCount(0);
  await logoutToLogin(page, "Rae Reader");
  await login(page, " alex ", " demo-only ");
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("link", { name: "Manage Users", exact: true }).click();
  const self = table.getByRole("button", {
    name: "Delete Alex Admin",
    exact: true,
  });
  await expect(self).toBeDisabled();
  await expect(self).toHaveAttribute(
    "title",
    "You cannot delete your current account.",
  );
  await expect(fixed).toBeDisabled();
  expect(await storedUsers(page)).toEqual(accounts);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("writespace_session")),
    ),
  ).toEqual({
    userId: accounts[1].id,
    username: "Alex",
    displayName: "Alex Admin",
    role: "admin",
  });
});

test("mobile real cards and hamburger retain account actions and protected default", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("link", { name: "Start Reading", exact: true }).click();
  await login(page, "admin", "admin");
  await page.getByRole("link", { name: "Manage Users", exact: true }).click();
  await expect(
    page.getByRole("table", { name: "Accounts table" }),
  ).not.toBeVisible();
  const cards = page.getByRole("list", { name: "Account cards" });
  await expect(cards).toBeVisible();
  await create(page, "Mobile Reader", "mobile", "user");
  const card = cards.getByRole("listitem", {
    name: "Account mobile",
    exact: true,
  });
  await expect(card.getByText("Mobile Reader", { exact: true })).toBeVisible();
  await expect(card.getByRole("status")).toHaveText("user");
  await expect(
    card.getByRole("button", { name: "Delete Mobile Reader" }),
  ).toBeEnabled();
  await expect(
    cards.getByRole("button", { name: "Delete Admin", exact: true }),
  ).toBeDisabled();
  const rows = await storedUsers(page);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("button", { name: "Close navigation" }),
  ).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("link", { name: "All Blogs", exact: true }).click();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Users", exact: true }).click();
  await expect(card).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toHaveAttribute("aria-expanded", "false");
  expect(await storedUsers(page)).toEqual(rows);
});

test("guest initial /users entry redirects to Login without account controls or writes", async ({
  page,
}) => {
  await page.goto("/users");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Login", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create User", exact: true }),
  ).toHaveCount(0);
  expect(await storedUsers(page)).toBeNull();
});

test("user initial /users entry redirects to All Blogs without Admin controls or writes", async ({
  page,
}) => {
  const identity = {
    userId: "reader",
    username: "reader",
    displayName: "Reader",
    role: "user",
  };
  await page.addInitScript(
    (session) =>
      localStorage.setItem("writespace_session", JSON.stringify(session)),
    identity,
  );
  await page.goto("/users");
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(
    page.getByRole("heading", { name: "All Blogs", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Users", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Create User", exact: true }),
  ).toHaveCount(0);
  expect(await storedUsers(page)).toBeNull();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("writespace_session")),
    ),
  ).toEqual(identity);
});
