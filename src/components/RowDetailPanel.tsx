import { useState, useRef, useEffect, useCallback } from "react";
import { X, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { useBoostySchema } from "@/hooks/useBoostySchema";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import toast from "react-hot-toast";
import { type BoostyColumnType } from "@/lib/boostySchema";

import type { Tables } from '@/integrations/supabase/types';

type ContactRow = Tables<'contacts'>;

const DATE_DISPLAY_COLUMNS = new Set([
  "first_contact_date", "next_contact_date",
  "ftd_date_mentioned", "ftd_date_actual",
  "created_at", "updated_at",
]);

const READONLY_FIELDS = new Set(["id", "contact_id", "created_at", "updated_at", "first_contact_date"]);

// ── Badge color maps ──

const STATUS_COLORS: Record<string, string> = {
  new: "bg-gray-100 text-gray-600",
  outreach_1: "bg-blue-50 text-blue-700",
  outreach_2: "bg-purple-50 text-purple-700",
  outreach_3: "bg-amber-50 text-amber-700",
  outreach_4: "bg-orange-50 text-orange-700",
  outreach_5: "bg-red-50 text-red-600",
  live: "bg-emerald-50 text-emerald-700",
  quit: "bg-gray-100 text-gray-500",
};

const ASSIGNED_TO_COLORS: Record<string, string> = {
  bot: "bg-blue-50 text-blue-700",
  human: "bg-teal-50 text-teal-700",
};

// ── Panel sections ──

const SECTIONS = [
  {
    title: "Contact Info",
    fields: ["name", "contact_id", "status", "assigned_to"],
  },
  {
    title: "Dates",
    fields: ["next_contact_date", "ftd_date_mentioned", "ftd_date_actual"],
  },
  {
    title: "Flags",
    fields: ["backoffice", "live"],
  },
];

const KNOWN_FIELDS = new Set([
  "id", "created_at", "updated_at", "first_contact_date",
  ...SECTIONS.flatMap((s) => s.fields),
]);

function getFieldType(
  field: string,
  enumColumns: Record<string, string[]>,
  columnTypes: Record<string, BoostyColumnType>,
): "enum" | "date" | "checkbox" | "text" {
  if ((enumColumns[field] ?? []).length > 0) return "enum";
  const dt = columnTypes[field];
  if (dt === "dropdown") return "enum";
  if (dt === "date") return "date";
  if (dt === "checkbox") return "checkbox";
  if (DATE_DISPLAY_COLUMNS.has(field)) return "date";
  return "text";
}

function formatDateDisplay(value: any, withTime = false): string {
  if (!value) return "—";
  try {
    return format(parseISO(value), withTime ? "dd MMM yyyy HH:mm" : "dd MMM yyyy");
  } catch {
    return String(value);
  }
}

function BadgeTag({ value, colorClass }: { value: string; colorClass?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-xl text-[11px] font-medium tracking-wide",
      colorClass ?? "bg-surface3 text-muted-foreground",
    )}>
      {value}
    </span>
  );
}

function ValueDisplay({ field, value }: { field: string; value: any }) {
  if (value === null || value === undefined || value === "")
    return <span className="text-muted-foreground/40">—</span>;

  if (field === "status")
    return <BadgeTag value={value} colorClass={STATUS_COLORS[value]} />;
  if (field === "assigned_to")
    return <BadgeTag value={value} colorClass={ASSIGNED_TO_COLORS[value]} />;
  if (field === "backoffice" || field === "live") {
    const bool = value === true || value === "true";
    return <BadgeTag value={bool ? "Yes" : "No"} colorClass={bool ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"} />;
  }
  if (DATE_DISPLAY_COLUMNS.has(field))
    return <span>{formatDateDisplay(value, field === "created_at" || field === "updated_at")}</span>;

  return <span>{String(value)}</span>;
}

// ── Editable field ──

function EditableField({ field, value, onSave }: {
  field: string;
  value: any;
  onSave: (field: string, value: any) => void;
}) {
  const { enumColumns, columnTypes } = useBoostySchema();
  const isReadonly = READONLY_FIELDS.has(field);
  const type = getFieldType(field, enumColumns, columnTypes);
  const enumOptions = enumColumns[field] ?? [];

  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(value ?? "");
  const editValRef = useRef(editVal);
  const savedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    setEditVal(value ?? "");
    editValRef.current = value ?? "";
    setEditing(false);
    savedRef.current = false;
  }, [value]);

  useEffect(() => { editValRef.current = editVal; }, [editVal]);
  useEffect(() => {
    if (editing) { inputRef.current?.focus(); savedRef.current = false; }
  }, [editing]);

  const handleSave = useCallback(() => {
    if (savedRef.current) return;
    savedRef.current = true;
    setEditing(false);
    const finalVal = editValRef.current === "" ? null : editValRef.current;
    if (finalVal !== (value ?? null)) onSave(field, finalVal);
  }, [field, value, onSave]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); }
    if (e.key === "Escape") { setEditVal(value ?? ""); setEditing(false); savedRef.current = false; }
  };

  const inputCls = "w-full rounded-lg border border-border bg-muted px-2.5 py-1.5 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors";

  const displayRow = (content: React.ReactNode, clickable = true) => (
    <div
      className={cn(
        "flex items-start justify-between py-2.5",
        clickable && "cursor-pointer hover:bg-muted rounded-lg px-1.5 -mx-1.5 transition-colors",
      )}
      onClick={clickable ? () => setEditing(true) : undefined}
    >
      <span className="text-[11px] font-medium text-muted-foreground w-[160px] shrink-0 pt-0.5">{field}</span>
      <span className="text-[13px] text-foreground flex-1 text-right">{content}</span>
    </div>
  );

  if (isReadonly) return displayRow(<ValueDisplay field={field} value={value} />, false);

  if (editing) {
    if (type === "enum") {
      return (
        <div className="flex items-start justify-between py-2.5">
          <span className="text-[11px] font-medium text-muted-foreground w-[160px] shrink-0 pt-1.5">{field}</span>
          <select
            ref={inputRef as any}
            value={editVal}
            onChange={(e) => {
              const v = e.target.value;
              setEditVal(v);
              savedRef.current = true;
              setEditing(false);
              const finalVal = v === "" ? null : v;
              if (finalVal !== (value ?? null)) onSave(field, finalVal);
            }}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className={cn(inputCls, "flex-1")}
          >
            <option value="">—</option>
            {enumOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      );
    }

    if (type === "date") {
      return (
        <div className="flex items-start justify-between py-2.5">
          <span className="text-[11px] font-medium text-muted-foreground w-[160px] shrink-0 pt-1.5">{field}</span>
          <Popover defaultOpen onOpenChange={(o) => { if (!o) handleSave(); }}>
            <PopoverTrigger asChild>
              <button className={cn(inputCls, "flex-1 text-left", !editVal && "text-muted-foreground")}>
                {editVal ? format(new Date(editVal), "dd MMM yyyy") : "Pick date..."}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-card border-border" align="end">
              <Calendar
                mode="single"
                selected={editVal ? new Date(editVal) : undefined}
                onSelect={(d) => {
                  const formatted = d ? format(d, "yyyy-MM-dd") : "";
                  setEditVal(formatted);
                  onSave(field, formatted || null);
                  setEditing(false);
                }}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      );
    }

    if (type === "checkbox") {
      const checkboxVal = editVal === true || editVal === "true" ? "true"
        : editVal === false || editVal === "false" ? "false" : "";
      return (
        <div className="flex items-start justify-between py-2.5">
          <span className="text-[11px] font-medium text-muted-foreground w-[160px] shrink-0 pt-1.5">{field}</span>
          <select
            ref={inputRef as any}
            value={checkboxVal}
            onChange={(e) => {
              const sel = e.target.value;
              const next = sel === "" ? null : sel === "true";
              setEditVal(next);
              savedRef.current = true;
              setEditing(false);
              if (next !== (value ?? null)) onSave(field, next);
            }}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className={cn(inputCls, "flex-1")}
          >
            <option value="">—</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      );
    }

    return (
      <div className="flex items-start justify-between py-2.5">
        <span className="text-[11px] font-medium text-muted-foreground w-[160px] shrink-0 pt-1.5">{field}</span>
        <input
          ref={inputRef as any}
          type="text"
          value={editVal}
          onChange={(e) => setEditVal(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={cn(inputCls, "flex-1")}
        />
      </div>
    );
  }

  return displayRow(<ValueDisplay field={field} value={value} />);
}

// ── Props ──

interface RowDetailPanelProps {
  row: ContactRow | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: number, field: string, value: any) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onDeleteColumn?: (columnName: string) => void;
  visibleFields?: string[] | null;
}

// ── Main component ──

export function RowDetailPanel({ row, open, onClose, onUpdate, onDelete, visibleFields }: RowDetailPanelProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleFieldSave = useCallback(async (field: string, value: any) => {
    if (!row) return;
    try {
      await onUpdate(row.id, field, value);
    } catch (err: any) {
      toast.error(err.message || "Invalid data type. Value not saved.");
    }
  }, [row, onUpdate]);

  const handleDelete = useCallback(async () => {
    if (!row) return;
    setDeleting(true);
    try {
      await onDelete(row.id);
      onClose();
    } catch {
      toast.error("Failed to delete. Please retry.");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [row, onDelete, onClose]);

  if (!row) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-[420px] max-w-full bg-card border-l border-border flex flex-col transition-transform duration-200 ease-out shadow-2xl",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-display text-[16px] font-bold text-foreground">
              {row["name"] || "Contact Detail"}
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              ID #{row.id}{row["contact_id"] ? ` · CBB ID: ${row["contact_id"]}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-6 w-6 rounded-md bg-muted flex items-center justify-center text-muted-foreground hover:bg-border hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* System meta */}
          <div className="text-[12px] text-muted-foreground flex justify-between">
            <span>First contact: {row["first_contact_date"] ? formatDateDisplay(row["first_contact_date"]) : "—"}</span>
            <span>Added: {row["created_at"] ? formatDateDisplay(row["created_at"], true) : "—"}</span>
          </div>

          {/* Live sync notice */}
          <div className="bg-primary/[0.06] border border-primary/20 rounded-lg px-3 py-2.5 flex gap-2 items-start">
            <span className="text-[14px] mt-0.5 shrink-0">⚡</span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <b className="text-primary font-semibold">Live Sync active:</b> Changes are saved instantly and synced in real time.
            </p>
          </div>

          {/* Hardcoded sections */}
          {SECTIONS.map((section) => {
            const fields = visibleFields
              ? section.fields.filter((f) => visibleFields.includes(f))
              : section.fields;
            if (fields.length === 0) return null;
            return (
              <div key={section.title}>
                <h3 className="text-[10px] font-bold text-primary uppercase tracking-[0.7px] mb-2 pb-1.5 border-b border-border">
                  {section.title}
                </h3>
                <div className="divide-y divide-border/50">
                  {fields.map((field) => (
                    <EditableField
                      key={field}
                      field={field}
                      value={(row as any)[field]}
                      onSave={handleFieldSave}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Dynamic / custom columns */}
          {(() => {
            let customFields = Object.keys(row).filter((k) => !KNOWN_FIELDS.has(k));
            if (visibleFields) customFields = customFields.filter((f) => visibleFields.includes(f));
            if (customFields.length === 0) return null;
            return (
              <div>
                <h3 className="text-[10px] font-bold text-primary uppercase tracking-[0.7px] mb-2 pb-1.5 border-b border-border">
                  Custom Columns
                </h3>
                <div className="divide-y divide-border/50">
                  {customFields.map((field) => (
                    <EditableField
                      key={field}
                      field={field}
                      value={(row as any)[field]}
                      onSave={handleFieldSave}
                    />
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
            className="w-full h-10 rounded-lg bg-muted border border-border text-destructive font-medium text-[13px] flex items-center justify-center gap-2 hover:bg-red-50 hover:border-red-200 transition-all disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {deleting ? "Deleting..." : "Delete contact"}
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={(o) => !o && setShowDeleteConfirm(false)}>
        <AlertDialogContent className="rounded-xl bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Contact</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-muted-foreground">
              Are you sure you want to delete this contact? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-lg text-[13px] bg-muted border-border text-foreground hover:bg-border"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg text-[13px]"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
