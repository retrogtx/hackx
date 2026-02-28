"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type TourStep = {
  id: string;
  title: string;
  description: string;
  selector?: string;
};

const TOUR_KEY = "lexic:onboarding:v1";
const TOUR_RESTART_KEY = "lexic:onboarding:restart";

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Lexic",
    description:
      "Lexic lets you build and deploy hot-swappable SME plugins so any AI agent can answer domain questions with structured logic and grounded sources.",
  },
  {
    id: "plugins",
    title: "Build Plugins Here",
    description:
      "Go to Plugins to create and manage your SME modules, upload domain knowledge, test in sandbox, and publish.",
    selector: '[data-tour="nav-plugins"]',
  },
  {
    id: "collaboration",
    title: "Collab Rooms",
    description:
      "Use Collab Rooms to combine multiple expert plugins in one room and get debate, consensus, or review-style multi-expert answers.",
    selector: '[data-tour="nav-collaboration"]',
  },
  {
    id: "marketplace",
    title: "Share and Reuse",
    description:
      "Marketplace is where published plugins can be discovered and installed for real-world agent use.",
    selector: '[data-tour="nav-marketplace"]',
  },
  {
    id: "api-keys",
    title: "Connect Real Agents",
    description:
      "Use API Keys to connect external apps, SDK clients, and agent frameworks to your published plugins.",
    selector: '[data-tour="nav-api-keys"]',
  },
  {
    id: "workspace",
    title: "Your Workspace",
    description:
      "This main panel is where each page shows plugin setup, testing, and operational actions.",
    selector: '[data-tour="main-workspace"]',
  },
  {
    id: "account",
    title: "Account Controls",
    description:
      "Use your account menu for profile controls and secure sign-out. You can start exploring right away.",
    selector: '[data-tour="account"]',
  },
];

export function DashboardOnboardingTour({ enabled }: { enabled: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const lastRestartTokenRef = useRef<string | null>(null);

  const currentStep = TOUR_STEPS[stepIndex];

  const closeTour = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(TOUR_KEY, "done");
    }
    setIsOpen(false);
  }, []);

  const openTourFromStart = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOUR_KEY);
    }
    setStepIndex(0);
    setIsOpen(true);
  }, []);

  const updateSpotlight = useCallback(() => {
    const selector = TOUR_STEPS[stepIndex]?.selector;
    if (!selector) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(selector);
    if (!el) {
      setTargetRect(null);
      return;
    }
    setTargetRect(el.getBoundingClientRect());
  }, [stepIndex]);

  useEffect(() => {
    if (!enabled) return;
    const hasSeen = localStorage.getItem(TOUR_KEY) === "done";
    if (!hasSeen) {
      const frame = window.requestAnimationFrame(() => setIsOpen(true));
      return () => window.cancelAnimationFrame(frame);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const checkRestartSignal = () => {
      const token = localStorage.getItem(TOUR_RESTART_KEY);
      if (!token || token === lastRestartTokenRef.current) return;
      lastRestartTokenRef.current = token;
      openTourFromStart();
    };

    checkRestartSignal();
    const intervalId = window.setInterval(checkRestartSignal, 500);
    return () => window.clearInterval(intervalId);
  }, [enabled, openTourFromStart]);

  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      updateSpotlight();
    };
    onResize();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", updateSpotlight, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", updateSpotlight, true);
    };
  }, [isOpen, updateSpotlight]);

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => updateSpotlight());
    return () => window.cancelAnimationFrame(frame);
  }, [stepIndex, isOpen, updateSpotlight]);

  const tooltipStyle = useMemo(() => {
    if (!targetRect) {
      return {
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const cardWidth = 360;
    const spacing = 14;
    const left = Math.min(
      Math.max(targetRect.left, 16),
      Math.max(16, viewport.width - cardWidth - 16),
    );
    const placeAbove = targetRect.bottom + 220 > viewport.height;
    const top = placeAbove
      ? Math.max(16, targetRect.top - 200 - spacing)
      : Math.min(viewport.height - 200 - 16, targetRect.bottom + spacing);

    return {
      left: `${left}px`,
      top: `${top}px`,
      transform: "translate(0, 0)",
    };
  }, [targetRect, viewport.height, viewport.width]);

  if (!enabled || !isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110]">
      <div className="absolute inset-0 bg-black/10" />

      {targetRect && (
        <div
          className="pointer-events-none fixed rounded-lg border border-[#00d4aa]/80 transition-all duration-300 ease-out"
          style={{
            left: targetRect.left - 6,
            top: targetRect.top - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.72)",
          }}
        />
      )}

      {!targetRect && <div className="absolute inset-0 bg-black/72 transition-opacity duration-300" />}

      <div
        className="fixed w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-5 shadow-2xl transition-all duration-300 ease-out"
        style={tooltipStyle}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-[#00d4aa]">
            Step {stepIndex + 1} of {TOUR_STEPS.length}
          </p>
          <button
            type="button"
            onClick={closeTour}
            className="rounded-md px-2 py-1 text-xs text-[#888] transition-colors hover:bg-[#1a1a1a] hover:text-white"
          >
            Skip
          </button>
        </div>

        <h3 className="text-base font-semibold text-white">{currentStep.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[#b1b1b1]">
          {currentStep.description}
        </p>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((step, idx) => (
              <span
                key={step.id}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === stepIndex ? "w-5 bg-[#00d4aa]" : "w-1.5 bg-[#3a3a3a]"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => {
                if (stepIndex === TOUR_STEPS.length - 1) {
                  closeTour();
                  return;
                }
                setStepIndex((s) => s + 1);
              }}
              className="bg-white text-black hover:bg-[#d6d6d6]"
            >
              {stepIndex === TOUR_STEPS.length - 1 ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
