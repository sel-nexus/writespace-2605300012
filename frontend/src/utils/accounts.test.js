/** Verify registration branches against real jsdom storage snapshots. */
import { describe, it, expect, vi } from "vitest";
import { createAccount, validateRegistration } from "./accounts.js";
import { getUsers, saveUsers } from "./storage.js";
import { getSession } from "./auth.js";

const valid = {
  displayName: "  Rae Reader  ",
  username: "  Rae  ",
  password: " demo-only ",
  confirmPassword: " demo-only ",
};

describe("validateRegistration", () => {
  it("accepts complete fields without modifying input or stored users", () => {
    const users = [{ username: "other" }];
    expect(validateRegistration(valid, users)).toEqual({});
    expect(valid.username).toBe("  Rae  ");
    expect(users).toEqual([{ username: "other" }]);
  });
  it.each([
    ["displayName", "   ", "Display name is required."],
    ["username", "   ", "Username is required."],
    ["password", "", "Password is required."],
    ["confirmPassword", "", "Confirm password is required."],
  ])("rejects missing %s independently", (field, value, message) => {
    expect(validateRegistration({ ...valid, [field]: value }, [])[field]).toBe(
      message,
    );
  });
  it("reports every missing field in one submission", () => {
    expect(
      validateRegistration(
        { displayName: "", username: "", password: "", confirmPassword: "" },
        [],
      ),
    ).toEqual({
      displayName: "Display name is required.",
      username: "Username is required.",
      password: "Password is required.",
      confirmPassword: "Confirm password is required.",
    });
  });
  it("compares exact passwords including whitespace and case", () => {
    expect(
      validateRegistration({ ...valid, confirmPassword: "demo-only" }, []),
    ).toEqual({ confirmPassword: "Passwords do not match." });
    expect(
      validateRegistration({ ...valid, confirmPassword: " DEMO-only " }, []),
    ).toEqual({ confirmPassword: "Passwords do not match." });
  });
  it.each(["admin", "ADMIN", "  AdMiN  ", "\tadmin\n"])(
    "rejects reserved variant %j",
    (username) => {
      expect(validateRegistration({ ...valid, username }, [])).toEqual({
        username: "This username is reserved.",
      });
    },
  );
  it.each([
    ["rae", "Rae"],
    ["  RAE  ", " rae "],
    [" i ", " I "],
  ])(
    "compares submitted %j and stored %j trimmed in en-US",
    (username, stored) => {
      expect(
        validateRegistration({ ...valid, username }, [{ username: stored }]),
      ).toEqual({ username: "This username already exists." });
    },
  );
  it("ignores malformed username rows without crashing or rejecting unrelated names", () => {
    expect(
      validateRegistration(valid, [
        null,
        {},
        { username: 7 },
        { username: "other" },
      ]),
    ).toEqual({});
  });
});

describe("createAccount", () => {
  it("appends canonical user-only UUID/ISO schema without touching password or session", () => {
    const existing = { id: "old", username: "other" };
    saveUsers([existing]);
    const { account, errors } = createAccount({
      ...valid,
      role: "admin",
      email: "not-saved",
    });
    expect(errors).toEqual({});
    expect(account).toEqual({
      id: expect.any(String),
      displayName: "Rae Reader",
      username: "Rae",
      password: " demo-only ",
      role: "user",
      createdAt: expect.any(String),
    });
    expect(account.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(new Date(account.createdAt).toISOString()).toBe(account.createdAt);
    expect(getUsers()).toEqual([existing, account]);
    expect(JSON.parse(localStorage.getItem("writespace_users"))).toEqual([
      existing,
      account,
    ]);
    expect(getSession()).toBeNull();
  });
  it("rejects invalid form without any persisted account or session", () => {
    expect(createAccount({ ...valid, username: " admin " })).toEqual({
      errors: { username: "This username is reserved." },
      account: null,
    });
    expect(localStorage.getItem("writespace_users")).toBeNull();
    expect(getSession()).toBeNull();
  });
  it("re-reads current users for each action and rejects the second canonical collision", () => {
    const first = createAccount(valid).account;
    expect(createAccount({ ...valid, username: " raE " }).account).toBeNull();
    expect(getUsers()).toEqual([first]);
  });
  it("propagates account write failure while preserving previous rows and no session", () => {
    const existing = { username: "other" };
    saveUsers([existing]);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => createAccount(valid)).toThrow("quota");
    expect(getUsers()).toEqual([existing]);
    expect(getSession()).toBeNull();
  });
});

/** Cover Admin-only account branches without mocking application storage. */
import {
  createAdminAccount,
  validateAdminAccount,
  managedAccounts,
  isManagedAccount,
  isDefaultAdmin,
  deletableAccount,
  deleteAdminAccount,
} from "./accounts.js";
import { setSession, clearSession } from "./auth.js";
const adminSession = {
  userId: "admin",
  username: "admin",
  displayName: "Admin",
  role: "admin",
};
const proposal = { ...valid, role: "user" };
const target = {
  id: "target",
  username: "target",
  displayName: "Target",
  password: "demo",
  role: "user",
  createdAt: "bad-date",
};

describe("Admin account validation", () => {
  it.each(["user", "admin"])(
    "accepts %s and exact whitespace passwords",
    (role) => {
      expect(
        validateAdminAccount({ ...proposal, password: " ", role }, [
          null,
          {},
          { username: 5 },
        ]),
      ).toEqual({});
    },
  );
  it.each(["displayName", "username", "password", "role"])(
    "rejects each missing %s",
    (field) => {
      const input = { ...proposal };
      delete input[field];
      expect(validateAdminAccount(input)[field]).toBeTruthy();
    },
  );
  it.each(["displayName", "username", "password", "role"])(
    "rejects real invalid types for %s",
    (field) => {
      for (const value of [null, 9, {}, [], true])
        expect(
          validateAdminAccount({ ...proposal, [field]: value })[field],
        ).toBeTruthy();
    },
  );
  it.each([null, undefined, [], 7, "text"])(
    "rejects malformed form %j",
    (form) => {
      expect(Object.keys(validateAdminAccount(form))).toHaveLength(4);
    },
  );
  it.each(["", "owner", "ADMIN", " admin "])(
    "rejects arbitrary role %j",
    (role) => {
      expect(validateAdminAccount({ ...proposal, role }).role).toBe(
        "Select user or Admin.",
      );
    },
  );
  it.each(["admin", "ADMIN", " AdMiN ", "\tadmin\n"])(
    "reserves %j",
    (username) => {
      expect(validateAdminAccount({ ...proposal, username }).username).toBe(
        "This username is reserved.",
      );
    },
  );
  it.each(["rae", " RAE ", "Rae"])(
    "rejects duplicate %j against legacy whitespace",
    (username) => {
      expect(
        validateAdminAccount({ ...proposal, username }, [{ username: " rae " }])
          .username,
      ).toBe("This username already exists.");
    },
  );
  it("rejects blank text and tolerates nonarray comparison data", () => {
    expect(
      validateAdminAccount({ ...proposal, username: " ", displayName: " " }),
    ).toEqual({
      username: "Username is required.",
      displayName: "Display name is required.",
    });
    expect(validateAdminAccount(proposal, null)).toEqual({});
  });
});

describe("Admin creation", () => {
  it.each(["user", "admin"])(
    "persists exact %s schema, canonical values and unchanged session",
    (role) => {
      setSession(adminSession);
      saveUsers([null, target]);
      const { account, errors } = createAdminAccount({
        ...proposal,
        role,
        extra: "omit",
      });
      expect(errors).toEqual({});
      expect(account).toEqual({
        id: expect.any(String),
        displayName: "Rae Reader",
        username: "Rae",
        password: " demo-only ",
        role,
        createdAt: expect.any(String),
      });
      expect(account.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(new Date(account.createdAt).toISOString()).toBe(account.createdAt);
      expect(JSON.parse(localStorage.getItem("writespace_users"))).toEqual([
        null,
        target,
        account,
      ]);
      expect(getSession()).toEqual(adminSession);
      expect(createAdminAccount(proposal).account).toBeNull();
    },
  );
  it("does not write invalid proposals", () => {
    setSession(adminSession);
    expect(
      createAdminAccount({ ...proposal, role: "owner" }).account,
    ).toBeNull();
    expect(localStorage.getItem("writespace_users")).toBeNull();
  });
  it.each(["guest", "user", "malformed"])(
    "rejects fresh %s session after earlier Admin access",
    (state) => {
      setSession(adminSession);
      if (state === "guest") clearSession();
      else if (state === "user") setSession({ ...adminSession, role: "user" });
      else localStorage.setItem("writespace_session", "{}");
      expect(() => createAdminAccount(proposal)).toThrow("Admin access");
      expect(localStorage.getItem("writespace_users")).toBeNull();
    },
  );
  it("propagates quota failure without false persisted state", () => {
    setSession(adminSession);
    saveUsers([target]);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => createAdminAccount(proposal)).toThrow("quota");
    expect(getUsers()).toEqual([target]);
  });
});

describe("Admin deletion and display", () => {
  it("reads only safe display rows and never writes synthetic Admin", () => {
    const rows = [
      null,
      [],
      {},
      { ...target, role: "owner" },
      { ...target, password: 4 },
      { ...target, id: "" },
      { ...target, username: " ADMIN " },
      target,
    ];
    saveUsers(rows);
    expect(managedAccounts()).toEqual([target]);
    expect(getUsers()).toEqual(rows);
    expect(isManagedAccount(null)).toBe(false);
    expect(isDefaultAdmin({ id: "admin" })).toBe(true);
    expect(isDefaultAdmin(null)).toBe(false);
  });
  it.each(["bad-json", "{}", "null"])(
    "tolerates malformed storage %j",
    (raw) => {
      localStorage.setItem("writespace_users", raw);
      expect(managedAccounts()).toEqual([]);
      expect(localStorage.getItem("writespace_users")).toBe(raw);
    },
  );
  it("deletes one freshly resolved target and preserves unrelated/corrupt rows", () => {
    setSession(adminSession);
    saveUsers([target]);
    expect(deletableAccount("target")).toEqual(target);
    const other = { ...target, id: "other" };
    saveUsers([null, target, other, 4]);
    expect(deleteAdminAccount("target", true)).toBe(true);
    expect(JSON.parse(localStorage.getItem("writespace_users"))).toEqual([
      null,
      other,
      4,
    ]);
    expect(getSession()).toEqual(adminSession);
  });
  it.each([false, undefined, "true", 1])(
    "cancellation %j never writes",
    (confirmed) => {
      setSession(adminSession);
      saveUsers([target]);
      expect(deleteAdminAccount("target", confirmed)).toBe(false);
      expect(getUsers()).toEqual([target]);
    },
  );
  it.each([true, false])(
    "fixed and self guards apply regardless of confirmation %j",
    (confirmed) => {
      setSession({ ...adminSession, userId: "target" });
      saveUsers([target]);
      expect(() => deleteAdminAccount("admin", confirmed)).toThrow(
        "Default admin cannot be deleted.",
      );
      expect(() => deleteAdminAccount("target", confirmed)).toThrow(
        "current account",
      );
      expect(getUsers()).toEqual([target]);
    },
  );
  it.each(["admin", "ADMIN", " AdMiN ", "\tadmin\n"])(
    "rejects fixed username %j even with another id",
    (username) => {
      setSession(adminSession);
      const row = { ...target, username };
      saveUsers([row]);
      expect(() => deleteAdminAccount("target", true)).toThrow(
        "Default admin cannot be deleted.",
      );
      expect(getUsers()).toEqual([row]);
    },
  );
  it.each([null, 9, "", " ", "missing"])(
    "rejects missing/invalid target %j",
    (id) => {
      setSession(adminSession);
      saveUsers([target]);
      expect(() => deleteAdminAccount(id, true)).toThrow("Account not found");
      expect(getUsers()).toEqual([target]);
    },
  );
  it.each([
    { rows: [target, target] },
    { rows: [target, { id: "target" }] },
    { rows: [{ id: "target" }] },
  ])("rejects ambiguous or malformed targets %j", ({ rows }) => {
    setSession(adminSession);
    saveUsers(rows);
    expect(() => deleteAdminAccount("target", true)).toThrow("ambiguous");
    expect(getUsers()).toEqual(rows);
  });
  it.each(["guest", "user"])(
    "rechecks fresh %s session for deletion",
    (state) => {
      setSession(adminSession);
      saveUsers([target]);
      deletableAccount("target");
      if (state === "guest") clearSession();
      else setSession({ ...adminSession, role: "user" });
      expect(() => deleteAdminAccount("target", true)).toThrow("Admin access");
      expect(getUsers()).toEqual([target]);
    },
  );
  it("retains rows on quota failure", () => {
    setSession(adminSession);
    saveUsers([target]);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => deleteAdminAccount("target", true)).toThrow("quota");
    expect(getUsers()).toEqual([target]);
  });
});
