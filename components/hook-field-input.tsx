"use client"

import { memo } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { FieldDefinition } from "@obibring/claude-hooks-cli/browser"

interface HookFieldInputProps {
  name: string
  field: FieldDefinition
  value: unknown
  onChange: (value: unknown) => void
}

export const HookFieldInput = memo(function HookFieldInput({
  name,
  field,
  value,
  onChange,
}: HookFieldInputProps) {
  const label = name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim()

  switch (field.type) {
    case "boolean":
      return (
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              className="size-4 rounded border-border/60 bg-background/60 accent-amber-400"
            />
            <span className="text-sm text-slate-300">{label}</span>
          </label>
          {field.description && (
            <p className="mt-1 text-xs text-slate-500 pl-6">{field.description}</p>
          )}
        </div>
      )

    case "number":
      return (
        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
            {label}
          </label>
          <Input
            type="number"
            value={value != null ? String(value) : ""}
            onChange={(e) => {
              const v = e.target.value
              onChange(v === "" ? undefined : Number(v))
            }}
            placeholder={field.description}
          />
        </div>
      )

    case "enum":
      return (
        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
            {label}
          </label>
          <select
            className="h-10 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm outline-none focus:border-amber-400/60"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value || undefined)}
          >
            <option value="">— select —</option>
            {field.values?.map((v: string) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          {!field.strict && (
            <p className="mt-1 text-[10px] text-slate-500">
              Or type a custom value below
            </p>
          )}
          {!field.strict && (
            <Input
              className="mt-1"
              value={
                typeof value === "string" &&
                !field.values?.includes(value)
                  ? value
                  : ""
              }
              onChange={(e) => onChange(e.target.value || undefined)}
              placeholder="Custom value"
            />
          )}
        </div>
      )

    case "string": {
      const isLong =
        name === "command" ||
        name === "prompt" ||
        field.description?.toLowerCase().includes("script") ||
        field.description?.toLowerCase().includes("multi")

      if (isLong) {
        return (
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
              {label}
            </label>
            <Textarea
              value={typeof value === "string" ? value : ""}
              onChange={(e) => onChange(e.target.value || undefined)}
              placeholder={field.description}
              className="min-h-[110px] font-mono text-[12px]"
            />
          </div>
        )
      }

      return (
        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
            {label}
          </label>
          <Input
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value || undefined)}
            placeholder={field.description}
          />
        </div>
      )
    }

    case "object": {
      const obj = (value != null && typeof value === "object" ? value : {}) as Record<string, unknown>
      return (
        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
            {label}
          </label>
          {field.description && (
            <p className="mb-2 text-[11px] text-slate-500">{field.description}</p>
          )}
          <div className="space-y-3 border-l-2 border-amber-400/20 pl-4">
            {field.fields &&
              Object.entries(field.fields).map(([childName, childField]) => (
                <HookFieldInput
                  key={childName}
                  name={childName}
                  field={childField}
                  value={obj[childName]}
                  onChange={(childValue) => {
                    const next = { ...obj }
                    if (childValue === undefined) {
                      delete next[childName]
                    } else {
                      next[childName] = childValue
                    }
                    onChange(Object.keys(next).length > 0 ? next : undefined)
                  }}
                />
              ))}
          </div>
        </div>
      )
    }

    default:
      return null
  }
})
