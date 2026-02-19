import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AppWindow, Key, Users, Coins, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import type { Application, License, AppUser, Token } from "@shared/schema";

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: apps, isLoading: appsLoading } = useQuery<Application[]>({
    queryKey: ["/api/applications"],
  });
  const { data: licenses, isLoading: licensesLoading } = useQuery<License[]>({
    queryKey: ["/api/licenses"],
  });
  const { data: appUsers, isLoading: usersLoading } = useQuery<AppUser[]>({
    queryKey: ["/api/app-users"],
  });
  const { data: tokens, isLoading: tokensLoading } = useQuery<Token[]>({
    queryKey: ["/api/tokens"],
  });

  const stats = [
    {
      label: "Applications",
      value: apps?.length ?? 0,
      icon: AppWindow,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      href: "/dashboard/apps",
    },
    {
      label: "Licenses",
      value: licenses?.length ?? 0,
      icon: Key,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      href: "/dashboard/licenses",
    },
    {
      label: "Users",
      value: appUsers?.length ?? 0,
      icon: Users,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      href: "/dashboard/users",
    },
    {
      label: "Tokens",
      value: tokens?.length ?? 0,
      icon: Coins,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      href: "/dashboard/tokens",
    },
  ];

  const isLoading = appsLoading || licensesLoading || usersLoading || tokensLoading;

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">
          Welcome back, {user?.firstName || "Developer"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s an overview of your licensing platform.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="group p-5 hover-elevate animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  {isLoading ? (
                    <Skeleton className="mt-2 h-8 w-16" />
                  ) : (
                    <p className="mt-1 text-3xl font-bold tabular-nums" data-testid={`stat-${stat.label.toLowerCase()}`}>
                      {stat.value}
                    </p>
                  )}
                </div>
                <div className={`rounded-md p-2.5 ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card className="p-5 animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h3 className="font-semibold">Recent Applications</h3>
            <Link href="/dashboard/apps">
              <Button variant="ghost" size="sm" data-testid="link-view-all-apps">
                View all
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>
          {appsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : apps && apps.length > 0 ? (
            <div className="space-y-2">
              {apps.slice(0, 5).map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between gap-4 rounded-md border p-3"
                  data-testid={`app-row-${app.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-primary/10 p-2">
                      <AppWindow className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{app.name}</p>
                      <p className="text-xs text-muted-foreground">
                        v{app.version}
                      </p>
                    </div>
                  </div>
                  <Badge variant={app.enabled ? "secondary" : "destructive"} className="text-xs">
                    {app.enabled ? "Active" : "Disabled"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AppWindow className="mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No applications yet. Create your first one.
              </p>
              <Link href="/dashboard/apps">
                <Button size="sm" className="mt-3" data-testid="button-create-first-app">
                  Create Application
                </Button>
              </Link>
            </div>
          )}
        </Card>

        <Card className="p-5 animate-slide-up" style={{ animationDelay: "0.25s" }}>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h3 className="font-semibold">Recent Licenses</h3>
            <Link href="/dashboard/licenses">
              <Button variant="ghost" size="sm" data-testid="link-view-all-licenses">
                View all
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>
          {licensesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : licenses && licenses.length > 0 ? (
            <div className="space-y-2">
              {licenses.slice(0, 5).map((lic) => (
                <div
                  key={lic.id}
                  className="flex items-center justify-between gap-4 rounded-md border p-3"
                  data-testid={`license-row-${lic.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-emerald-500/10 p-2">
                      <Key className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-mono text-xs font-medium">
                        {lic.licenseKey.slice(0, 24)}...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lic.note || "No note"}
                      </p>
                    </div>
                  </div>
                  <Badge variant={lic.enabled ? "secondary" : "destructive"} className="text-xs">
                    {lic.enabled ? "Active" : "Disabled"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Key className="mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No licenses yet. Generate some for your apps.
              </p>
              <Link href="/dashboard/licenses">
                <Button size="sm" className="mt-3" data-testid="button-create-first-license">
                  Generate Licenses
                </Button>
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
