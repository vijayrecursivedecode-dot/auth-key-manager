import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AppWindow, Key, Users, Coins } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
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
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Licenses",
      value: licenses?.length ?? 0,
      icon: Key,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Users",
      value: appUsers?.length ?? 0,
      icon: Users,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      label: "Tokens",
      value: tokens?.length ?? 0,
      icon: Coins,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
  ];

  const isLoading = appsLoading || licensesLoading || usersLoading || tokensLoading;

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">
          Welcome back, {user?.firstName || "Developer"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here&apos;s an overview of your licensing platform.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-8 w-16" />
                ) : (
                  <p className="mt-1 text-3xl font-bold" data-testid={`stat-${stat.label.toLowerCase()}`}>
                    {stat.value}
                  </p>
                )}
              </div>
              <div className={`rounded-md p-2.5 ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 font-semibold">Recent Applications</h3>
          {appsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
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
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      app.enabled
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {app.enabled ? "Active" : "Disabled"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No applications yet. Create your first one.
            </p>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 font-semibold">Recent Licenses</h3>
          {licensesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
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
                      <Key className="h-4 w-4 text-emerald-500" />
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
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      lic.enabled
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {lic.enabled ? "Active" : "Disabled"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No licenses yet. Generate some for your apps.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
