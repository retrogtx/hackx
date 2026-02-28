"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Users, Trash2, MessageSquare, Search } from "lucide-react";

interface Room {
  id: string;
  name: string;
  mode: "debate" | "consensus" | "review";
  expertSlugs: string[];
  expertNames: string[];
  maxRounds: number;
  sessionCount: number;
  createdAt: string;
}

const MODE_COLORS = {
  debate: "border-[#f59e0b]/20 bg-[#f59e0b]/10 text-[#f59e0b]",
  consensus: "border-[#00d4aa]/20 bg-[#00d4aa]/10 text-[#00d4aa]",
  review: "border-[#818cf8]/20 bg-[#818cf8]/10 text-[#818cf8]",
};

export default function CollaborationRoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/collaboration-rooms");
      if (res.ok) setRooms(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  async function deleteRoom(id: string) {
    if (!confirm("Delete this collaboration room?")) return;
    await fetch(`/api/collaboration-rooms/${id}`, { method: "DELETE" });
    setRooms((prev) => prev.filter((r) => r.id !== id));
  }

  const filtered = rooms.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.expertNames.some((n) => n.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Collaboration Rooms</h1>
          <p className="text-[#a1a1a1]">
            Multi-expert deliberation — let your SME plugins debate, challenge, and synthesize answers together.
          </p>
        </div>
        <Link href="/collaboration/new">
          <Button className="bg-white text-black hover:bg-[#ccc]">
            <Plus className="mr-2 h-4 w-4" />
            New Room
          </Button>
        </Link>
      </div>

      {rooms.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#555]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rooms or experts..."
            className="border-[#262626] bg-[#111] pl-10 text-white placeholder:text-[#555]"
          />
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-[#666]">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Users className="mb-4 h-12 w-12 text-[#333]" />
          <p className="text-[#a1a1a1]">
            {rooms.length === 0 ? "No collaboration rooms yet" : "No rooms match your search"}
          </p>
          {rooms.length === 0 && (
            <p className="mt-1 text-sm text-[#666]">
              Create a room to bring multiple expert plugins together.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((room) => (
            <Link
              key={room.id}
              href={`/collaboration/${room.id}`}
              className="group rounded-lg border border-[#262626] bg-[#111] p-4 transition-colors hover:border-[#444]"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-white group-hover:text-white/90">
                  {room.name}
                </h3>
                <div className="flex items-center gap-2">
                  <Badge className={MODE_COLORS[room.mode]}>{room.mode}</Badge>
                  <button
                    onClick={(e) => { e.preventDefault(); deleteRoom(room.id); }}
                    className="rounded p-1 text-[#555] hover:bg-[#222] hover:text-[#ff4444]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mb-3 flex flex-wrap gap-1.5">
                {room.expertNames.map((name, i) => (
                  <Badge key={i} variant="outline" className="border-[#333] text-[#888]">
                    {name}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center gap-4 text-xs text-[#666]">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {room.expertSlugs.length} experts
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {room.sessionCount} session{room.sessionCount !== 1 ? "s" : ""}
                </span>
                <span>Max {room.maxRounds} rounds</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
