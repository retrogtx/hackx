"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Check, Download, ExternalLink, Lock, QrCode } from "lucide-react";

export function MarketplaceActions({
  slug,
  isSignedIn,
  isOwner,
}: {
  slug: string;
  isSignedIn: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const sharePath = `/marketplace/${slug}`;
  const signInHref = `/sign-in?redirect_url=${encodeURIComponent(sharePath)}`;
  const [shareUrl, setShareUrl] = useState("");
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState("");
  const resolvedShareUrl =
    shareUrl ||
    (typeof window === "undefined"
      ? sharePath
      : `${window.location.origin}${sharePath}`);
  const qrCodeUrl = useMemo(() => {
    const encoded = encodeURIComponent(resolvedShareUrl);
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encoded}`;
  }, [resolvedShareUrl]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen || shareUrl || typeof window === "undefined") return;
    setShareUrl(`${window.location.origin}${sharePath}`);
  }

  async function installPlugin() {
    setInstalling(true);
    setInstallError("");
    try {
      const res = await fetch(`/api/marketplace/${slug}/install`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add plugin");
      }
      const data = await res.json();
      router.push(`/plugins/${data.plugin.id}`);
      router.refresh();
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : "Failed to add plugin");
    } finally {
      setInstalling(false);
    }
  }

  if (!isSignedIn) {
    return (
      <div className="mb-6 rounded-md border border-[#333] bg-[#111111] p-4">
        <p className="mb-3 text-sm text-[#a1a1a1]">
          Sign in to access QR sharing or download this plugin.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="bg-white text-black hover:bg-[#ccc] font-semibold">
            <Link href={signInHref}>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Sign in to add plugin
            </Link>
          </Button>
          <Button asChild className="bg-white text-black hover:bg-[#ccc] font-semibold">
            <Link href={signInHref}>
              <Lock className="mr-1.5 h-3.5 w-3.5" />
              Sign in for QR
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-[#333] text-[#a1a1a1] hover:bg-[#1a1a1a] hover:text-white"
          >
            <Link href={signInHref}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Sign in to download
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {!isOwner ? (
        <Button
          onClick={installPlugin}
          disabled={installing}
          className="bg-white text-black hover:bg-[#ccc] font-semibold"
        >
          {installing ? (
            <>
              <Download className="mr-1.5 h-3.5 w-3.5 animate-pulse" />
              Adding...
            </>
          ) : (
            <>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Add to My Plugins
            </>
          )}
        </Button>
      ) : (
        <Button
          asChild
          variant="outline"
          className="border-[#333] text-[#a1a1a1] hover:bg-[#1a1a1a] hover:text-white"
        >
          <Link href="/plugins">
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Already yours
          </Link>
        </Button>
      )}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="border-[#333] text-[#a1a1a1] hover:bg-[#1a1a1a] hover:text-white"
          >
            <QrCode className="mr-1.5 h-3.5 w-3.5" />
            QR
          </Button>
        </DialogTrigger>
        <DialogContent className="border-[#262626] bg-[#0a0a0a] text-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Marketplace QR</DialogTitle>
            <DialogDescription className="text-[#a1a1a1]">
              Share this QR to open the marketplace plugin page.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-[#262626] bg-[#111111] p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrCodeUrl}
              alt={`QR code for ${resolvedShareUrl}`}
              width={220}
              height={220}
              className="mx-auto h-[220px] w-[220px] rounded-sm bg-white p-2"
            />
          </div>
          <DialogFooter>
            <Button asChild className="bg-white text-black hover:bg-[#ccc] font-semibold">
              <Link href={resolvedShareUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Open
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button
        asChild
        variant="outline"
        className="border-[#333] text-[#a1a1a1] hover:bg-[#1a1a1a] hover:text-white"
      >
        <a href={`/api/marketplace/${slug}/download`}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export JSON
        </a>
      </Button>
      {installError ? <p className="w-full text-sm text-[#ff4444]">{installError}</p> : null}
    </div>
  );
}
