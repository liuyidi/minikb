"use client";

import { Search } from "lucide-react";
import { Input } from "@minikb/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@minikb/ui/components/ui/select";

export type SearchField = "name" | "id";

type SearchToolbarProps = {
  field: SearchField;
  onFieldChange: (field: SearchField) => void;
  value: string;
  onValueChange: (value: string) => void;
  nameLabel: string;
  idLabel: string;
  placeholder: string;
  className?: string;
  compact?: boolean;
};

export function SearchToolbar({
  field,
  onFieldChange,
  value,
  onValueChange,
  nameLabel,
  idLabel,
  placeholder,
  className,
  compact = false,
}: SearchToolbarProps) {
  const fieldItems = [
    { value: "name", label: nameLabel },
    { value: "id", label: idLabel },
  ];

  return (
    <div
      className={
        className ??
        (compact
          ? "flex w-[200px] shrink-0 items-center gap-0"
          : "flex min-w-[240px] flex-1 items-center gap-0")
      }
    >
      <Select
        items={fieldItems}
        value={field}
        onValueChange={(next) => onFieldChange(next as SearchField)}
      >
        <SelectTrigger
          className={
            compact
              ? "h-9 w-[68px] shrink-0 rounded-r-none border-r-0 px-2 text-xs"
              : "h-9 w-[88px] shrink-0 rounded-r-none border-r-0"
          }
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fieldItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className={compact ? "h-9 rounded-l-none pl-7 text-xs" : "h-9 rounded-l-none pl-8"}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
        />
      </div>
    </div>
  );
}
