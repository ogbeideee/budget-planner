"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ShieldCheckIcon } from "@/components/ui/icons";
import {
  ALERT_SENDERS,
} from "@/lib/emailAlerts";
import {
  DEFAULT_LOOKBACK_DAYS,
  GMAIL_DEFAULTS,
  LOOKBACK_DAYS_CHOICES,
  loadEmailAccountConfig,
  normalizeEmailAccountConfig,
  clearEmailAccountConfig,
  saveEmailAccountConfig,
  type EmailAccountConfig,
  type EmailProvider,
} from "@/lib/emailAccount";
import {
  availabilityMessage,
  connectEmailAccount,
  credentialAvailability,
  disconnectEmailAccount,
  emailConnectionStatusReport,
  testEmailConnection,
} from "@/lib/emailCredentials";
import { isDesktop } from "@/lib/desktop";
import type {
  EmailConnectionState,
  EmailConnectionStatusReport,
} from "@/lib/desktop";
import { useToast } from "@/hooks/useToast";
import {
  reportEmailAccountToMain,
  runEmailCheck,
} from "@/lib/emailSyncBridge";
import { useEmailSync } from "@/store/useEmailSync";

/**
 * Email alerts settings (FR-24, transport phase).
 *
 * Desktop-only: the app password can only be stored in the OS keychain via
 * the main process, and all IMAP networking happens there too — a browser tab
 * has neither, so this panel renders nothing outside Electron (the section is
 * also hidden from the settings nav in that case).
 *
 * The four disclosures below are REQUIRED before any field is shown
 * (docs/15_EMAIL_PARSING.md, "What the user must be told").
 *
 * The app password lives ONLY in the form's local state. It is cleared the
 * moment a connect attempt finishes — win or lose — and is never persisted,
 * never put in the store, and never written to localStorage.
 */

const PROVIDER_OPTIONS = [
  { value: "gmail", label: "Gmail" },
  { value: "generic", label: "Other IMAP (Generic)" },
];

const SECURITY_OPTIONS = [
  { value: "tls", label: "TLS (implicit, usually port 993)" },
  { value: "starttls", label: "STARTTLS (usually port 143)" },
  { value: "none", label: "No encryption (not recommended)" },
];

const LOOKBACK_OPTIONS = LOOKBACK_DAYS_CHOICES.map((days) => ({
  value: String(days),
  label: `Last ${days} days${days === DEFAULT_LOOKBACK_DAYS ? " (recommended)" : ""}`,
}));

const STATE_LABELS: Record<EmailConnectionState, string> = {
  "not-connected": "Not connected",
  connecting: "Connecting…",
  connected: "Connected",
  "auth-failed": "Authentication failed",
  "connection-failed": "Connection failed",
  disconnected: "Disconnected",
};

/** The four required disclosures, before any credential field appears. */
function DisclosureCard() {
  return (
    <Card
      title="What connecting email does"
      subtitle="Read this before connecting an account."
    >
      <ul className="flex flex-col gap-3 text-sm leading-relaxed text-muted">
        <li className="flex gap-2.5">
          <ShieldCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
          <span>
            It reads <strong className="text-ink">only</strong> transaction
            alerts from a fixed list of bank senders. The rest of your inbox is
            never opened:{" "}
            {ALERT_SENDERS.map((sender) => sender.label).join(", ")}.
          </span>
        </li>
        <li className="flex gap-2.5">
          <ShieldCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
          <span>
            Email content is processed{" "}
            <strong className="text-ink">on this computer</strong> and is never
            sent anywhere.
          </span>
        </li>
        <li className="flex gap-2.5">
          <ShieldCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
          <span>
            It <strong className="text-ink">never</strong> sends mail, moves
            money, or changes anything in the mailbox — no marks as read, no
            deletes, no moves.
          </span>
        </li>
        <li className="flex gap-2.5">
          <ShieldCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
          <span>
            Every detected transaction is a{" "}
            <strong className="text-ink">draft you confirm</strong>; nothing is
            saved automatically.
          </span>
        </li>
      </ul>
      <p className="mt-4 rounded-lg bg-brand-500/[0.06] px-3 py-2.5 text-sm leading-relaxed text-muted">
        You will need an <strong className="text-ink">app password</strong>, not
        your normal account password. For Gmail: turn on 2-Step Verification,
        then Google Account → Security → 2-Step Verification → App passwords.
        Your password is encrypted with this computer&apos;s keychain and is
        never readable by the app itself.
      </p>
    </Card>
  );
}

interface FormDraft {
  provider: EmailProvider;
  email: string;
  host: string;
  port: string;
  security: "tls" | "starttls" | "none";
  password: string;
  initialLookbackDays: string;
}

function draftFromConfig(config: EmailAccountConfig | null): FormDraft {
  return {
    provider: config?.provider ?? "gmail",
    email: config?.email ?? "",
    host: config?.provider === "generic" ? config.host : GMAIL_DEFAULTS.host,
    port: String(config?.provider === "generic" ? config.port : GMAIL_DEFAULTS.port),
    security:
      config?.provider === "generic" ? config.security : GMAIL_DEFAULTS.security,
    // Deliberately NOT seeded from anywhere: the password is never persisted.
    password: "",
    initialLookbackDays: String(
      config?.initialLookbackDays ?? DEFAULT_LOOKBACK_DAYS,
    ),
  };
}

function ConnectForm({
  initialConfig,
  onConnected,
}: {
  initialConfig: EmailAccountConfig | null;
  onConnected: () => void;
}) {
  const { success } = useToast();
  // A form draft seeded once — the codebase's keyed-remount pattern handles
  // re-seeding (the panel bumps a session key after connect/disconnect).
  const [draft, setDraft] = useState(() => draftFromConfig(initialConfig));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isGmail = draft.provider === "gmail";

  const patch = (next: Partial<FormDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
  };

  const switchProvider = (provider: EmailProvider) => {
    if (provider === "gmail") {
      patch({
        provider,
        host: GMAIL_DEFAULTS.host,
        port: String(GMAIL_DEFAULTS.port),
        security: GMAIL_DEFAULTS.security,
      });
    } else {
      patch({ provider });
    }
  };

  async function handleSubmit(kind: "connect" | "test") {
    setError(null);
    setFieldErrors({});

    const raw = {
      provider: draft.provider,
      email: draft.email,
      host: draft.host,
      port: draft.port,
      security: draft.security,
      initialLookbackDays: Number(draft.initialLookbackDays),
    };
    const normalized = normalizeEmailAccountConfig(raw);
    if (!normalized.ok) {
      setFieldErrors(normalized.errors);
      return;
    }
    if (kind === "connect" && draft.password.length === 0) {
      setFieldErrors({ password: "Enter the app password from your email provider." });
      return;
    }

    setBusy(true);
    try {
      const result =
        kind === "connect"
          ? await connectEmailAccount(normalized.config, draft.password)
          : await testEmailConnection(normalized.config, draft.password);

      if (!result.ok) {
        setError(result.message ?? "The connection failed. Try again.");
        return;
      }

      if (kind === "connect") {
        // Persist the NON-SECRET config through the storage seam. The sync
        // metadata fields start unset — the sync operation stamps them.
        saveEmailAccountConfig({
          ...normalized.config,
          initialSyncDone: false,
          lastSyncAt: null,
        });
        // Tell main so the scheduler runs and the tray item appears — and run
        // the initial lookback sync right away (main opens the session
        // read-only; the drafts flow back through the delivery event).
        void reportEmailAccountToMain(normalized.config);
        void runEmailCheck();
        success("Email account connected.");
        onConnected();
      } else {
        success("Connection test succeeded.");
      }
    } finally {
      // The password leaves component state the moment the attempt finishes,
      // whatever the outcome.
      patch({ password: "" });
      setBusy(false);
    }
  }

  return (
    <Card
      title="Connect an email account"
      subtitle="One account for now. Bank transaction alerts are read from its inbox, read-only."
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit("connect");
        }}
      >
        <Select
          label="Provider"
          options={PROVIDER_OPTIONS}
          value={draft.provider}
          error={fieldErrors.provider}
          onChange={(event) => switchProvider(event.target.value as EmailProvider)}
        />
        <Input
          label="Email address"
          type="email"
          autoComplete="off"
          value={draft.email}
          error={fieldErrors.email}
          onChange={(event) => patch({ email: event.target.value })}
        />
        {isGmail ? (
          <p className="text-sm leading-relaxed text-muted">
            Gmail&apos;s IMAP server is used automatically
            ({GMAIL_DEFAULTS.host}, port {GMAIL_DEFAULTS.port}, TLS).
          </p>
        ) : (
          <>
            <Input
              label="IMAP server"
              placeholder="imap.example.com"
              autoComplete="off"
              value={draft.host}
              error={fieldErrors.host}
              onChange={(event) => patch({ host: event.target.value })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Port"
                type="number"
                min={1}
                max={65535}
                value={draft.port}
                error={fieldErrors.port}
                onChange={(event) => patch({ port: event.target.value })}
              />
              <Select
                label="Security"
                options={SECURITY_OPTIONS}
                value={draft.security}
                onChange={(event) =>
                  patch({ security: event.target.value as FormDraft["security"] })
                }
              />
            </div>
          </>
        )}
        <Input
          label="App password"
          type="password"
          autoComplete="new-password"
          value={draft.password}
          error={fieldErrors.password}
          onChange={(event) => patch({ password: event.target.value })}
        />
        <Select
          label="Initial sync lookback"
          options={LOOKBACK_OPTIONS}
          value={draft.initialLookbackDays}
          error={fieldErrors.initialLookbackDays}
          onChange={(event) => patch({ initialLookbackDays: event.target.value })}
        />
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? "Connecting…" : "Connect"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void handleSubmit("test")}
          >
            Test connection
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ConnectedCard({
  config,
  status,
  onDisconnect,
}: {
  config: EmailAccountConfig | null;
  status: EmailConnectionStatusReport | null;
  onDisconnect: () => void;
}) {
  const { success } = useToast();
  const [lookback, setLookback] = useState(
    String(config?.initialLookbackDays ?? DEFAULT_LOOKBACK_DAYS),
  );
  const [busy, setBusy] = useState(false);

  const updateLookback = (value: string) => {
    setLookback(value);
    if (config) {
      saveEmailAccountConfig({
        ...config,
        initialLookbackDays: Number(value) as 7 | 30 | 90,
      });
      success("Initial sync lookback saved.");
    }
  };

  const email = status?.email ?? config?.email ?? "";
  const provider = status?.provider ?? config?.provider ?? "gmail";

  // Sync surface (FR-24, sync stage): manual check + the review queue. The
  // manual check calls the SAME canonical operation the 30-minute scheduler and
  // the tray item call — never a separate flow.
  const draftCount = useEmailSync((s) => s.drafts.length);
  const setReviewOpen = useEmailSync((s) => s.setReviewOpen);
  const checkRunning = useEmailSync((s) => s.checkRunning);
  const syncStatus = useEmailSync((s) => s.syncStatus);
  const setCheckRunning = useEmailSync((s) => s.setCheckRunning);

  const handleCheckNow = () => {
    setCheckRunning(true);
    void runEmailCheck().then(() => {
      // The result summary event clears the flag; this is a safety reset if
      // main answered without delivering a summary (not configured, etc.).
      setTimeout(() => setCheckRunning(false), 1500);
    });
  };

  async function handleDisconnect() {
    setBusy(true);
    try {
      await disconnectEmailAccount();
      clearEmailAccountConfig();
      // Main stops the scheduler and hides the tray item; local drafts for
      // this account are cleared (the mailbox itself is untouched — read-only
      // throughout).
      void reportEmailAccountToMain(null);
      useEmailSync.getState().clearDrafts();
      success("Email account disconnected. The stored password was removed.");
      onDisconnect();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Connected account">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-ink">{email}</p>
            <p className="mt-1 text-sm text-muted">
              {provider === "gmail" ? "Gmail" : "Generic IMAP"} ·{" "}
              <span className="font-medium text-success">
                {STATE_LABELS["connected"]}
              </span>
              {status?.lastConnectedAt
                ? ` · last verified ${new Date(status.lastConnectedAt).toLocaleString()}`
                : ""}
            </p>
          </div>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void handleDisconnect()}
          >
            Disconnect
          </Button>
        </div>
        <Select
          label="Initial sync lookback"
          options={LOOKBACK_OPTIONS}
          value={lookback}
          onChange={(event) => updateLookback(event.target.value)}
        />
        <p className="text-sm leading-relaxed text-muted">
          Alerts are fetched read-only when you check for them — nothing is
          marked as read, deleted, or moved. Detected transactions appear as
          drafts to confirm; nothing is saved automatically.
        </p>

        <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight text-ink">
                Check for new alerts
              </p>
              <p className="mt-1 text-sm text-muted">
                {checkRunning
                  ? "Checking your inbox…"
                  : syncStatus?.lastSyncAt
                    ? `Last check ${new Date(syncStatus.lastSyncAt).toLocaleString()}`
                    : "Not checked yet this session."}
                {syncStatus?.lastResult && !syncStatus.lastResult.ok
                  ? ` · last check failed (${syncStatus.lastResult.category ?? "error"})`
                  : ""}
              </p>
            </div>
            <Button
              variant="secondary"
              disabled={busy || checkRunning}
              onClick={handleCheckNow}
            >
              {checkRunning ? "Checking…" : "Check now"}
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3">
            <p className="text-sm text-muted">
              {draftCount === 0
                ? "No alerts waiting for review."
                : `${draftCount} alert${draftCount === 1 ? "" : "s"} waiting for review.`}
            </p>
            {draftCount > 0 && (
              <Button
                variant="secondary"
                onClick={() => setReviewOpen(true)}
              >
                Review drafts
              </Button>
            )}
          </div>
          <p className="text-xs leading-relaxed text-muted">
            New alerts are also checked automatically every 30 minutes while the app
            is running, and from the tray&apos;s &quot;Check for new alerts
            now&quot; item. Fully-read alerts with a confirmed category are
            imported straight away; anything incomplete waits here.
          </p>
        </div>
      </div>
    </Card>
  );
}

/**
 * The panel itself. Desktop-only (the section is also hidden from the nav in
 * a browser): the vault needs the OS keychain and the transport needs the
 * main process, neither of which a page can reach.
 */
export function EmailAlertsPanel() {
  const [availability, setAvailability] = useState<Awaited<
    ReturnType<typeof credentialAvailability>
  > | null>(null);
  const [status, setStatus] = useState<EmailConnectionStatusReport | null>(null);
  // Session key: bump to remount the form with fresh draft state after a
  // connect or disconnect, and to re-read the persisted config.
  const [session, setSession] = useState(0);
  const [config, setConfig] = useState<EmailAccountConfig | null>(() =>
    loadEmailAccountConfig(),
  );

  useEffect(() => {
    let cancelled = false;
    void credentialAvailability().then((result) => {
      if (!cancelled) setAvailability(result);
    });
    void emailConnectionStatusReport().then(async (report) => {
      if (cancelled) return;
      // Passwordless reconnect: the vault keeps the app password across app
      // restarts, but main's connection state does not. Without this, every
      // relaunch showed the connect form again (hiding the review queue) even
      // though the credential is still stored. Connect with an EMPTY password
      // — main reveals the stored one; it fails harmlessly when none exists.
      if (
        report &&
        report.state !== "connected" &&
        loadEmailAccountConfig() !== null
      ) {
        const reconnect = await connectEmailAccount(loadEmailAccountConfig(), "");
        if (!cancelled && reconnect.ok) {
          const refreshed = await emailConnectionStatusReport();
          if (refreshed) {
            setStatus(refreshed);
            return;
          }
        }
      }
      if (!cancelled && report) setStatus(report);
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (!isDesktop()) return null;

  // Availability is checked BEFORE any password field renders — the machine
  // must be able to protect a secret before the user is asked for one.
  if (availability && !availability.available) {
    return (
      <div className="flex flex-col gap-6">
        <h3 className="text-card-title font-bold tracking-tight text-ink">
          Email alerts
        </h3>
        <Card>
          <p className="text-sm leading-relaxed text-muted">
            {availabilityMessage(availability.reason)}
          </p>
        </Card>
      </div>
    );
  }

  const connected = status?.state === "connected";

  return (
    <div className="flex flex-col gap-6">
      <div className="min-w-0">
        <h3 className="text-card-title font-bold tracking-tight text-ink">
          Email alerts
        </h3>
        <p className="mt-1 text-sm text-muted">
          Read bank transaction alerts from your inbox and turn them into draft
          transactions you confirm.
        </p>
      </div>

      <DisclosureCard />

      {connected ? (
        <ConnectedCard
          key={session}
          config={config}
          status={status}
          onDisconnect={() => {
            setConfig(null);
            setStatus(null);
            setSession((current) => current + 1);
          }}
        />
      ) : (
        <ConnectForm
          key={session}
          initialConfig={config}
          onConnected={() => {
            setConfig(loadEmailAccountConfig());
            setSession((current) => current + 1);
          }}
        />
      )}
    </div>
  );
}
