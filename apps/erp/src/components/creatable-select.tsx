"use client";

import { useRef, useState } from "react";

const inputBase =
  "w-full min-h-[44px] rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20";

interface Option {
  id: string;
  name: string;
  extra?: string;
}

interface CreatableSelectProps {
  /** Current selected value (id) */
  value: string;
  /** Label displayed above the field */
  label: string;
  /** Existing options */
  options: Option[];
  /** Placeholder text for the select */
  placeholder?: string;
  /** Called when an existing option is selected */
  onChange: (id: string) => void;
  /** Called when the user wants to create a new entry. Should return the new id. */
  onCreate: (name: string) => Promise<string | undefined>;
  /** Text for the "create new" option */
  createLabel?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether a creation is in progress */
  disabled?: boolean;
}

export function CreatableSelect({
  value,
  label,
  options,
  placeholder = "Seleccionar…",
  onChange,
  onCreate,
  createLabel = "+ Crear nuevo…",
  required,
  disabled,
}: CreatableSelectProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      const newId = await onCreate(trimmed);
      if (newId) {
        onChange(newId);
      }
      setIsCreating(false);
      setNewName("");
    } catch {
      // Error handled by parent via toast
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setNewName("");
  };

  return (
    <label className="block">
      <span className="text-muted-foreground mb-1 block text-xs font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </span>

      {isCreating ? (
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleCreate();
              }
              if (e.key === "Escape") handleCancel();
            }}
            placeholder={`Nombre del nuevo ${label.toLowerCase()}`}
            className={inputBase}
            disabled={saving}
            autoFocus
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving || !newName.trim()}
            className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-lg border transition-colors disabled:opacity-40"
            title="Confirmar"
          >
            <span className="material-symbols-outlined text-lg">check</span>
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="text-muted-foreground hover:text-destructive border-border flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-lg border transition-colors"
            title="Cancelar"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      ) : (
        <select
          value={value}
          onChange={(e) => {
            if (e.target.value === "__create__") {
              setIsCreating(true);
              // Focus the input after render
              requestAnimationFrame(() => inputRef.current?.focus());
            } else {
              onChange(e.target.value);
            }
          }}
          className={inputBase}
          disabled={disabled}
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
              {opt.extra ? ` — ${opt.extra}` : ""}
            </option>
          ))}
          <option value="__create__" className="font-medium">
            {createLabel}
          </option>
        </select>
      )}
    </label>
  );
}
