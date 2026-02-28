import type { Metadata } from "next";
import { Roboto_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Lexic — Expert Brains for AI Agents",
  description:
    "Hot-swappable Subject Matter Expert plugins for any AI agent. Cited, hallucination-guarded answers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorBackground: "#0a0a0a",
          colorInputBackground: "#1a1a1a",
          colorPrimary: "#ffffff",
          colorText: "#ededed",
          colorTextSecondary: "#a1a1a1",
          fontFamily: "'Roboto Mono', monospace",
          borderRadius: "0.5rem",
        },
      }}
    >
      <html lang="en" className="dark">
        <body className={`${robotoMono.variable} font-sans antialiased`}>
          {children}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
