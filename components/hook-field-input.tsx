"use client"

import { memo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
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
  const required = !!field.required

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
            <span className="text-sm text-slate-300">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</span>
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
            {label}{required && <span className="text-red-400 ml-0.5">*</span>}
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

    case "enum": {
      const current = typeof value === "string" ? value : ""
      return (
        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
            {label}{required && <span className="text-red-400 ml-0.5">*</span>}
          </label>
          <Select
            value={current || undefined}
            onValueChange={(v) => onChange(v || undefined)}
          >
            <SelectTrigger className="h-10 w-full rounded-md border border-border/60 bg-background/60 px-3 text-sm outline-none focus:border-amber-400/60">
              {current || "— select —"}
            </SelectTrigger>
            <SelectContent className="bg-black/90">
              {field.values?.map((v: string) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!field.strict && (
            <Input
              className="mt-2"
              value={
                typeof value === "string" &&
                !field.values?.includes(value)
                  ? value
                  : ""
              }
              onChange={(e) => onChange(e.target.value || undefined)}
              placeholder="Or type a custom value"
            />
          )}
        </div>
      )
    }

    case "string": {
      if (name === "command") {
        return <CommandFieldInput label={label} required={required} field={field} value={value} onChange={onChange} />
      }

      const isLong =
        name === "prompt" ||
        field.description?.toLowerCase().includes("script") ||
        field.description?.toLowerCase().includes("multi")

      if (isLong) {
        return (
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
              {label}{required && <span className="text-red-400 ml-0.5">*</span>}
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
            {label}{required && <span className="text-red-400 ml-0.5">*</span>}
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
            {label}{required && <span className="text-red-400 ml-0.5">*</span>}
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

function CommandFieldInput({
  label,
  required,
  field,
  value,
  onChange,
}: {
  label: string
  required: boolean
  field: FieldDefinition
  value: unknown
  onChange: (value: unknown) => void
}) {
  const str = typeof value === "string" ? value : ""
  const [mode, setMode] = useState<"inline" | "file">(
    str.startsWith("/") || str.startsWith("./") || str.startsWith("~") ? "file" : "inline",
  )
  const [filePath, setFilePath] = useState(() =>
    mode === "file" ? str : "",
  )

  return (
    <div>
      <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <div className="mb-3 flex gap-4">
        <label className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-300">
          <input
            type="radio"
            name="command-mode"
            checked={mode === "inline"}
            onChange={() => {
              setMode("inline")
              onChange(undefined)
            }}
            className="accent-amber-400"
          />
          Inline
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-300">
          <input
            type="radio"
            name="command-mode"
            checked={mode === "file"}
            onChange={() => {
              setMode("file")
              if (filePath) onChange(filePath)
            }}
            className="accent-amber-400"
          />
          File
        </label>
      </div>
      {mode === "file" && (
        <Input
          className="mb-3 font-mono text-[12px]"
          value={filePath}
          onChange={(e) => {
            setFilePath(e.target.value)
            onChange(e.target.value || undefined)
          }}
          placeholder="/path/to/script.sh"
        />
      )}
      <Textarea
        value={mode === "inline" ? str : ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder={mode === "inline" ? field.description : "Script contents (read-only preview)"}
        className="min-h-[110px] font-mono text-[12px]"
        disabled={mode === "file"}
      />
    </div>
  )
}
