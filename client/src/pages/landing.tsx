import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Shield,
  Key,
  Users,
  Zap,
  Lock,
  BarChart3,
  ArrowRight,
  CheckCircle,
  Code2,
  Globe,
} from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Application Security",
    description:
      "Protect your software with industry-standard licensing. Prevent unauthorized access and piracy.",
  },
  {
    icon: Key,
    title: "License Management",
    description:
      "Generate, distribute, and manage license keys with granular control over duration, levels, and limits.",
  },
  {
    icon: Users,
    title: "User Management",
    description:
      "Track authenticated users, monitor sessions, ban abusers, and manage hardware ID locks.",
  },
  {
    icon: Zap,
    title: "Token System",
    description:
      "Create single-use registration tokens for controlled user onboarding and track usage in real time.",
  },
  {
    icon: Lock,
    title: "HWID Locking",
    description:
      "Bind licenses to specific hardware IDs. Prevent account sharing and enforce per-device policies.",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description:
      "Real-time insights into usage, active users, license activations, and token redemptions.",
  },
];

const languages = [
  "C#", "C++", "Java", "Python", "PHP", "JavaScript", "TypeScript",
  "VB.Net", "Rust", "Go", "Lua", "Ruby", "Perl",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">KeyAuth Manager</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a href="/login">
              <Button variant="outline" data-testid="button-login">Log In</Button>
            </a>
            <a href="/register">
              <Button data-testid="button-register">Sign Up</Button>
            </a>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-primary/3 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.12),_transparent_60%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-28 lg:py-36">
          <div className="mx-auto max-w-3xl text-center animate-fade-in">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm text-muted-foreground">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Software licensing made simple
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Protect & Monetize
              <span className="block bg-gradient-to-r from-primary via-purple-400 to-primary bg-clip-text text-transparent">
                Your Software
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              The complete authentication and licensing platform for modern developers.
              Manage applications, licenses, users, and tokens from one powerful dashboard.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <a href="/register">
                <Button size="lg" data-testid="button-get-started">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
              <a href="#features">
                <Button size="lg" variant="outline" data-testid="button-learn-more">
                  Learn More
                </Button>
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                Free forever
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                No credit card
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                Unlimited apps
              </span>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-t py-24 lg:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center animate-fade-in">
            <p className="mb-3 text-sm font-medium uppercase tracking-widest text-primary">Features</p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything You Need
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              A complete toolkit for software licensing, authentication, and
              user management.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <Card
                key={feature.title}
                className="group p-6 hover-elevate animate-slide-up"
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <div className="mb-4 inline-flex rounded-md bg-primary/10 p-2.5 transition-colors duration-200 group-hover:bg-primary/15">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t py-24 lg:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <p className="mb-3 text-sm font-medium uppercase tracking-widest text-primary">Integrations</p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Works With Your Stack
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Native client API support for 13+ programming languages with code snippets ready to copy.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {languages.map((lang, i) => (
              <div
                key={lang}
                className="flex items-center justify-center gap-2 rounded-md border bg-card p-3 text-sm font-medium text-card-foreground animate-slide-up"
                style={{ animationDelay: `${i * 0.04}s` }}
                data-testid={`lang-${lang.toLowerCase().replace(/[^a-z]/g, "")}`}
              >
                <Code2 className="h-3.5 w-3.5 text-primary" />
                {lang}
              </div>
            ))}
          </div>
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Globe className="h-4 w-4" />
            <span>Compatible with KeyAuth client libraries</span>
          </div>
        </div>
      </section>

      <section className="border-t py-24 lg:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <Card className="relative overflow-visible p-12 text-center">
            <div className="absolute inset-0 rounded-md bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Ready to Secure Your Software?
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
                Join developers who trust KeyAuth Manager to protect and manage their
                applications.
              </p>
              <div className="mt-8">
                <a href="/register">
                  <Button size="lg" data-testid="button-cta-get-started">
                    Get Started Now
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span>KeyAuth Manager</span>
          </div>
          <span>Software Licensing Platform</span>
        </div>
      </footer>
    </div>
  );
}
