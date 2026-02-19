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
} from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Application Security",
    description:
      "Protect your software with industry-standard licensing. Prevent unauthorized access and piracy with robust authentication.",
  },
  {
    icon: Key,
    title: "License Management",
    description:
      "Generate, distribute, and manage license keys with granular control. Set durations, levels, and usage limits effortlessly.",
  },
  {
    icon: Users,
    title: "User Management",
    description:
      "Track your authenticated users, monitor sessions, ban abusers, and manage hardware ID locks from one dashboard.",
  },
  {
    icon: Zap,
    title: "Token System",
    description:
      "Create single-use registration tokens for controlled user onboarding. Monitor redemption and track usage in real time.",
  },
  {
    icon: Lock,
    title: "HWID Locking",
    description:
      "Bind licenses and users to specific hardware IDs. Prevent account sharing and enforce per-device licensing policies.",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description:
      "Get real-time insights into your application's usage. Monitor active users, license activations, and token redemptions.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold tracking-tight">KeyVault</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a href="/api/login">
              <Button data-testid="button-login">Log In</Button>
            </a>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="relative mx-auto max-w-6xl px-6 py-24 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm text-muted-foreground">
              <CheckCircle className="h-3.5 w-3.5 text-primary" />
              Software licensing made simple
            </div>
            <h1 className="font-serif text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Protect and Monetize
              <span className="block text-primary">Your Software</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
              The complete authentication and licensing platform. Manage
              applications, licenses, users, and tokens from a single powerful
              dashboard.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <a href="/api/login">
                <Button size="lg" data-testid="button-get-started">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
              <Button size="lg" variant="outline" data-testid="button-learn-more">
                Learn More
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-primary" />
                Free forever plan
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-primary" />
                No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-primary" />
                Unlimited applications
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t bg-card/50 py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 text-center">
            <h2 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
              Everything You Need
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              A complete toolkit for software licensing, authentication, and
              user management.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="group p-6 hover-elevate"
              >
                <div className="mb-4 inline-flex rounded-md bg-primary/10 p-2.5">
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

      <section className="border-t py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to Secure Your Software?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
            Join developers who trust KeyVault to protect and manage their
            applications.
          </p>
          <div className="mt-8">
            <a href="/api/login">
              <Button size="lg" data-testid="button-cta-get-started">
                Get Started Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <div className="mx-auto max-w-6xl px-6">
          KeyVault &mdash; Software Licensing Platform
        </div>
      </footer>
    </div>
  );
}
