import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TALKBACK_OPTIONS, DEFAULT_CARD_OPTIONS } from "@/lib/saft";
import { Check, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const NONE_VALUE = "__none__";
const OTHER_VALUE = "__other__";

export function useRosterCardOptions(isAdmin: boolean = false) {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["roster-card-options"],
    queryFn: async () => {
      let savedList: string[] = [];

      // 1. Try local cache first
      try {
        const cached = localStorage.getItem("saft_roster_card_options");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            savedList = parsed;
          }
        }
      } catch {}

      // 2. If admin or if cache was empty, try fetching from app_settings
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "roster_card_options")
          .maybeSingle();

        if (data?.value) {
          let parsed: string[] = [];
          try {
            parsed = JSON.parse(data.value);
          } catch {
            parsed = data.value.split(",").map((s) => s.trim()).filter(Boolean);
          }
          if (Array.isArray(parsed) && parsed.length > 0) {
            savedList = parsed;
            try {
              localStorage.setItem("saft_roster_card_options", JSON.stringify(savedList));
            } catch {}
          }
        }
      } catch {}

      // Default should always include "4k card"
      const combined = Array.from(
        new Set([...DEFAULT_CARD_OPTIONS, ...savedList])
      );
      return combined;
    },
    staleTime: 60_000,
  });

  const addCard = async (newCard: string): Promise<string> => {
    const trimmed = newCard.trim();
    if (!trimmed) return "";

    const current = q.data ?? [...DEFAULT_CARD_OPTIONS];
    // Check if card already exists (case-insensitive)
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
        await supabase
          .from("app_settings")
          .upsert({
            key: "roster_card_options",
            value: JSON.stringify(updated),
            updated_at: new Date().toISOString(),
          });
      } catch (e) {
        console.warn("Could not save card to app_settings:", e);
      }
    }

    return trimmed;
  };

  return {
    cardOptions: q.data ?? [...DEFAULT_CARD_OPTIONS],
    addCard,
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
  disabled = false,
  className,
}: {
  value: string | null | undefined;
  onChange: (val: string | null) => void;
  cardOptions: string[];
  onAddCard: (name: string) => Promise<string | void>;
  disabled?: boolean;
  className?: string;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newCardInput, setNewCardInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const currentVal = value && value.trim() ? value.trim() : NONE_VALUE;

  // Options list ensuring current value is included if present
  const allOptions = Array.from(
    new Set([...cardOptions, ...(value && value.trim() ? [value.trim()] : [])])
  );

  const handleCreateCard = async () => {
    const trimmed = newCardInput.trim();
    if (!trimmed) {
      setIsAdding(false);
      return;
    }
    setSubmitting(true);
    try {
      const created = await onAddCard(trimmed);
      onChange(created || trimmed);
      setNewCardInput("");
      setIsAdding(false);
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  if (isAdding) {
    return (
      <div className={cn("flex items-center gap-1 min-w-[150px]", className)}>
        <Input
          autoFocus
          placeholder="New card name…"
          value={newCardInput}
          onChange={(e) => setNewCardInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreateCard();
            } else if (e.key === "Escape") {
              setIsAdding(false);
              setNewCardInput("");
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
          disabled={submitting || !newCardInput.trim()}
          title="Add card"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
          onClick={() => {
            setIsAdding(false);
            setNewCardInput("");
          }}
          title="Cancel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Select
      value={currentVal}
      onValueChange={(v) => {
        if (v === OTHER_VALUE) {
          setIsAdding(true);
          return;
        }
        onChange(v === NONE_VALUE ? null : v);
      }}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          "h-9 w-full min-w-[110px] text-xs font-medium",
          value ? "font-semibold text-amber-600 dark:text-amber-400" : "text-muted-foreground",
          className
        )}
      >
        <SelectValue placeholder="— Card —">
          {value ? (
            <span className="font-semibold text-amber-600 dark:text-amber-400">{value}</span>
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
