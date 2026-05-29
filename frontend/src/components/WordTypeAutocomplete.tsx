import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { GlobalTypeSummary } from '@/shared/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export const ALL_WORD_TYPES = 'all';

interface WordTypeAutocompleteProps {
  options: GlobalTypeSummary[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
}

function formatTypeLabel(type: string, count?: number): string {
  if (type === ALL_WORD_TYPES) return 'Tất cả loại từ';
  return count != null ? `${type} (${count})` : type;
}

export default function WordTypeAutocomplete({
  options,
  value,
  onValueChange,
  disabled = false,
  id,
  label = 'Loại từ',
}: WordTypeAutocompleteProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = `${inputId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedLabel = useMemo(() => {
    if (value === ALL_WORD_TYPES) return formatTypeLabel(ALL_WORD_TYPES);
    const match = options.find((o) => o.type === value);
    return match ? formatTypeLabel(match.type, match.count) : value;
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const allOption = { type: ALL_WORD_TYPES, count: 0 };
    const merged = [allOption, ...options];
    if (!q) return merged;
    return merged.filter((item) => {
      if (item.type === ALL_WORD_TYPES) {
        return 'tất cả loại từ'.includes(q) || 'all'.includes(q);
      }
      return item.type.toLowerCase().includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setQuery(selectedLabel);
    }
  }, [open, selectedLabel]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  function selectOption(type: string) {
    onValueChange(type);
    setOpen(false);
    setQuery(formatTypeLabel(type, options.find((o) => o.type === type)?.count));
  }

  return (
    <div ref={rootRef} className="relative grid gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <Input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          value={open ? query : selectedLabel}
          placeholder="Tìm loại từ..."
          className="pr-9"
          onFocus={() => {
            if (disabled) return;
            setOpen(true);
            setQuery(selectedLabel === formatTypeLabel(ALL_WORD_TYPES) ? '' : selectedLabel);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              setQuery(selectedLabel);
            }
            if (e.key === 'Enter' && open && filteredOptions.length > 0) {
              e.preventDefault();
              selectOption(filteredOptions[0].type);
            }
          }}
        />
        <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 opacity-50" />
      </div>
      {open && !disabled && (
        <ul
          id={listId}
          role="listbox"
          className="bg-popover text-popover-foreground absolute top-full z-[60] mt-1 max-h-56 w-full overflow-y-auto rounded-md border p-1 shadow-md"
        >
          {filteredOptions.length === 0 ? (
            <li className="text-muted-foreground px-3 py-2 text-sm">Không tìm thấy loại từ</li>
          ) : (
            filteredOptions.map((item) => (
              <li key={item.type} role="option" aria-selected={value === item.type}>
                <button
                  type="button"
                  className={cn(
                    'hover:bg-accent hover:text-accent-foreground w-full rounded-sm px-3 py-2 text-left text-sm',
                    value === item.type && 'bg-accent text-accent-foreground'
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectOption(item.type)}
                >
                  {formatTypeLabel(
                    item.type,
                    item.type === ALL_WORD_TYPES ? undefined : item.count
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
