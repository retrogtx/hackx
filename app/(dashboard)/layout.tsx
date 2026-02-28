import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { Blocks, Key, FlaskConical, Store, Download, Users, BarChart3 } from "lucide-react";
import { UserProfileDialog } from "./user-profile-dialog";
import { UserSearch } from "./user-search";
import { DashboardOnboardingTour } from "@/components/dashboard-onboarding-tour";

const navItems = [
  { href: "/plugins", label: "Plugins", icon: Blocks },
  { href: "/plugins?filter=downloaded", label: "Downloaded", icon: Download },
  { href: "/collaboration", label: "Collab Rooms", icon: Users },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/api-keys", label: "API Keys", icon: Key },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  const unsafeMetadata =
    user?.unsafeMetadata && typeof user.unsafeMetadata === "object" && !Array.isArray(user.unsafeMetadata)
      ? (user.unsafeMetadata as Record<string, unknown>)
      : {};
  const displayName =
    (typeof unsafeMetadata.name === "string" && unsafeMetadata.name) ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.emailAddresses[0]?.emailAddress ||
    "";
  const initialName =
    (typeof unsafeMetadata.name === "string" && unsafeMetadata.name) || displayName;
  const initialUsername =
    (typeof unsafeMetadata.username === "string" && unsafeMetadata.username) ||
    user?.username ||
    "";
  const email = user?.emailAddresses[0]?.emailAddress || "";

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      {/* Sidebar */}
      <aside className="sticky top-0 flex h-screen w-60 flex-col border-r border-[#262626] bg-[#0a0a0a]">
        <div className="flex h-14 items-center border-b border-[#262626] px-5">
          <Link
            href="/plugins"
            data-tour="logo"
            className="flex items-center gap-2 font-bold text-white tracking-tight"
          >
            <FlaskConical className="h-4 w-4" />
            <span>Lexic</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-0.5 p-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-tour={
                item.href === "/plugins"
                  ? "nav-plugins"
                  : item.href === "/plugins?filter=downloaded"
                    ? "nav-downloads"
                  : item.href === "/collaboration"
                    ? "nav-collaboration"
                  : item.href === "/marketplace"
                    ? "nav-marketplace"
                    : item.href === "/analytics"
                      ? "nav-analytics"
                    : item.href === "/api-keys"
                      ? "nav-api-keys"
                      : undefined
              }
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-[#a1a1a1] transition-colors hover:bg-[#1a1a1a] hover:text-white"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
          {user ? <UserSearch /> : null}
        </nav>

        <div className="border-t border-[#262626] p-4">
          {user ? (
            <div data-tour="account" className="flex items-center gap-3">
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: { avatarBox: "h-7 w-7" },
                }}
              />
              {displayName && (
                <UserProfileDialog
                  displayName={displayName}
                  initialName={initialName}
                  initialUsername={initialUsername}
                  email={email}
                />
              )}
            </div>
          ) : (
            <Link
              href="/sign-in?redirect_url=/marketplace"
              className="inline-flex items-center rounded-md border border-[#333] px-3 py-1.5 text-sm text-[#a1a1a1] transition-colors hover:bg-[#1a1a1a] hover:text-white"
            >
              Sign in
            </Link>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main data-tour="main-workspace" className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl p-6 md:p-10">
          {children}
          <DashboardOnboardingTour enabled={Boolean(user)} />
        </div>
      </main>
    </div>
  );
}
