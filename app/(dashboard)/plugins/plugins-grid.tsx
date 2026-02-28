"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  Download,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Store,
  StoreIcon,
  Trash2,
} from "lucide-react";

type PluginListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  domain: string;
  isPublished: boolean;
  config: Record<string, unknown> | null;
};

type VisibilityFilter = "all" | "public" | "private" | "downloaded";

function isMarketplaceShared(config: Record<string, unknown> | null): boolean {
  if (!config) return false;
  return config.marketplaceShared === true;
}

function isDownloadedPlugin(config: Record<string, unknown> | null): boolean {
  if (!config) return false;
  return config.downloadedFromMarketplace === true;
}

export function PluginsGrid({
  initialPlugins,
  initialFilter = "all",
}: {
  initialPlugins: PluginListItem[];
  initialFilter?: VisibilityFilter;
}) {
  const router = useRouter();
  const [plugins, setPlugins] = useState(initialPlugins);
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>(initialFilter);
  const [busyPluginId, setBusyPluginId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PluginListItem | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [error, setError] = useState("");

  const sharedCount = useMemo(
    () => plugins.filter((plugin) => isMarketplaceShared(plugin.config)).length,
    [plugins],
  );
  const downloadedCount = useMemo(
    () => plugins.filter((plugin) => isDownloadedPlugin(plugin.config)).length,
    [plugins],
  );
  const privateCount = useMemo(
    () =>
      plugins.filter(
        (plugin) =>
          !isMarketplaceShared(plugin.config) && !isDownloadedPlugin(plugin.config),
      ).length,
    [plugins],
  );
  const filteredPlugins = useMemo(() => {
    if (visibilityFilter === "public") {
      return plugins.filter((plugin) => isMarketplaceShared(plugin.config));
    }
    if (visibilityFilter === "downloaded") {
      return plugins.filter((plugin) => isDownloadedPlugin(plugin.config));
    }
    if (visibilityFilter === "private") {
      return plugins.filter(
        (plugin) =>
          !isMarketplaceShared(plugin.config) && !isDownloadedPlugin(plugin.config),
      );
    }
    return plugins;
  }, [plugins, visibilityFilter]);

  async function toggleMarketplace(pluginId: string, nextValue: boolean) {
    setBusyPluginId(pluginId);
    setError("");

    try {
      const res = await fetch(`/api/plugins/${pluginId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketplaceShared: nextValue }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update marketplace listing");
      }

      setPlugins((prev) =>
        prev.map((plugin) =>
          plugin.id === pluginId
            ? {
                ...plugin,
                config: {
                  ...(plugin.config ?? {}),
                  marketplaceShared: nextValue,
                },
              }
            : plugin,
        ),
      );

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update marketplace listing");
    } finally {
      setBusyPluginId(null);
    }
  }

  async function downloadPlugin(pluginId: string, fallbackName: string) {
    setBusyPluginId(pluginId);
    setError("");

    try {
      const res = await fetch(`/api/plugins/${pluginId}/export`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to export plugin");
      }

      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `${fallbackName.replace(/[^a-zA-Z0-9-_]+/g, "-").toLowerCase()}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export plugin");
    } finally {
      setBusyPluginId(null);
    }
  }

  async function deletePlugin(pluginId: string) {
    setBusyPluginId(pluginId);
    setError("");

    try {
      const res = await fetch(`/api/plugins/${pluginId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete plugin");
      }

      setPlugins((prev) => prev.filter((plugin) => plugin.id !== pluginId));
      setDeleteTarget(null);
      setDeleteConfirmText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete plugin");
    } finally {
      setBusyPluginId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-md border border-[#262626] bg-[#0a0a0a] px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-[#a1a1a1]">
          <StoreIcon className="h-4 w-4 text-[#00d4aa]" />
          {sharedCount} plugin{sharedCount !== 1 ? "s" : ""} shared on marketplace
        </div>
        <Button
          variant="outline"
          asChild
          className="border-[#333] text-[#a1a1a1] hover:bg-[#1a1a1a] hover:text-white"
        >
          <Link href="/marketplace" target="_blank" rel="noreferrer">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Open Marketplace
          </Link>
        </Button>
      </div>

      {error ? <p className="text-sm text-[#ff4444]">{error}</p> : null}

      {plugins.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setVisibilityFilter("all")}
            className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
              visibilityFilter === "all"
                ? "border-[#00d4aa]/40 bg-[#00d4aa]/10 text-[#00d4aa]"
                : "border-[#333] text-[#a1a1a1] hover:bg-[#1a1a1a] hover:text-white"
            }`}
          >
            All ({plugins.length})
          </button>
          <button
            type="button"
            onClick={() => setVisibilityFilter("public")}
            className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
              visibilityFilter === "public"
                ? "border-[#3b82f6]/40 bg-[#3b82f6]/10 text-[#60a5fa]"
                : "border-[#333] text-[#a1a1a1] hover:bg-[#1a1a1a] hover:text-white"
            }`}
          >
            Public ({sharedCount})
          </button>
          <button
            type="button"
            onClick={() => setVisibilityFilter("private")}
            className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
              visibilityFilter === "private"
                ? "border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[#f59e0b]"
                : "border-[#333] text-[#a1a1a1] hover:bg-[#1a1a1a] hover:text-white"
            }`}
          >
            Private ({privateCount})
          </button>
          <button
            type="button"
            onClick={() => setVisibilityFilter("downloaded")}
            className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
              visibilityFilter === "downloaded"
                ? "border-[#22c55e]/40 bg-[#22c55e]/10 text-[#22c55e]"
                : "border-[#333] text-[#a1a1a1] hover:bg-[#1a1a1a] hover:text-white"
            }`}
          >
            Downloaded ({downloadedCount})
          </button>
        </div>
      ) : null}

	      {plugins.length === 0 ? (
        <div className="rounded-md border border-dashed border-[#333] px-4 py-10 text-center text-sm text-[#a1a1a1]">
          No plugins left. Create a new plugin to continue.
        </div>
      ) : filteredPlugins.length === 0 ? (
        <div className="rounded-md border border-dashed border-[#333] px-4 py-10 text-center text-sm text-[#a1a1a1]">
          No {visibilityFilter} plugins found.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredPlugins.map((plugin) => {
            const marketplaceShared = isMarketplaceShared(plugin.config);
            const downloadedPlugin = isDownloadedPlugin(plugin.config);
            const isBusy = busyPluginId === plugin.id;

            return (
              <div
                key={plugin.id}
                className="group rounded-md border border-[#262626] bg-[#0a0a0a] p-5 transition-all hover:border-[#333] hover:bg-[#111111]"
                role="link"
                tabIndex={0}
                onClick={() => router.push(`/plugins/${plugin.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/plugins/${plugin.id}`);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/plugins/${plugin.id}`}
                      className="font-bold text-white transition-colors hover:text-[#00d4aa]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {plugin.name}
                    </Link>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={plugin.isPublished ? "default" : "secondary"}
                      className={
                        plugin.isPublished
                          ? "bg-[#00d4aa]/10 text-[#00d4aa] border-[#00d4aa]/20"
                          : "bg-[#1a1a1a] text-[#666] border-[#262626]"
                      }
                    >
                      {plugin.isPublished ? "Published" : "Draft"}
                    </Badge>
                    {marketplaceShared ? (
                      <Badge className="bg-[#3b82f6]/10 text-[#60a5fa] border-[#3b82f6]/20">
                        Marketplace
                      </Badge>
                    ) : null}
                    {downloadedPlugin ? (
                      <Badge className="bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20">
                        Downloaded
                      </Badge>
                    ) : null}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="rounded-md border border-[#333] p-1.5 text-[#a1a1a1] transition-colors hover:bg-[#1a1a1a] hover:text-white disabled:opacity-40"
                          disabled={isBusy}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          {isBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="h-4 w-4" />
                          )}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="border-[#262626] bg-[#111111] text-[#ededed]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/plugins/${plugin.id}`}
                            className="cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-4 w-4" />
                            Open
                          </Link>
                        </DropdownMenuItem>
                        {marketplaceShared ? (
                          <DropdownMenuItem
                            onClick={() => toggleMarketplace(plugin.id, false)}
                            className="cursor-pointer"
                            disabled={isBusy}
                          >
                            <Store className="h-4 w-4" />
                            Remove from marketplace
                          </DropdownMenuItem>
                        ) : !downloadedPlugin ? (
                          <DropdownMenuItem
                            onClick={() => toggleMarketplace(plugin.id, true)}
                            className="cursor-pointer"
                            disabled={isBusy}
                          >
                            <Store className="h-4 w-4" />
                            Add to marketplace
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem
                          onClick={() => downloadPlugin(plugin.id, plugin.slug)}
                          className="cursor-pointer"
                          disabled={isBusy}
                        >
                          <Download className="h-4 w-4" />
                          Download plugin
                        </DropdownMenuItem>
	                        <DropdownMenuSeparator className="bg-[#262626]" />
	                        <DropdownMenuItem
	                          onClick={() => {
	                            setDeleteTarget(plugin);
	                            setDeleteConfirmText("");
	                            setError("");
	                          }}
	                          variant="destructive"
	                          className="cursor-pointer"
	                          disabled={isBusy}
	                        >
                          <Trash2 className="h-4 w-4" />
                          Delete plugin
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-[#a1a1a1]">
                  {plugin.description || "No description"}
                </p>
                <div className="mt-3">
                  <Badge variant="outline" className="border-[#333] text-[#888]">
                    {plugin.domain}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
	      )}

	      <Dialog
	        open={Boolean(deleteTarget)}
	        onOpenChange={(open) => {
	          if (!open) {
	            setDeleteTarget(null);
	            setDeleteConfirmText("");
	          }
	        }}
	      >
	        <DialogContent
	          showCloseButton={false}
	          className="border-[#262626] bg-[#0a0a0a] sm:max-w-[430px]"
	        >
	          <DialogHeader>
	            <DialogTitle className="text-white">Delete Plugin</DialogTitle>
	            <DialogDescription className="text-[#a1a1a1]">
	              This will permanently delete{" "}
	              <span className="font-medium text-white">{deleteTarget?.name}</span>, including
	              knowledge documents, configuration, and plugin setup.
	            </DialogDescription>
	          </DialogHeader>

	          <div className="w-fit rounded-md border border-[#ff4444]/20 bg-[#ff4444]/5 px-3 py-2">
	            <div className="flex items-start gap-2">
	              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#ff4444]" />
	              <p className="text-sm text-[#ff4444]">This action cannot be undone.</p>
	            </div>
	          </div>

	          <div className="space-y-2">
	            <Label htmlFor="deletePluginConfirm" className="text-[#ededed]">
	              Type <code className="rounded bg-[#111111] px-1 py-0.5">{deleteTarget?.slug}</code>{" "}
	              to confirm
	            </Label>
	            <Input
	              id="deletePluginConfirm"
	              value={deleteConfirmText}
	              onChange={(e) => setDeleteConfirmText(e.target.value)}
	              placeholder={deleteTarget?.slug ?? ""}
	              className="border-[#262626] bg-[#111111] text-white placeholder:text-[#666] focus:border-[#444] focus:ring-0"
	            />
	          </div>

	          <DialogFooter className="gap-2 sm:gap-2">
	            <Button
	              variant="outline"
	              onClick={() => {
	                setDeleteTarget(null);
	                setDeleteConfirmText("");
	              }}
	              disabled={busyPluginId === deleteTarget?.id}
	              className="border-[#333] text-[#a1a1a1] hover:bg-[#1a1a1a] hover:text-white"
	            >
	              Cancel
	            </Button>
	            <Button
	              onClick={() => {
	                if (!deleteTarget) return;
	                deletePlugin(deleteTarget.id);
	              }}
	              disabled={
	                !deleteTarget ||
	                deleteConfirmText.trim() !== deleteTarget.slug ||
	                busyPluginId === deleteTarget.id
	              }
	              className="bg-[#ff4444] text-white hover:bg-[#e03c3c] font-semibold"
	            >
	              {busyPluginId === deleteTarget?.id ? "Deleting..." : "Delete Plugin"}
	            </Button>
	          </DialogFooter>
	        </DialogContent>
	      </Dialog>
	    </div>
	  );
}
