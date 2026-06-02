"use client";

import { useState } from "react";
import { SchemaProfileConfig } from "@/lib/schema-profile";

export default function SchemaProfileForm({ initialProfile }: { initialProfile: SchemaProfileConfig }) {
  const [profile, setProfile] = useState<SchemaProfileConfig>(initialProfile);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/schema-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      if (!res.ok) {
        throw new Error("Failed to save profile");
      }

      const updated = await res.json();
      setProfile(updated);
      setMessage({ type: "success", text: "Profile saved successfully." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "An error occurred." });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCleanup = (key: keyof SchemaProfileConfig["cleanupRules"]) => {
    setProfile(prev => ({
      ...prev,
      cleanupRules: {
        ...prev.cleanupRules,
        [key]: !prev.cleanupRules[key]
      }
    }));
  };

  const handleAddFieldMapping = () => {
    setProfile(prev => ({
      ...prev,
      fieldMappings: { ...prev.fieldMappings, "": "" }
    }));
  };

  const handleUpdateFieldMapping = (oldKey: string, newKey: string, val: string) => {
    setProfile(prev => {
      const newMappings = { ...prev.fieldMappings };
      if (oldKey !== newKey) {
        delete newMappings[oldKey];
      }
      newMappings[newKey] = val;
      return { ...prev, fieldMappings: newMappings };
    });
  };

  const handleDeleteFieldMapping = (key: string) => {
    setProfile(prev => {
      const newMappings = { ...prev.fieldMappings };
      delete newMappings[key];
      return { ...prev, fieldMappings: newMappings };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--text)]">Active Schema Profile</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-[var(--text)] px-4 py-2 text-sm font-medium text-[var(--bg)] transition hover:bg-[var(--text)]/90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </div>

      {message && (
        <div className={`rounded-xl p-4 text-sm ${message.type === "success" ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text)]">Profile Name</label>
          <input
            type="text"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            className="mt-1 block w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--text)] focus:outline-none"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Cleanup Rules */}
          <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
            <h3 className="text-sm font-semibold text-[var(--text)]">Cleanup Rules</h3>
            <div className="space-y-2">
              {Object.entries(profile.cleanupRules).map(([key, value]) => (
                <label key={key} className="flex items-center space-x-2 text-sm text-[var(--text)]">
                  <input
                    type="checkbox"
                    checked={value as boolean}
                    onChange={() => handleToggleCleanup(key as keyof SchemaProfileConfig["cleanupRules"])}
                    className="rounded border-[var(--border)] bg-[var(--panel)] text-[var(--text)] focus:ring-[var(--text)]"
                  />
                  <span>{key}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Field Mappings */}
          <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text)]">Field Mappings</h3>
              <button onClick={handleAddFieldMapping} className="text-xs font-medium text-[var(--muted)] hover:text-[var(--text)]">+ Add Mapping</button>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto pr-2">
              {Object.entries(profile.fieldMappings).map(([key, val], i) => (
                <div key={`${key}-${i}`} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={key}
                    placeholder="CSV Header"
                    onChange={(e) => handleUpdateFieldMapping(key, e.target.value, val)}
                    className="w-1/2 rounded-md border border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-xs text-[var(--text)] focus:border-[var(--text)] focus:outline-none"
                  />
                  <span className="text-[var(--muted)]">→</span>
                  <input
                    type="text"
                    value={val}
                    placeholder="System Field"
                    onChange={(e) => handleUpdateFieldMapping(key, key, e.target.value)}
                    className="w-1/2 rounded-md border border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-xs text-[var(--text)] focus:border-[var(--text)] focus:outline-none"
                  />
                  <button onClick={() => handleDeleteFieldMapping(key)} className="text-red-500 hover:text-red-400">✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Required Fields */}
          <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
            <h3 className="text-sm font-semibold text-[var(--text)]">Required Fields</h3>
            <input
              type="text"
              value={profile.requiredFields.join(", ")}
              onChange={(e) => setProfile({ ...profile, requiredFields: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
              placeholder="e.g. email, name"
              className="block w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--text)] focus:outline-none"
            />
            <p className="text-xs text-[var(--muted)]">Comma separated list of required canonical fields.</p>
          </div>

          {/* Dedupe Strategy */}
          <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
            <h3 className="text-sm font-semibold text-[var(--text)]">Dedupe Strategy</h3>
            <label className="flex items-center space-x-2 text-sm text-[var(--text)]">
              <input
                type="checkbox"
                checked={profile.dedupeStrategy.enabled}
                onChange={(e) => setProfile({ ...profile, dedupeStrategy: { ...profile.dedupeStrategy, enabled: e.target.checked } })}
                className="rounded border-[var(--border)] bg-[var(--panel)] text-[var(--text)] focus:ring-[var(--text)]"
              />
              <span>Enabled</span>
            </label>
            <input
              type="text"
              value={profile.dedupeStrategy.fields.join(", ")}
              onChange={(e) => setProfile({ ...profile, dedupeStrategy: { ...profile.dedupeStrategy, fields: e.target.value.split(",").map(s => s.trim()).filter(Boolean) } })}
              placeholder="e.g. email, externalId"
              className="block w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--text)] focus:outline-none"
            />
            <p className="text-xs text-[var(--muted)]">Comma separated list of fallback fields to form dedupe keys.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
