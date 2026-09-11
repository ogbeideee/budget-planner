import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmailAlertsPanel } from "./EmailAlertsPanel";

// FR-24 transport phase, renderer side. The security assertions that matter:
// the password goes over IPC once, is never in localStorage, and the panel
// refuses to collect one when the machine cannot protect it.

const emailConnect = vi.fn();
const emailTest = vi.fn();
const emailDisconnect = vi.fn();
const emailStatus = vi.fn();
const credentialsAvailable = vi.fn(async () => true);

let available = true;
let desktopEnabled = true;

vi.mock("@/lib/desktop", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/desktop")>();
  return {
    ...actual,
    isDesktop: () => desktopEnabled,
    getDesktopBridge: () => window.budgetPlannerDesktop ?? null,
  };
});

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  available = true;
  desktopEnabled = true;
  window.localStorage.clear();
  credentialsAvailable.mockImplementation(async () => available);
  emailStatus.mockResolvedValue({
    state: "not-connected",
    provider: null,
    email: null,
    lastConnectedAt: null,
    lastError: null,
    credential: { connected: false, savedAt: null },
  });
  emailConnect.mockResolvedValue({ ok: true, state: "connected" });
  emailTest.mockResolvedValue({ ok: true });
  emailDisconnect.mockResolvedValue({ ok: true });

  Object.defineProperty(window, "budgetPlannerDesktop", {
    configurable: true,
    value: {
      credentials: {
        isAvailable: credentialsAvailable,
        set: vi.fn(),
        status: vi.fn(async () => ({ connected: false, savedAt: null })),
        clear: vi.fn(),
      },
      email: {
        connect: emailConnect,
        test: emailTest,
        disconnect: emailDisconnect,
        status: emailStatus,
      },
    },
  });
});

const EMAIL_FIELD = "Email address";
const PASSWORD_FIELD = "App password";

async function fillAndConnect(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(EMAIL_FIELD), "user@gmail.com");
  await user.type(screen.getByLabelText(PASSWORD_FIELD), "app-password-123");
  await user.click(screen.getByRole("button", { name: "Connect" }));
  await waitFor(() => expect(emailConnect).toHaveBeenCalled());
}

describe("EmailAlertsPanel", () => {
  it("shows the four required disclosures before any credential field", async () => {
    render(<EmailAlertsPanel />);
    await waitFor(() => expect(screen.getByLabelText(PASSWORD_FIELD)).toBeTruthy());
    // The four REQUIRED disclosures (docs/15). Text is split by <strong>
    // markers, so match with functions over the whole li text.
    const bullet = (needle: string) =>
      screen
        .getAllByRole("listitem")
        .some((item) => item.textContent?.includes(needle));
    expect(bullet("transaction alerts from a fixed list of bank senders")).toBe(true);
    expect(bullet("processed on this computer")).toBe(true);
    expect(bullet("never sends mail, moves money")).toBe(true);
    expect(bullet("draft you confirm")).toBe(true);
    // The app-password instruction paragraph's <strong> marker.
    expect(screen.getByText("app password")).toBeTruthy();
  });

  it("sends the password through the bridge once and never writes it to localStorage", async () => {
    // Main reports CONNECTED after a successful connect; the mount effect
    // must not fire a reconnect for an already-connected session.
    let connectSucceeded = false;
    emailConnect.mockImplementation(async (payload: { password?: string }) => {
      if (payload?.password === "app-password-123") {
        connectSucceeded = true;
        return { ok: true, state: "connected" };
      }
      return { ok: false, category: "auth" };
    });
    emailStatus.mockImplementation(async () => ({
      state: connectSucceeded ? "connected" : "not-connected",
      provider: connectSucceeded ? "gmail" : null,
      email: connectSucceeded ? "user@gmail.com" : null,
      lastConnectedAt: connectSucceeded ? "2026-09-11T12:00:00.000Z" : null,
      lastError: null,
      credential: { connected: false, savedAt: null },
    }));
    const user = userEvent.setup();
    render(<EmailAlertsPanel />);
    await fillAndConnect(user);

    expect(emailConnect).toHaveBeenCalledOnce();
    const payload = emailConnect.mock.calls[0][0];
    expect(payload.password).toBe("app-password-123");
    expect(payload.config).toMatchObject({
      provider: "gmail",
      email: "user@gmail.com",
      host: "imap.gmail.com",
      port: 993,
      security: "tls",
      initialLookbackDays: 30,
    });

    // THE assertion: nothing in renderer storage mentions the password.
    const everything = JSON.stringify(window.localStorage);
    expect(everything).not.toContain("app-password-123");

    // The non-secret config IS persisted for the reconnect path.
    expect(
      window.localStorage.getItem("email-account"),
    ).toContain("user@gmail.com");
  });

  it("clears the password field even when the connection fails", async () => {
    emailConnect.mockResolvedValue({
      ok: false,
      category: "auth",
      message: "The mail server rejected the address or app password.",
    });
    const user = userEvent.setup();
    render(<EmailAlertsPanel />);
    await fillAndConnect(user);

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("rejected"),
    );
    expect((screen.getByLabelText(PASSWORD_FIELD) as HTMLInputElement).value).toBe("");
    // A failed authentication must not persist anything as "connected".
    expect(JSON.stringify(window.localStorage)).not.toContain("app-password-123");
  });

  it("shows a safe error and no technical detail when testing fails", async () => {
    emailTest.mockResolvedValue({
      ok: false,
      category: "network",
      message: "Could not reach the mail server.",
    });
    const user = userEvent.setup();
    render(<EmailAlertsPanel />);
    await user.type(screen.getByLabelText(EMAIL_FIELD), "user@gmail.com");
    await user.type(screen.getByLabelText(PASSWORD_FIELD), "app-password-123");
    await user.click(screen.getByRole("button", { name: "Test connection" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("mail server"),
    );
    expect(emailTest).toHaveBeenCalledOnce();
    // A test does not store the credential or the config.
    expect(emailConnect).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("email-account")).toBeNull();
  });

  it("prefills the lookback select with 30 days and allows 7/90", async () => {
    render(<EmailAlertsPanel />);
    await waitFor(() => expect(screen.getByLabelText(/Initial sync lookback/i)).toBeTruthy());
    const select = screen.getByLabelText(/Initial sync lookback/i) as HTMLSelectElement;
    expect(select.value).toBe("30");
    const values = Array.from(select.options).map((option) => option.value);
    expect(values).toEqual(["7", "30", "90"]);
  });
});

describe("credential availability gate", () => {
  it("never collects a password when the OS keychain is unavailable", async () => {
    available = false;
    render(<EmailAlertsPanel />);
    await waitFor(() =>
      expect(screen.getByText(/no working system keychain/i)).toBeTruthy(),
    );
    expect(screen.queryByLabelText(PASSWORD_FIELD)).toBeNull();
    expect(screen.queryByRole("button", { name: "Connect" })).toBeNull();
  });

  it("renders nothing outside the desktop app", () => {
    desktopEnabled = false;
    // Nothing resolves, so no post-unmount state updates: the panel must
    // render nothing without a bridge.
    emailStatus.mockReturnValue(new Promise(() => {}));
    const { container } = render(<EmailAlertsPanel />);
    expect(container.textContent).toBe("");
  });
});

describe("connected state", () => {
  it("shows the connected account and offers disconnect", async () => {
    emailStatus.mockResolvedValue({
      state: "connected",
      provider: "gmail",
      email: "user@gmail.com",
      lastConnectedAt: "2026-09-03T10:00:00.000Z",
      lastError: null,
      credential: { connected: true, savedAt: "2026-09-03T10:00:00.000Z" },
    });
    const user = userEvent.setup();
    render(<EmailAlertsPanel />);
    await waitFor(() => expect(screen.getByText("user@gmail.com")).toBeTruthy());
    // Exact match: the card title is "Connected account", the status is "Connected".
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.queryByLabelText(PASSWORD_FIELD)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(emailDisconnect).toHaveBeenCalledOnce());
    // Disconnect clears the renderer's persisted config too.
    expect(window.localStorage.getItem("email-account")).toBeNull();
  });
});

describe("restart reconnect", () => {
  it("reconnects passwordlessly from the stored credential when the app relaunched", async () => {
    // Persisted config exists (survived the restart); main's in-memory
    // connection state does not. The panel must reconnect with an EMPTY
    // password — main reveals the stored credential — and then show the
    // connected card (with the review queue), not the connect form.
    window.localStorage.setItem(
      "email-account",
      JSON.stringify({
        provider: "gmail",
        email: "user@gmail.com",
        host: "imap.gmail.com",
        port: 993,
        security: "tls",
        initialLookbackDays: 30,
        initialSyncDone: true,
        lastSyncAt: null,
      }),
    );
    let connected = false;
    emailStatus.mockImplementation(async () => ({
      state: connected ? "connected" : "not-connected",
      provider: connected ? "gmail" : null,
      email: connected ? "user@gmail.com" : null,
      lastConnectedAt: connected ? "2026-09-11T12:00:00.000Z" : null,
      lastError: null,
      credential: { connected: true, savedAt: "2026-09-11T12:00:00.000Z" },
    }));
    emailConnect.mockImplementation(async (payload: { password?: string }) => {
      if (payload?.password === "") {
        connected = true;
        return { ok: true, state: "connected" };
      }
      return { ok: false, category: "auth" };
    });
    render(<EmailAlertsPanel />);
    await waitFor(() =>
      expect(screen.getByText("user@gmail.com")).toBeTruthy(),
    );
    expect(screen.getByText("Connected")).toBeTruthy();
    // The reconnect crossed IPC ONCE, with the empty password — never a
    // re-collected secret.
    expect(emailConnect).toHaveBeenCalledTimes(1);
    expect(emailConnect.mock.calls[0][0].password).toBe("");
  });
});
