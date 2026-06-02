"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format";

type Webhook = {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: string;
  lastSentAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  createdAt: string;
};

type WebhookSettingsProps = {
  webhooks: Webhook[];
};

const AVAILABLE_EVENTS = [
  { value: "import.completed", label: "Import Completed" },
  { value: "import.failed", label: "Import Failed" },
  { value: "import.started", label: "Import Started" },
];

export default function WebhookSettings({ webhooks }: WebhookSettingsProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["import.completed"]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url || !selectedEvents.length) return;

    setIsSaving(true);
    setError(null);
    setCreatedSecret(null);

    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url, events: selectedEvents }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create webhook");
      } else {
        setCreatedSecret(data.webhook.signingSecret);
        setName("");
        setUrl("");
        setSelectedEvents(["import.completed"]);
        router.refresh();
      }
    } catch {
      setError("An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (id: string, currentActive: string) => {
    try {
      await fetch(`/api/webhooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: currentActive === "true" ? "false" : "true" }),
      });
      router.refresh();
    } catch {
      alert("Failed to update webhook");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this webhook?")) return;

    try {
      const res = await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete webhook");
      } else {
        router.refresh();
      }
    } catch {
      alert("An error occurred");
    }
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text)]">Webhook Endpoints</h3>
          <p className="text-sm text-[var(--muted)]">
            Receive real-time notifications when imports complete or fail.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)]"
        >
          {showForm ? "Cancel" : "Add Webhook"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-4 space-y-4"
        >
          {error && <p className="text-red-500 text-sm">{error}</p>}

          {createdSecret && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm space-y-1">
              <p className="text-emerald-400 font-semibold">Webhook created!</p>
              <p className="text-[var(--muted)]">
                Copy this signing secret now. You won&apos;t be able to see it again.
              </p>
              <code className="block mt-1 rounded bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text)] break-all select-all">
                {createdSecret}
              </code>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Production webhook"
                className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent-border)]"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Endpoint URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/webhooks/signalforge"
                className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent-border)]"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Events</label>
            <div className="flex flex-wrap gap-3">
              {AVAILABLE_EVENTS.map((event) => (
                <label
                  key={event.value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(event.value)}
                    onChange={() => toggleEvent(event.value)}
                    className="rounded border-[var(--border)] bg-[var(--bg)] text-[var(--accent)] focus:ring-[var(--accent)]"
                  />
                  <span className="text-sm text-[var(--text)]">{event.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)] disabled:opacity-50"
          >
            {isSaving ? "Creating..." : "Create Webhook"}
          </button>
        </form>
      )}

      {webhooks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-sm text-[var(--muted)]">No webhooks configured yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((hook) => (
            <div
              key={hook.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h4 className="text-sm font-semibold text-[var(--text)]">{hook.name}</h4>
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        hook.active === "true"
                          ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]"
                          : "bg-[var(--muted)]"
                      }`}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)] break-all">{hook.url}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(hook.events as string[]).map((evt) => (
                      <span
                        key={evt}
                        className="rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-2 py-0.5 text-[10px] text-[var(--muted)]"
                      >
                        {evt}
                      </span>
                    ))}
                  </div>
                  {hook.lastSentAt && (
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      Last sent: {formatDateTime(hook.lastSentAt)}
                      {hook.lastStatus === "failed" && hook.lastError && (
                        <span className="text-rose-400 ml-2">Error: {hook.lastError}</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggle(hook.id, hook.active)}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                      hook.active === "true"
                        ? "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
                        : "border-[var(--accent-border)] text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                    }`}
                  >
                    {hook.active === "true" ? "Pause" : "Resume"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(hook.id)}
                    className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs text-rose-400 transition hover:bg-rose-500/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
