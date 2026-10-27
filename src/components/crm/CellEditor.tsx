import { useState, useRef, useEffect } from "react";
import { getColumnType } from "@/lib/columns";
import { useUpdateCell } from "@/hooks/useBoostyData";
import { useBoostySchema } from "@/hooks/useBoostySchema";
import { useCRMStore } from "@/store/crmStore";
import { normalizeColumnType, type BoostySchemaColumnType } from "@/lib/boostySchema";

function resolveColumnType(
  column: string,
  enumColumns: Record<string, string[]>,
  columnTypes: Record<string, BoostySchemaColumnType>
): "enum" | "date" | "integer" | "text" | "link" | "checkbox" {
  const dynType = normalizeColumnType(column, columnTypes[column], enumColumns);

  if (dynType === "dropdown") return "enum";
  if (dynType === "checkbox") return "checkbox";
  if (dynType === "date") return "date";
  if (dynType === "number") return "integer";

  return getColumnType(column);
}

interface CellEditorProps {
  rowId: number;
  column: string;
  value: any;
  rowData?: Record<string, any>;
}

export function CellEditor({ rowId, column, value }: CellEditorProps) {
  const [editValue, setEditValue] = useState(value ?? "");
  const updateCell = useUpdateCell();
  const { enumColumns, columnTypes } = useBoostySchema();
  const setEditingCell = useCRMStore((s) => s.setEditingCell);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(null);
  const colType = resolveColumnType(column, enumColumns, columnTypes);
  const enumOptions = enumColumns[column] ?? [];

  useEffect(() => { setEditValue(value ?? ""); }, [value]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  if (colType === "enum") {
    return (
      <select
        ref={inputRef as any}
        value={editValue}
        onChange={(e) => {
          const newValue = e.target.value;
          const finalValue = newValue.trim() === "" ? null : newValue.trim();
          setEditValue(newValue);
          if (finalValue !== value) updateCell.mutate({ id: rowId, column, value: finalValue });
          setEditingCell(null);
        }}
        className="w-full border border-ring rounded px-1.5 py-0.5 text-sm bg-card focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">—</option>
        {enumOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );
  }

  const save = () => {
    const trimmed = typeof editValue === "string" ? editValue.trim() : editValue;
    const finalValue = trimmed === "" ? null : colType === "integer" ? Number(trimmed) : trimmed;
    if (finalValue !== value) updateCell.mutate({ id: rowId, column, value: finalValue });
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
    if (e.key === "Escape") setEditingCell(null);
  };

  if (colType === "checkbox") {
    const checkboxValue = editValue === true || editValue === "true" ? "true"
      : editValue === false || editValue === "false" ? "false" : "";
    return (
      <select
        ref={inputRef as any}
        value={checkboxValue}
        onChange={(e) => {
          const selected = e.target.value;
          const nextValue = selected === "" ? null : selected === "true";
          setEditValue(nextValue);
          if (nextValue !== value) updateCell.mutate({ id: rowId, column, value: nextValue });
          setEditingCell(null);
        }}
        className="w-full border border-ring rounded px-1.5 py-0.5 text-sm bg-card focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">—</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }

  if (colType === "date") {
    return (
      <input
        ref={inputRef as any}
        type="date"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
        className="w-full border border-ring rounded px-1.5 py-0.5 text-sm bg-card focus:outline-none focus:ring-1 focus:ring-ring"
      />
    );
  }

  return (
    <input
      ref={inputRef as any}
      type={colType === "integer" ? "number" : "text"}
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={save}
      onKeyDown={handleKeyDown}
      className="w-full border border-ring rounded px-1.5 py-0.5 text-sm bg-card focus:outline-none focus:ring-1 focus:ring-ring"
    />
  );
}
