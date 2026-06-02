'use client';

import { useState, useEffect } from "react";

type Profile = {
  id: string;
  name: string;
};

type Template = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  schemaProfileId: string | null;
  config: Record<string, unknown>;
  sampleHeaders: string[] | null;
  isDefault: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  name: string;
  description: string;
  schemaProfileId: string;
  isDefault: boolean;
};

const emptyForm: FormState = { name: "", description: "", schemaProfileId: "", isDefault: false };

export default function ImportTemplateSettings({ profiles }: { profiles: Profile[] }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true); // starts true — no sync setState in effect
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchTemplates = async (signal?: AbortSignal) => {
    const res = await fetch("/api/import-templates", { signal });
    if (!res.ok) throw new Error("Failed to load templates");
    return (await res.json()) as Template[];
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchTemplates();
        if (!cancelled) setTemplates(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load templates");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setError("Template name is required.");
      return;
    }
    if (!form.schemaProfileId) {
      setError("Please select a schema profile.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/import-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          schemaProfileId: form.schemaProfileId,
          isDefault: form.isDefault,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? "Failed to create template");
      }
      resetForm();
      setTemplates(await fetchTemplates());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    if (!form.name.trim()) {
      setError("Template name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim(),
        isDefault: form.isDefault,
      };
      if (form.schemaProfileId) {
        body.schemaProfileId = form.schemaProfileId;
      }

      const res = await fetch(`/api/import-templates/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? "Failed to update template");
      }
      resetForm();
      setTemplates(await fetchTemplates());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update template");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (template: Template) => {
    if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/import-templates/${template.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete template");
      setTemplates(await fetchTemplates());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    }
  };

  const handleEdit = (template: Template) => {
    setForm({
      name: template.name,
      description: template.description ?? "",
      schemaProfileId: template.schemaProfileId ?? "",
      isDefault: template.isDefault === "true",
    });
    setEditingId(template.id);
    setShowForm(true);
    setError(null);
  };

  const handleToggleDefault = async (template: Template) => {
    const newDefault = template.isDefault !== "true";
    try {
      const res = await fetch(`/api/import-templates/${template.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: newDefault }),
      });
      if (!res.ok) throw new Error("Failed to update default");
      setTemplates(await fetchTemplates());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update default");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[var(--text)]">Import Templates</h3>
          <p className="text-xs text-[var(--muted)]">
            Save reusable import configurations for different data sources.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)]"
          >
            + New Template
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
          {error}
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-4 space-y-3">
          <h4 className="text-sm font-medium text-[var(--text)]">
            {editingId ? "Edit Template" : "New Template"}
          </h4>
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. HubSpot Export"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent-border)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional description of this template"
              rows={2}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent-border)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">Schema Profile</label>
            <select
              value={form.schemaProfileId}
              onChange={(e) => setForm({ ...form, schemaProfileId: e.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent-border)]"
            >
              <option value="">Select a schema profile...</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              className="rounded border-[var(--border)]"
            />
            <span className="text-xs text-[var(--muted)]">Set as default template</span>
          </label>
          <div className="flex gap-2 pt-1">
            <button
              onClick={editingId ? handleUpdate : handleCreate}
              disabled={saving}
              className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)] disabled:opacity-50"
            >
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
            </button>
            <button
              onClick={resetForm}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] transition hover:text-[var(--text)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Template List */}
      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-6 text-center text-xs text-[var(--muted)]">
          Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-6 text-center text-xs text-[var(--muted)]">
          No import templates yet. Create one to reuse import configurations.
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text)] truncate">{t.name}</span>
                  {t.isDefault === "true" && (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
                      Default
                    </span>
                  )}
                </div>
                {t.description && (
                  <p className="text-xs text-[var(--muted)] truncate mt-0.5">{t.description}</p>
                )}
                <p className="text-[10px] text-[var(--muted)] mt-0.5">
                  {profiles.find((p) => p.id === t.schemaProfileId)?.name ?? "No profile"}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleToggleDefault(t)}
                  title={t.isDefault === "true" ? "Remove default" : "Set as default"}
                  className="rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--muted)] transition hover:text-[var(--text)]"
                >
                  {t.isDefault === "true" ? "★" : "☆"}
                </button>
                <button
                  onClick={() => handleEdit(t)}
                  className="rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--muted)] transition hover:text-[var(--text)]"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(t)}
                  className="rounded-lg border border-rose-500/30 px-2 py-1 text-[11px] text-rose-300 transition hover:bg-rose-500/10"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
