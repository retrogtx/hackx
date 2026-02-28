"use client";

import dynamic from "next/dynamic";

const Silk = dynamic(() => import("@/components/ui/silk"), { ssr: false });

export default function SilkBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 opacity-40">
      <Silk
        speed={5}
        scale={0.9}
        color="#292829"
        noiseIntensity={0.3}
        rotation={0}
      />
    </div>
  );
}
