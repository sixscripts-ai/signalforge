"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format";

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

type ApiKeySettingsProps = {
  keys: ApiKey[];
};

export default function ApiKeySettings({ keys }: ApiKeySettingsProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<{
    id: string;
    name: string;
    rawKey: string;
  } | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setIsSaving(true);
    setError(null);
    setCreatedKey(null);

    try {
      const body: Record<string, string> = { name };
      if (hasExpiry && expiresAt) {
        body.expiresAt = new Date(expiresAt).toISOString();
      }

      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create API key");
      } else {
        setCreatedKey({ id: data.key.id, name: data.key.name, rawKey: data.key.rawKey });
        setName("");
        setHasExpiry(false);
        setExpiresAt("");
        router.refresh();
      }
    } catch {
      setError("An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this API key? Any services using it will stop working.")) return;

    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete API key");
      } else {
        router.refresh();
      }
    } catch {
      alert("An error occurred");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text)]">API Keys</h3>
          <p className="text-sm text-[var(--muted)]">
            Programmatically access your data via the SignalForge API.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm(!showForm);
            setCreatedKey(null);
          }}
          className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)]"
        >
          {showForm ? "Cancel" : "Create Key"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-4 space-y-4"
        >
          {error && <p className="text-red-500 text-sm">{error}</p>}

          {createdKey && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm space-y-1">
              <p className="text-emerald-400 font-semibold">API key created!</p>
              <p className="text-[var(--muted)]">
                Copy this key now. You won&apos;t be able to see it again.
              </p>
              <code className="block mt-1 rounded bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text)] break-all select-all">
                {createdKey.rawKey}
              </code>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Key Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., CI Pipeline"
              className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent-border)]"
              required
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasExpiry}
                onChange={(e) => setHasExpiry(e.target.checked)}
                className="rounded border-[var(--border)] bg-[var(--bg)] text-[var(--accent)] focus:ring-[var(--accent)]"
              />
              <span className="text-sm text-[var(--text)]">Set expiration</span>
            </label>
            {hasExpiry && (
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent-border)]"
                required
              />
            )}
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)] disabled:opacity-50"
          >
            {isSaving ? "Creating..." : "Create API Key"}
          </button>
        </form>
      )}

      {keys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-sm text-[var(--muted)]">No API keys created yet.</p>
        </div>
      ) : (
        <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--panel)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--panel-soft)] border-b border-[var(--border)]">
              <tr>
                <th className="px-4 py-3 font-medium text-[var(--muted)]">Name</th>
                <th className="px-4 py-3 font-medium text-[var(--muted)]">Key</th>
                <th className="px-4 py-3 font-medium text-[var(--muted)]">Last Used</th>
                <th className="px-4 py-3 font-medium text-[var(--muted)]">Expires</th>
                <th className="px-4 py-3 font-medium text-[var(--muted)]">Created</th>
                <th className="px-4 py-3 font-medium text-[var(--muted)] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {keys.map((key) => (
                <tr key={key.id} className="hover:bg-white/5">
                  <td className="px-4 py-3 text-[var(--text)]">{key.name}</td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-[var(--bg)] px-2 py-0.5 text-xs text-[var(--muted)] font-mono">
                      {key.keyPrefix}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)] text-xs">
                    {key.lastUsedAt ? formatDateTime(key.lastUsedAt) : "Never"}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)] text-xs">
                    {key.expiresAt ? formatDateTime(key.expiresAt) : "Never"}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)] text-xs">
                    {formatDateTime(key.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(key.id)}
                      className="rounded-lg border border-rose-500/30 px-3 py-1 text-xs text-rose-400 transition hover:bg-rose-500/10"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
