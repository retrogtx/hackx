"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Users } from "lucide-react";

type UserSearchResult = {
  id: string;
  username: string;
  name: string;
  email: string;
};

export function UserSearch() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError("");
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to search users");
        }
        const data: UserSearchResult[] = await res.json();
        setResults(data);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to search users");
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [query]);

  return (
    <div className="mt-3 rounded-md border border-[#262626] bg-[#0a0a0a] p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs text-[#888]">
        <Users className="h-3.5 w-3.5" />
        Find users by username
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#666]" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search username..."
          className="h-8 border-[#262626] bg-[#111111] pl-8 text-sm text-white placeholder:text-[#555] focus-visible:ring-0"
        />
      </div>

      {query.trim().length > 0 ? (
        <div className="mt-2 rounded-md border border-[#262626] bg-[#111111]">
          {loading ? (
            <p className="px-3 py-2 text-xs text-[#666]">Searching...</p>
          ) : error ? (
            <p className="px-3 py-2 text-xs text-[#ff4444]">{error}</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-[#666]">
              {query.trim().length < 2 ? "Type at least 2 characters" : "No users found"}
            </p>
          ) : (
            <ul className="max-h-48 overflow-y-auto py-1">
              {results.map((user) => (
                <li key={user.id} className="border-b border-[#1f1f1f] last:border-b-0">
                  <div className="px-3 py-2">
                    <p className="truncate text-sm text-white">@{user.username}</p>
                    <p className="truncate text-xs text-[#888]">{user.name}</p>
                    {user.email ? (
                      <p className="truncate text-[11px] text-[#666]">{user.email}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
