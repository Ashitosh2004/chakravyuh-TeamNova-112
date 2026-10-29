import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { search, type SearchCategory } from "@/content/search";

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const results = useMemo(() => (q.trim() ? search(q).slice(0, 30) : []), [q]);
  const grouped = useMemo(() => {
    const m = new Map<SearchCategory, typeof results>();
    results.forEach((r) => m.set(r.category, [...(m.get(r.category) ?? []), r]));
    return [...m.entries()];
  }, [results]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search e.g. 'xor', 'sampling', 'fan'…" value={q} onValueChange={setQ} />
      <CommandList>
        {q.trim() === "" ? (
          <div className="p-4 text-sm text-muted-foreground">Type to search courses, lessons, simulations, challenges, quizzes and scenarios.</div>
        ) : (
          <CommandEmpty>No results for “{q}”.</CommandEmpty>
        )}
        {grouped.map(([cat, items]) => (
          <CommandGroup key={cat} heading={cat}>
            {items.map((i) => (
              <CommandItem
                key={`${i.category}-${i.id}`}
                value={`${i.category} ${i.title} ${i.id}`}
                onSelect={() => {
                  onOpenChange(false);
                  setQ("");
                  navigate({ to: i.href });
                }}
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{i.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{i.description}</div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        {q.trim() && (
          <CommandGroup heading="More">
            <CommandItem value={`all-results ${q}`} onSelect={() => { onOpenChange(false); navigate({ to: "/search", search: { q } }); }}>
              See all results with filters
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
