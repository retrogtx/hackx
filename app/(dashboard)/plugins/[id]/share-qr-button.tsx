"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
import { Check, Copy, ExternalLink, QrCode } from "lucide-react";

export function ShareQrButton({
  slug,
  isMarketplaceShared,
}: {
  slug: string;
  isMarketplaceShared: boolean;
}) {
  const sharePath = `/marketplace/${slug}`;
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const resolvedShareUrl = shareUrl || sharePath;

  const qrCodeUrl = useMemo(() => {
    const encoded = encodeURIComponent(resolvedShareUrl);
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=12&data=${encoded}`;
  }, [resolvedShareUrl]);

  async function copyLink() {
    await navigator.clipboard.writeText(resolvedShareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen || shareUrl || typeof window === "undefined") return;
    setShareUrl(`${window.location.origin}${sharePath}`);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={
            isMarketplaceShared
              ? "border-[#333] text-[#a1a1a1] hover:bg-[#1a1a1a] hover:text-white"
              : "border-[#333] text-[#666] hover:bg-[#1a1a1a] hover:text-[#a1a1a1]"
          }
        >
          <QrCode className="mr-2 h-4 w-4" />
          Share by QR
        </Button>
      </DialogTrigger>

      <DialogContent className="border-[#262626] bg-[#0a0a0a] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share plugin by QR</DialogTitle>
          <DialogDescription className="text-[#a1a1a1]">
            {isMarketplaceShared
              ? "Anyone can scan this QR to open your public plugin page."
              : "Share this plugin to marketplace first, then the QR link will be available."}
          </DialogDescription>
        </DialogHeader>

        {isMarketplaceShared ? (
          <div className="space-y-4">
            <div className="rounded-md border border-[#262626] bg-[#111111] p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCodeUrl}
                alt={`QR code for ${resolvedShareUrl}`}
                width={240}
                height={240}
                className="mx-auto h-60 w-60 rounded-sm bg-white p-2"
              />
            </div>
            <p className="truncate text-center text-xs text-[#888]">{resolvedShareUrl}</p>
          </div>
        ) : null}

        <DialogFooter>
          {isMarketplaceShared && (
            <>
              <Button
                variant="outline"
                onClick={copyLink}
                className="border-[#333] text-[#a1a1a1] hover:bg-[#1a1a1a] hover:text-white"
              >
                {copied ? (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5 text-[#00d4aa]" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copy Link
                  </>
                )}
              </Button>
              <Button asChild className="bg-white text-black hover:bg-[#ccc] font-semibold">
                <Link href={resolvedShareUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open Page
                </Link>
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
