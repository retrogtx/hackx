import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { Blocks, Key, FlaskConical, Store } from "lucide-react";

const navItems = [
  { href: "/plugins", label: "Plugins", icon: Blocks },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/api-keys", label: "API Keys", icon: Key },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.emailAddresses[0]?.emailAddress ||
    "";

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      {/* Sidebar */}
      <aside className="sticky top-0 flex h-screen w-60 flex-col border-r border-[#262626] bg-[#0a0a0a]">
        <div className="flex h-14 items-center border-b border-[#262626] px-5">
          <Link href="/plugins" className="flex items-center gap-2 font-bold text-white tracking-tight">
            <FlaskConical className="h-4 w-4" />
            <span>Lexic</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-0.5 p-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-[#a1a1a1] transition-colors hover:bg-[#1a1a1a] hover:text-white"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-[#262626] p-4">
          {user ? (
            <div className="flex items-center gap-3">
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: { avatarBox: "h-7 w-7" },
                }}
              />
              {displayName && (
                <span className="truncate text-sm text-[#a1a1a1]">{displayName}</span>
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
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl p-6 md:p-10">{children}</div>
      </main>
    </div>
  );
}
