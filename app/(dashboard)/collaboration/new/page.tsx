"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ArrowLeft, X, Swords, Handshake, ClipboardCheck } from "lucide-react";

interface PluginOption {
  id: string;
  slug: string;
  name: string;
  domain: string;
  isPublished: boolean;
}

type Mode = "debate" | "consensus" | "review";

const MODES: { id: Mode; label: string; description: string; icon: React.ReactNode }[] = [
  {
    id: "debate",
    label: "Debate",
    description: "Experts challenge each other across rounds, then converge on consensus",
    icon: <Swords className="h-5 w-5" />,
  },
  {
    id: "consensus",
    label: "Consensus",
    description: "All experts answer independently in one round, then consensus is synthesized",
    icon: <Handshake className="h-5 w-5" />,
  },
  {
    id: "review",
    label: "Review",
    description: "One expert answers first, others critique and refine",
    icon: <ClipboardCheck className="h-5 w-5" />,
  },
];

const MODE_COLORS: Record<Mode, string> = {
  debate: "border-[#f59e0b] bg-[#f59e0b]/10 text-[#f59e0b]",
  consensus: "border-[#00d4aa] bg-[#00d4aa]/10 text-[#00d4aa]",
  review: "border-[#818cf8] bg-[#818cf8]/10 text-[#818cf8]",
};

export default function NewCollaborationPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<Mode>("debate");
  const [maxRounds, setMaxRounds] = useState(3);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [availablePlugins, setAvailablePlugins] = useState<PluginOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const loadPlugins = useCallback(async () => {
    const res = await fetch("/api/plugins");
    if (res.ok) {
      const data = await res.json();
      setAvailablePlugins(data.map((p: PluginOption) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        domain: p.domain,
        isPublished: p.isPublished,
      })));
    }
  }, []);

  useEffect(() => { loadPlugins(); }, [loadPlugins]);

  function togglePlugin(slug: string) {
    setSelectedSlugs((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length < 5
          ? [...prev, slug]
          : prev,
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || selectedSlugs.length < 2) return;
    setSaving(true);

    try {
      const res = await fetch("/api/collaboration-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          mode,
          expertSlugs: selectedSlugs,
          maxRounds,
        }),
      });

      if (res.ok) {
        const room = await res.json();
        router.push(`/collaboration/${room.id}`);
      }
    } finally {
      setSaving(false);
    }
  }

  const filteredPlugins = availablePlugins.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.domain.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <Link
        href="/collaboration"
        className="mb-4 inline-flex items-center text-sm text-[#666] hover:text-white"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to rooms
      </Link>

      <h1 className="mb-1 text-2xl font-bold text-white">Create Collaboration Room</h1>
      <p className="mb-6 text-[#a1a1a1]">
        Assemble a panel of expert plugins to deliberate on complex cross-domain questions.
      </p>

      <form onSubmit={handleCreate} className="space-y-6">
        <div>
          <Label className="text-[#ededed]">Room Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Building Safety Review Panel"
            className="mt-1 border-[#262626] bg-[#111] text-white placeholder:text-[#555]"
          />
        </div>

        <div>
          <Label className="mb-2 block text-[#ededed]">Deliberation Mode</Label>
          <div className="grid gap-3 sm:grid-cols-3">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  mode === m.id
                    ? MODE_COLORS[m.id]
                    : "border-[#262626] bg-[#111] text-[#888] hover:border-[#444]"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  {m.icon}
                  <span className="font-semibold">{m.label}</span>
                </div>
                <p className="text-xs opacity-80">{m.description}</p>
              </button>
            ))}
          </div>
        </div>

        {mode === "debate" && (
          <div>
            <Label className="text-[#ededed]">Max Rounds</Label>
            <div className="mt-1 flex gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMaxRounds(n)}
                  className={`rounded-md border px-4 py-2 text-sm ${
                    maxRounds === n
                      ? "border-white bg-white text-black"
                      : "border-[#333] text-[#888] hover:border-[#555]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label className="text-[#ededed]">
              Expert Plugins ({selectedSlugs.length}/5 selected, min 2)
            </Label>
          </div>

          {selectedSlugs.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {selectedSlugs.map((slug) => {
                const p = availablePlugins.find((pl) => pl.slug === slug);
                return (
                  <Badge
                    key={slug}
                    className="border-white/20 bg-white/10 text-white"
                  >
                    {p?.name || slug}
                    <button
                      type="button"
                      onClick={() => togglePlugin(slug)}
                      className="ml-1.5 hover:text-[#ff4444]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}

          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your plugins..."
            className="mb-2 border-[#262626] bg-[#111] text-white placeholder:text-[#555]"
          />

          <div className="max-h-64 overflow-y-auto rounded-md border border-[#262626]">
            {filteredPlugins.length === 0 ? (
              <div className="p-4 text-center text-sm text-[#666]">
                {availablePlugins.length === 0
                  ? "No plugins found. Create plugins first."
                  : "No plugins match your search."}
              </div>
            ) : (
              filteredPlugins.map((plugin) => {
                const isSelected = selectedSlugs.includes(plugin.slug);
                return (
                  <button
                    key={plugin.id}
                    type="button"
                    onClick={() => togglePlugin(plugin.slug)}
                    className={`flex w-full items-center justify-between border-b border-[#1f1f1f] px-4 py-3 text-left text-sm transition-colors last:border-0 ${
                      isSelected
                        ? "bg-white/5 text-white"
                        : "text-[#a1a1a1] hover:bg-[#1a1a1a]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded border ${
                          isSelected
                            ? "border-white bg-white text-black"
                            : "border-[#555]"
                        }`}
                      >
                        {isSelected && <span className="text-xs">✓</span>}
                      </div>
                      <div>
                        <span className="font-medium">{plugin.name}</span>
                        <span className="ml-2 text-xs text-[#666]">{plugin.slug}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-[#333] text-[#666]">
                      {plugin.domain}
                    </Badge>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Link href="/collaboration">
            <Button variant="outline" type="button" className="border-[#333] text-[#a1a1a1]">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={saving || !name.trim() || selectedSlugs.length < 2}
            className="bg-white text-black hover:bg-[#ccc] disabled:opacity-40"
          >
            {saving ? "Creating..." : "Create Room"}
          </Button>
        </div>
      </form>
    </div>
  );
}
