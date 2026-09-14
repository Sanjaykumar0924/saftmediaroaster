import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TALKBACK_OPTIONS, DEFAULT_CARD_OPTIONS } from "@/lib/saft";
import { Check, X, Plus, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getRosterCardOptions,
  saveRosterCardOptions,
  adminRenameRosterCard,
} from "@/lib/admin.functions";

const NONE_VALUE = "__none__";
const OTHER_VALUE = "__other__";

export function isLegacyCardOption(_name: string | null | undefined): boolean {
  return false;
}

export function useRosterCardOptions(isAdmin: boolean = false) {
  const qc = useQueryClient();
  const fetchCardOptions = useServerFn(getRosterCardOptions);
  const saveCardOptions = useServerFn(saveRosterCardOptions);
  const serverRenameCard = useServerFn(adminRenameRosterCard);

  const q = useQuery({
    queryKey: ["roster-card-options"],
    queryFn: async () => {
      let savedList: string[] = [];

      // 1. Try local cache first for immediate responsiveness
      try {
        const cached = localStorage.getItem("saft_roster_card_options");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            savedList = parsed;
          }
        }
      } catch {}

      // 2. Fetch authoritative options via server function
      try {
        const serverList = await fetchCardOptions();
        if (Array.isArray(serverList) && serverList.length > 0) {
          savedList = Array.from(new Set([...savedList, ...serverList]));
        }
      } catch (err) {
        console.warn("Could not fetch server card options:", err);
      }

      const combined = Array.from(
        new Set([...DEFAULT_CARD_OPTIONS, ...savedList.filter(Boolean)])
      );

      try {
        localStorage.setItem("saft_roster_card_options", JSON.stringify(combined));
      } catch {}

      return combined;
    },
    staleTime: 60_000,
  });

  const addCard = async (newCard: string): Promise<string> => {
    const trimmed = newCard.trim();
    if (!trimmed) return "";

    const current = q.data ?? [...DEFAULT_CARD_OPTIONS];
    const existing = current.find((c) => c.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      return existing;
    }

    const updated = [...current, trimmed];
    try {
      localStorage.setItem("saft_roster_card_options", JSON.stringify(updated));
    } catch {}
    qc.setQueryData(["roster-card-options"], updated);

    if (isAdmin) {
      try {
        await saveCardOptions({ data: { options: updated } });
      } catch (e) {
        console.warn("Could not save card to server:", e);
      }
    }

    return trimmed;
  };

  const renameCard = async (oldName: string, newName: string): Promise<string> => {
    const trimmedOld = oldName.trim();
    const trimmedNew = newName.trim();
    if (!trimmedNew || trimmedNew.toLowerCase() === trimmedOld.toLowerCase()) {
      return trimmedOld;
    }

    const current = q.data ?? [...DEFAULT_CARD_OPTIONS];
    const updated = current.map((c) =>
      c.toLowerCase() === trimmedOld.toLowerCase() ? trimmedNew : c
    );
    if (!updated.some((c) => c.toLowerCase() === trimmedNew.toLowerCase())) {
      updated.push(trimmedNew);
    }

    try {
      localStorage.setItem("saft_roster_card_options", JSON.stringify(updated));
    } catch {}
    qc.setQueryData(["roster-card-options"], updated);

    if (isAdmin) {
      try {
        await serverRenameCard({ data: { oldName: trimmedOld, newName: trimmedNew } });
      } catch (e) {
        console.warn("Could not rename card on server:", e);
      }
    }

    return trimmedNew;
  };

  return {
    cardOptions: q.data ?? [...DEFAULT_CARD_OPTIONS],
    addCard,
    renameCard,
    isLoading: q.isLoading,
  };
}

export function TalkbackSelect({
  value,
  onChange,
  disabled = false,
  className,
}: {
  value: string | null | undefined;
  onChange: (val: string | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const currentVal = value && value.trim() ? value.trim() : NONE_VALUE;

  return (
    <Select
      value={currentVal}
      onValueChange={(v) => onChange(v === NONE_VALUE ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          "h-9 w-full min-w-[95px] text-xs font-medium",
          value ? "font-semibold text-sky-600 dark:text-sky-400" : "text-muted-foreground",
          className
        )}
      >
        <SelectValue placeholder="— Talkback —">
          {value ? (
            <span className="font-semibold text-sky-600 dark:text-sky-400">{value}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>— None —</SelectItem>
        {TALKBACK_OPTIONS.map((tb) => (
          <SelectItem key={tb} value={tb} className="font-medium text-sky-600 dark:text-sky-400">
            {tb}
          </SelectItem>
        ))}
        {value && !TALKBACK_OPTIONS.includes(value as any) && (
          <SelectItem value={value}>{value}</SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}

export function CardSelect({
  value,
  onChange,
  cardOptions,
  onAddCard,
  onRenameCard,
  disabled = false,
  className,
}: {
  value: string | null | undefined;
  onChange: (val: string | null) => void;
  cardOptions: string[];
  onAddCard: (name: string) => Promise<string | void>;
  onRenameCard?: (oldName: string, newName: string) => Promise<string | void>;
  disabled?: boolean;
  className?: string;
}) {
  const [mode, setMode] = useState<"idle" | "adding" | "renaming">("idle");
  const [inputVal, setInputVal] = useState("");
  const [targetCard, setTargetCard] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const cleanValue = value && value.trim() ? value.trim() : null;
  const currentVal = cleanValue ?? NONE_VALUE;

  // Options list ensuring DEFAULT_CARD_OPTIONS, all user cardOptions, and current assigned value are included
  const allOptions = Array.from(
    new Set([
      ...DEFAULT_CARD_OPTIONS,
      ...cardOptions,
      ...(cleanValue ? [cleanValue] : []),
    ])
  );

  const handleCreateCard = async () => {
    const trimmed = inputVal.trim();
    if (!trimmed) {
      setMode("idle");
      return;
    }
    setSubmitting(true);
    try {
      const created = await onAddCard(trimmed);
      const cardToSet = typeof created === "string" && created.trim() ? created.trim() : trimmed;
      onChange(cardToSet);
      setInputVal("");
      setMode("idle");
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmRename = async () => {
    const trimmed = inputVal.trim();
    if (!trimmed || !targetCard || trimmed === targetCard) {
      setMode("idle");
      return;
    }
    setSubmitting(true);
    try {
      if (onRenameCard) {
        const renamed = await onRenameCard(targetCard, trimmed);
        if (cleanValue === targetCard) {
          onChange(renamed || trimmed);
        }
      }
      setInputVal("");
      setTargetCard("");
      setMode("idle");
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === "adding") {
    return (
      <div className={cn("flex items-center gap-1 min-w-[150px]", className)}>
        <Input
          autoFocus
          placeholder="New card name…"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreateCard();
            } else if (e.key === "Escape") {
              setMode("idle");
              setInputVal("");
            }
          }}
          disabled={submitting}
          className="h-8 text-xs px-2"
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-success hover:text-success shrink-0"
          onClick={handleCreateCard}
          disabled={submitting || !inputVal.trim()}
          title="Add card"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
          onClick={() => {
            setMode("idle");
            setInputVal("");
          }}
          title="Cancel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (mode === "renaming") {
    return (
      <div className={cn("flex items-center gap-1 min-w-[170px]", className)}>
        <Input
          autoFocus
          placeholder={`Rename "${targetCard}"…`}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleConfirmRename();
            } else if (e.key === "Escape") {
              setMode("idle");
              setInputVal("");
              setTargetCard("");
            }
          }}
          disabled={submitting}
          className="h-8 text-xs px-2"
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-success hover:text-success shrink-0"
          onClick={handleConfirmRename}
          disabled={submitting || !inputVal.trim()}
          title="Save rename"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
          onClick={() => {
            setMode("idle");
            setInputVal("");
            setTargetCard("");
          }}
          title="Cancel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Select
        value={currentVal}
        onValueChange={(v) => {
          if (v === OTHER_VALUE) {
            setInputVal("");
            setMode("adding");
            return;
          }
          onChange(v === NONE_VALUE ? null : v);
        }}
        disabled={disabled}
      >
        <SelectTrigger
          className={cn(
            "h-9 w-full min-w-[110px] text-xs font-medium",
            cleanValue ? "font-semibold text-amber-600 dark:text-amber-400" : "text-muted-foreground",
            className
          )}
        >
          <SelectValue placeholder="— Card —">
            {cleanValue ? (
              <span className="font-semibold text-amber-600 dark:text-amber-400">{cleanValue}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>— None —</SelectItem>
          {allOptions.map((card) => (
            <SelectItem key={card} value={card} className="font-medium">
              {card}
            </SelectItem>
          ))}
          <SelectItem
            value={OTHER_VALUE}
            className="font-medium text-primary hover:text-primary focus:text-primary"
          >
            <span className="flex items-center gap-1">
              <Plus className="h-3 w-3" /> Other… (Add new card)
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      {onRenameCard && cleanValue && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
          onClick={() => {
            setTargetCard(cleanValue);
            setInputVal(cleanValue);
            setMode("renaming");
          }}
          title={`Rename "${cleanValue}"`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export function TalkbackBadge({ value }: { value: string | null | undefined }) {
  if (!value || !value.trim()) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <Badge
      variant="outline"
      className="bg-sky-500/15 border-sky-500/30 text-sky-700 dark:text-sky-300 font-semibold text-xs px-2 py-0.5"
    >
      {value}
    </Badge>
  );
}

export function CardBadge({ value }: { value: string | null | undefined }) {
  if (!value || !value.trim()) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <Badge
      variant="outline"
      className="bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300 font-semibold text-xs px-2 py-0.5"
    >
      {value}
    </Badge>
  );
}

