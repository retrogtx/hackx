"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

export function UserProfileDialog({
  displayName,
  initialName,
  initialUsername,
  email,
}: {
  displayName: string;
  initialName: string;
  initialUsername: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveProfile() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update profile");
      }

      setOpen(false);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="truncate text-sm text-[#a1a1a1] transition-colors hover:text-white"
        >
          {displayName}
        </button>
      </DialogTrigger>
      <DialogContent className="border-[#262626] bg-[#0a0a0a] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profile Details</DialogTitle>
          <DialogDescription className="text-[#a1a1a1]">
            Update your name and username.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[#a1a1a1]">Email</Label>
            <Input
              value={email}
              disabled
              className="border-[#262626] bg-[#111111] text-[#888] focus-visible:ring-0"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[#a1a1a1]">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              className="border-[#262626] bg-[#111111] text-white placeholder:text-[#555] focus-visible:ring-0"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[#a1a1a1]">Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. john_doe"
              className="border-[#262626] bg-[#111111] text-white placeholder:text-[#555] focus-visible:ring-0"
            />
            <p className="text-xs text-[#666]">3-24 chars: letters, numbers, and `_` only</p>
          </div>
          {error ? <p className="text-sm text-[#ff4444]">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button
            onClick={saveProfile}
            disabled={saving}
            className="bg-white text-black hover:bg-[#ccc] font-semibold"
          >
            {saving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Saving
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
