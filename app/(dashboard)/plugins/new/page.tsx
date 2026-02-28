"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function NewPluginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      domain: formData.get("domain") as string,
      description: formData.get("description") as string,
      systemPrompt: formData.get("systemPrompt") as string,
      citationMode: formData.get("citationMode") as string,
    };

    try {
      const res = await fetch("/api/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create plugin");
      }

      const plugin = await res.json();
      router.push(`/plugins/${plugin.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/plugins"
          className="mb-4 inline-flex items-center text-sm text-[#666] transition-colors hover:text-white"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to plugins
        </Link>
        <h1 className="text-2xl font-bold text-white">Create New Plugin</h1>
        <p className="text-[#a1a1a1]">
          Define your expert persona and domain
        </p>
      </div>

      <div className="rounded-md border border-[#262626] bg-[#0a0a0a]">
        <div className="border-b border-[#262626] p-6">
          <h2 className="font-bold text-white">Plugin Details</h2>
          <p className="mt-1 text-sm text-[#a1a1a1]">
            This defines who your AI expert is and what domain they cover.
          </p>
        </div>
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[#ededed]">Plugin Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Structural Engineering - IS 456"
                required
                className="border-[#262626] bg-[#111111] text-white placeholder:text-[#555] focus:border-[#444] focus:ring-0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="domain" className="text-[#ededed]">Domain</Label>
              <Input
                id="domain"
                name="domain"
                placeholder="e.g., structural-engineering"
                required
                className="border-[#262626] bg-[#111111] text-white placeholder:text-[#555] focus:border-[#444] focus:ring-0"
              />
              <p className="text-xs text-[#666]">
                A short category identifier for your plugin
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-[#ededed]">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="What does this plugin do? What domain does it cover?"
                rows={3}
                className="border-[#262626] bg-[#111111] text-white placeholder:text-[#555] focus:border-[#444] focus:ring-0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="systemPrompt" className="text-[#ededed]">Expert System Prompt</Label>
              <Textarea
                id="systemPrompt"
                name="systemPrompt"
                placeholder="You are an expert structural engineer specializing in Indian building codes (IS 456:2000)..."
                rows={6}
                required
                className="border-[#262626] bg-[#111111] text-white placeholder:text-[#555] focus:border-[#444] focus:ring-0"
              />
              <p className="text-xs text-[#666]">
                This defines the expert persona. Be specific about the domain,
                standards, and expertise level.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="citationMode" className="text-[#ededed]">Citation Mode</Label>
              <Select name="citationMode" defaultValue="mandatory">
                <SelectTrigger className="border-[#262626] bg-[#111111] text-white focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[#262626] bg-[#111111]">
                  <SelectItem value="mandatory">Mandatory — every claim must cite a source</SelectItem>
                  <SelectItem value="optional">Optional — citations encouraged but not required</SelectItem>
                  <SelectItem value="off">Off — no citations</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <p className="text-sm text-[#ff4444]">{error}</p>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={loading} className="bg-white text-black hover:bg-[#ccc] font-semibold">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Plugin"
                )}
              </Button>
              <Button type="button" variant="outline" className="border-[#333] text-[#a1a1a1] hover:bg-[#1a1a1a] hover:text-white" asChild>
                <Link href="/plugins">Cancel</Link>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
