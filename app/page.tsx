import Link from "next/link";
import { Button } from "@/components/ui/button";
import SilkBackground from "@/components/silk-background";
import {
  FlaskConical,
  ArrowRight,
  Zap,
  Shield,
  GitBranch,
  BookOpen,
  Code2,
  RefreshCw,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-[#0a0a0a]">
      {/* Silk background */}
      <SilkBackground />

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-[#262626] bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight text-white">
            <FlaskConical className="h-5 w-5" />
            Lexic
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="text-[#a1a1a1] hover:text-white hover:bg-[#1a1a1a]" asChild>
              <Link href="/docs">Docs</Link>
            </Button>
            <Button variant="ghost" size="sm" className="text-[#a1a1a1] hover:text-white hover:bg-[#1a1a1a]" asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button size="sm" className="bg-white text-black hover:bg-[#ccc] font-semibold" asChild>
              <Link href="/sign-up">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-28 text-center md:py-40">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-white md:text-6xl lg:text-7xl">
          Expert Brains for{" "}
          <span className="bg-gradient-to-r from-white to-[#666] bg-clip-text text-transparent">
            AI Agents
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-[#a1a1a1] leading-relaxed md:text-lg">
          Hot-swappable Subject Matter Expert plugins that turn generalist AI
          into verified domain specialists. Cited answers, decision-tree
          reasoning, zero hallucination.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Button size="lg" className="bg-white text-black hover:bg-[#ccc] font-semibold h-12 px-8" asChild>
            <Link href="/sign-up">
              Start Building
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="border-[#333] text-[#ededed] hover:bg-[#1a1a1a] hover:border-[#444] h-12 px-8" asChild>
            <Link href="#how-it-works">See How It Works</Link>
          </Button>
        </div>

        {/* Code snippet */}
        <div className="mx-auto mt-16 max-w-xl overflow-hidden rounded-md border border-[#262626] bg-[#111111]">
          <div className="flex items-center gap-1.5 border-b border-[#262626] px-4 py-3">
            <div className="h-2.5 w-2.5 rounded-full bg-[#333]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#333]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#333]" />
            <span className="ml-2 text-xs text-[#666]">terminal</span>
          </div>
          <div className="p-5 text-left">
            <pre className="overflow-x-auto text-sm leading-relaxed">
              <code className="text-[#666]">
{`POST /api/v1/query
{
  `}<span className="text-[#ededed]">{`"plugin"`}</span>{`: "structural-eng-v1",
  `}<span className="text-[#ededed]">{`"query"`}</span>{`:  "Min cover for a beam in severe exposure?"
}

→ `}<span className="text-[#00d4aa]">{`"45mm nominal cover (IS 456, Table 16)" [Source 1]`}</span>{`
→ confidence: `}<span className="text-[#00d4aa]">high</span>
              </code>
            </pre>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="how-it-works" className="relative z-10 border-t border-[#262626] py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-4 text-center text-3xl font-bold text-white">
            How Lexic Works
          </h2>
          <p className="mx-auto mb-14 max-w-2xl text-center text-[#a1a1a1]">
            Three actors, one API. Experts build plugins, developers query them,
            end users get better answers.
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="group rounded-md border border-[#262626] bg-[#111111] p-6 transition-colors hover:border-[#333]">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#1a1a1a]">
                <BookOpen className="h-5 w-5 text-[#3b82f6]" />
              </div>
              <h3 className="mb-2 font-bold text-white">1. Expert Builds Plugin</h3>
              <p className="text-sm leading-relaxed text-[#a1a1a1]">
                Upload PDFs, standards, and reference documents. Define decision
                trees for structured reasoning. Set citation rules.
              </p>
            </div>

            <div className="group rounded-md border border-[#262626] bg-[#111111] p-6 transition-colors hover:border-[#333]">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#1a1a1a]">
                <Code2 className="h-5 w-5 text-[#00d4aa]" />
              </div>
              <h3 className="mb-2 font-bold text-white">2. Developer Integrates</h3>
              <p className="text-sm leading-relaxed text-[#a1a1a1]">
                One API call or SDK wrapper. Works with LangChain, AutoGPT, or
                any custom agent. No training required.
              </p>
            </div>

            <div className="group rounded-md border border-[#262626] bg-[#111111] p-6 transition-colors hover:border-[#333]">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#1a1a1a]">
                <Zap className="h-5 w-5 text-[#a855f7]" />
              </div>
              <h3 className="mb-2 font-bold text-white">3. User Gets Answers</h3>
              <p className="text-sm leading-relaxed text-[#a1a1a1]">
                Cited, decision-tree-backed answers from their existing AI tools.
                Source-linked, auditable, hallucination-free.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Key features grid */}
      <section className="relative z-10 border-t border-[#262626] py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-14 text-center text-3xl font-bold text-white">
            Why Lexic?
          </h2>
          <div className="grid gap-px overflow-hidden rounded-md border border-[#262626] bg-[#262626] sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: RefreshCw,
                title: "Hot-Swappable",
                desc: "Change the plugin slug → instant domain switch. No restart, no retrain, no redeploy.",
              },
              {
                icon: Shield,
                title: "Hallucination Guard",
                desc: "If no source supports a claim, the system refuses to guess. Every answer is evidence-backed.",
              },
              {
                icon: GitBranch,
                title: "Decision Trees",
                desc: "Structured domain reasoning on top of RAG. Not just retrieval — actual expert logic.",
              },
              {
                icon: BookOpen,
                title: "Mandatory Citations",
                desc: "Every claim links to source documents with page and section references. Fully auditable.",
              },
              {
                icon: Code2,
                title: "Framework Agnostic",
                desc: "REST API works with anything. SDK adapters for LangChain, AutoGPT, and more.",
              },
              {
                icon: Zap,
                title: "5-Minute Integration",
                desc: "One API key, one POST request. From zero to expert-grade answers in minutes.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="bg-[#0a0a0a] p-6 transition-colors hover:bg-[#111111]"
              >
                <feature.icon className="mb-3 h-5 w-5 text-[#a1a1a1]" />
                <h3 className="mb-1.5 font-bold text-white">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-[#888]">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 border-t border-[#262626] py-24">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white">Ready to build your expert plugin?</h2>
          <p className="mt-4 text-[#a1a1a1]">
            Create a plugin in minutes. Upload your domain knowledge, define
            reasoning trees, and give any AI agent expert-grade capabilities.
          </p>
          <Button size="lg" className="mt-10 bg-white text-black hover:bg-[#ccc] font-semibold h-12 px-8" asChild>
            <Link href="/sign-up">
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#262626] py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2 text-sm text-[#666]">
            <FlaskConical className="h-4 w-4" />
            Lexic
          </div>
          <p className="text-sm text-[#666]">
            Built for HackX 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
