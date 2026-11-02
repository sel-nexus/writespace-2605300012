/** Exercise native account row/card controls and protected identities. */
import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserRow } from "./UserRow.jsx";
const account = {
  id: "rae",
  username: " Rae ",
  displayName: "Rae Reader",
  role: "user",
  createdAt: "2025-01-02T00:00:00Z",
};

it.each(["admin", "user"])(
  "renders %s avatar, badge, canonical name and date in a desktop row",
  (role) => {
    render(
      <table>
        <tbody>
          <UserRow account={{ ...account, role }} onDelete={() => {}} />
        </tbody>
      </table>,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(
      role === "admin" ? "Admin avatar" : "User avatar",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      role === "admin" ? "Admin" : "user",
    );
    expect(screen.getByText("Rae")).toBeInTheDocument();
    expect(screen.getByText("Jan 02, 2025")).toBeInTheDocument();
    expect(screen.getByRole("row")).toBeInTheDocument();
  },
);
it("renders a real mobile list card and unavailable date", async () => {
  const remove = vi.fn();
  render(
    <ul>
      <UserRow
        account={{ ...account, createdAt: "bad" }}
        onDelete={remove}
        mobile
      />
    </ul>,
  );
  expect(screen.getByRole("listitem")).toHaveAccessibleName("Account Rae");
  expect(screen.getByText("Date unavailable")).toBeInTheDocument();
  expect(screen.queryByRole("row")).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Delete Rae Reader" }),
  );
  expect(remove).toHaveBeenCalledWith("rae");
});
it.each([{ id: "admin" }, { username: " ADMIN " }])(
  "permanently disables fixed identity %j with exact tooltip",
  async (override) => {
    const remove = vi.fn();
    render(
      <ul>
        <UserRow
          account={{ ...account, ...override }}
          onDelete={remove}
          mobile
        />
      </ul>,
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Default admin cannot be deleted.");
    expect(screen.getByText("Built-in account")).toBeInTheDocument();
    await userEvent.click(button);
    expect(remove).not.toHaveBeenCalled();
  },
);
it.each([{ currentUserId: "rae" }, { adminAccess: false }])(
  "disables self or denied session controls %j",
  async (props) => {
    const remove = vi.fn();
    render(
      <ul>
        <UserRow account={account} onDelete={remove} mobile {...props} />
      </ul>,
    );
    expect(screen.getByRole("button")).toBeDisabled();
    await userEvent.click(screen.getByRole("button"));
    expect(remove).not.toHaveBeenCalled();
  },
);
it("activates enabled desktop Delete only on native click", async () => {
  const remove = vi.fn();
  render(
    <table>
      <tbody>
        <UserRow account={account} onDelete={remove} />
      </tbody>
    </table>,
  );
  expect(remove).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button"));
  expect(remove).toHaveBeenCalledWith("rae");
});
