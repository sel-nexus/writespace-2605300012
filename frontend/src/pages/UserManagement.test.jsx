/** Verify account form, confirmation, fresh session checks and real storage outcomes. */
import { it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import UserManagement from "./UserManagement.jsx";
import App from "../App.jsx";
import { getUsers, saveUsers } from "../utils/storage.js";
import { setSession, getSession, clearSession } from "../utils/auth.js";
const admin = {
  userId: "admin",
  username: "admin",
  displayName: "Admin",
  role: "admin",
};
const row = {
  id: "rae",
  username: "Rae",
  displayName: "Rae Reader",
  password: "demo",
  role: "user",
  createdAt: "2025-01-02",
};
/** Mount the page with a real stored Admin session. */
function mount() {
  setSession(admin);
  return render(<UserManagement />);
}
/** Enter synthetic demo credentials through native inputs. */
async function fill(role = "user", username = " Rae ") {
  await userEvent.type(screen.getByLabelText("Display name"), " Rae Reader ");
  await userEvent.type(screen.getByLabelText("Username"), username);
  await userEvent.type(screen.getByLabelText("Password"), " demo-only ");
  await userEvent.selectOptions(screen.getByLabelText("Role"), role);
}
/** Select desktop actions while jsdom has no responsive CSS layout. */
function removeButton() {
  return within(screen.getByRole("table")).getByRole("button", {
    name: "Delete Rae Reader",
  });
}

it("renders fixed Admin without persisting it, required native fields and real mobile cards", () => {
  mount();
  expect(localStorage.getItem("writespace_users")).toBeNull();
  expect(
    screen.getByText("No registered accounts yet. Create one above."),
  ).toBeInTheDocument();
  for (const label of ["Display name", "Username", "Password", "Role"]) {
    expect(screen.getByLabelText(label)).toBeRequired();
    expect(screen.getByLabelText(label)).toHaveAttribute(
      "aria-required",
      "true",
    );
  }
  expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  expect(screen.getByLabelText("Role").tagName).toBe("SELECT");
  expect(screen.getByRole("list", { name: "Account cards" })).toHaveClass(
    "sm:hidden",
  );
  expect(screen.getByRole("table").parentElement).toHaveClass(
    "hidden",
    "sm:block",
  );
  for (const button of screen.getAllByRole("button", {
    name: "Delete Admin",
  })) {
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Default admin cannot be deleted.");
  }
});
it.each(["user", "admin"])(
  "creates %s with canonical identity, displayed role and persisted schema",
  async (role) => {
    mount();
    await fill(role);
    await userEvent.click(screen.getByRole("button", { name: "Create User" }));
    const account = getUsers()[0];
    expect(account).toEqual({
      id: expect.any(String),
      username: "Rae",
      displayName: "Rae Reader",
      password: " demo-only ",
      role,
      createdAt: expect.any(String),
    });
    expect(JSON.parse(localStorage.getItem("writespace_users"))).toEqual([
      account,
    ]);
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Rae")).toBeInTheDocument();
    expect(table.getAllByRole("status").at(-1)).toHaveTextContent(
      role === "admin" ? "Admin" : "user",
    );
    expect(screen.getByLabelText("Username")).toHaveValue("");
    expect(getSession()).toEqual(admin);
  },
);
it("associates all missing-field errors including missing role", async () => {
  mount();
  await userEvent.selectOptions(screen.getByLabelText("Role"), "");
  await userEvent.click(screen.getByRole("button", { name: "Create User" }));
  for (const label of ["Display name", "Username", "Password", "Role"]) {
    const input = screen.getByLabelText(label);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(
      document.getElementById(input.getAttribute("aria-describedby")),
    ).toHaveAttribute("role", "alert");
  }
  expect(getUsers()).toEqual([]);
});
it.each([" ADMIN ", " rae "])(
  "rejects reserved/legacy duplicate %j without saving",
  async (username) => {
    saveUsers([{ ...row, username: " RAE " }]);
    mount();
    await fill("user", username);
    await userEvent.click(screen.getByRole("button", { name: "Create User" }));
    expect(screen.getByLabelText("Username")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(getUsers()).toEqual([{ ...row, username: " RAE " }]);
  },
);
it("cancels then confirms delete, preserving unrelated malformed rows and re-reading storage", async () => {
  saveUsers([null, row]);
  mount();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  expect(confirm).not.toHaveBeenCalled();
  await userEvent.click(removeButton());
  expect(getUsers()).toEqual([null, row]);
  expect(removeButton()).toBeEnabled();
  const other = {
    ...row,
    id: "other",
    username: "other",
    displayName: "Other",
  };
  saveUsers([null, row, other]);
  confirm.mockReturnValue(true);
  await userEvent.click(removeButton());
  expect(JSON.parse(localStorage.getItem("writespace_users"))).toEqual([
    null,
    other,
  ]);
  expect(
    within(screen.getByRole("table")).queryByText("Rae Reader"),
  ).not.toBeInTheDocument();
  expect(
    within(screen.getByRole("table")).getByText("Other"),
  ).toBeInTheDocument();
});
it.each(["create", "delete"])(
  "reports %s quota failure without false success or view state",
  async (action) => {
    saveUsers([row]);
    mount();
    if (action === "create") await fill("admin", "new");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    await userEvent.click(
      action === "create"
        ? screen.getByRole("button", { name: "Create User" })
        : removeButton(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      action === "create" ? "could not be saved" : "could not be deleted",
    );
    expect(getUsers()).toEqual([row]);
    expect(removeButton()).toBeEnabled();
    if (action === "create")
      expect(screen.getByLabelText("Username")).toHaveValue("new");
    expect(screen.queryByText("Account deleted.")).not.toBeInTheDocument();
  },
);
it.each(["guest", "user"])(
  "rejects stale %s session before create",
  async (state) => {
    mount();
    await fill();
    if (state === "guest") clearSession();
    else setSession({ ...admin, role: "user" });
    await userEvent.click(screen.getByRole("button", { name: "Create User" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Admin access is required",
    );
    expect(getUsers()).toEqual([]);
  },
);
it("rejects expired session before opening Delete confirmation", async () => {
  saveUsers([row]);
  mount();
  clearSession();
  const confirm = vi.spyOn(window, "confirm");
  await userEvent.click(removeButton());
  expect(confirm).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("Admin access");
  expect(getUsers()).toEqual([row]);
});
it.each(["guest", "user", "self", "missing", "ambiguous", "fixed"])(
  "rejects changed %s state during confirmation",
  async (change) => {
    saveUsers([row]);
    mount();
    vi.spyOn(window, "confirm").mockImplementation(() => {
      if (change === "guest") clearSession();
      if (change === "user") setSession({ ...admin, role: "user" });
      if (change === "self") setSession({ ...admin, userId: "rae" });
      if (change === "missing") saveUsers([]);
      if (change === "ambiguous") saveUsers([row, { id: row.id }]);
      if (change === "fixed") saveUsers([{ ...row, username: " ADMIN " }]);
      return true;
    });
    await userEvent.click(removeButton());
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Account deleted.")).not.toBeInTheDocument();
    if (["guest", "user", "self"].includes(change))
      expect(getUsers()).toEqual([row]);
    if (change === "ambiguous")
      expect(getUsers()).toEqual([row, { id: row.id }]);
    if (change === "fixed")
      expect(getUsers()).toEqual([{ ...row, username: " ADMIN " }]);
  },
);
it("filters malformed rows and disables a registered current Admin account", () => {
  const self = { ...row, role: "admin" };
  saveUsers([null, {}, self]);
  setSession({ ...admin, userId: "rae" });
  render(<UserManagement />);
  expect(removeButton()).toBeDisabled();
  expect(getUsers()).toEqual([null, {}, self]);
});
it.each(["guest", "user", "admin"])(
  "routes %s initial /users with the correct shell",
  async (role) => {
    if (role !== "guest") setSession({ ...admin, role });
    render(
      <MemoryRouter initialEntries={["/users"]}>
        <App />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("heading", {
        name:
          role === "guest"
            ? "Login"
            : role === "user"
              ? "All Blogs"
              : "Manage Users",
        exact: true,
      }),
    ).toBeInTheDocument();
    if (role === "admin")
      expect(
        screen.getByRole("navigation", { name: "Authenticated navigation" }),
      ).toBeInTheDocument();
    if (role !== "admin")
      expect(
        screen.queryByRole("button", { name: "Create User" }),
      ).not.toBeInTheDocument();
    expect(localStorage.getItem("writespace_users")).toBeNull();
  },
);
