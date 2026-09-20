import { useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { LIMITS } from "./profileDraft";

/**
 * Free-text list entry: type, press Enter or comma, get a removable pill.
 * `hidden` lets a caller keep some values out of the pill row because it
 * already shows them another way (the preset must-have chips).
 */
export function TagInput({
  id,
  values,
  onChange,
  placeholder,
  addLabel,
  hidden,
  describedBy,
}: {
  id: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  addLabel: string;
  hidden?: (value: string) => boolean;
  describedBy?: string;
}) {
  const [text, setText] = useState("");
  const full = values.length >= LIMITS.listItems;

  function commit() {
    const additions = text
      .split(",")
      .map((part) => part.trim().replace(/\s+/g, " ").slice(0, LIMITS.listItemChars))
      .filter(Boolean);
    if (additions.length === 0) return;
    const next = [...values];
    for (const item of additions) {
      const taken = next.some((existing) => existing.toLowerCase() === item.toLowerCase());
      if (!taken && next.length < LIMITS.listItems) next.push(item);
    }
    onChange(next);
    setText("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      // Enter must never submit the surrounding form half-way through a list.
      event.preventDefault();
      commit();
    } else if (event.key === "Backspace" && text === "" && values.length > 0) {
      const lastShown = [...values].reverse().find((value) => !hidden?.(value));
      if (lastShown !== undefined) onChange(values.filter((value) => value !== lastShown));
    }
  }

  const shown = values.filter((value) => !hidden?.(value));

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id={id}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          placeholder={full ? "That's the most Nestor can track" : placeholder}
          disabled={full}
          maxLength={LIMITS.listItemChars}
          aria-describedby={describedBy}
          autoComplete="off"
        />
        <Button
          variant="secondary"
          onClick={commit}
          disabled={full || text.trim() === ""}
          icon={<Plus className="size-4" aria-hidden="true" />}
          aria-label={addLabel}
        >
          Add
        </Button>
      </div>
      {shown.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {shown.map((value) => (
            <li
              key={value}
              className="animate-rise inline-flex items-center gap-1 rounded-full border border-forest/15 bg-forest-soft py-1 pl-3 pr-1 text-sm text-forest-deep"
            >
              <span className="[overflow-wrap:anywhere]">{value}</span>
              <button
                type="button"
                onClick={() => onChange(values.filter((item) => item !== value))}
                aria-label={`Remove ${value}`}
                className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-forest transition-colors hover:bg-forest hover:text-paper"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
