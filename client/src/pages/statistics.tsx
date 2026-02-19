import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AppWindow,
  Key,
  Users,
  Coins,
  TrendingUp,
  ShieldCheck,
  ShieldOff,
  Ban,
  CheckCircle,
  XCircle,
  Activity,
} from "lucide-react";

interface PerAppStat {
  appId: string;
  appName: string;
  enabled: boolean;
  version: string | null;
  totalLicenses: number;
  activeLicenses: number;
  usedLicenses: number;
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  totalTokens: number;
  usedTokens: number;
}

interface Statistics {
  overview: {
    totalApps: number;
    enabledApps: number;
    totalLicenses: number;
    activeLicenses: number;
    usedLicenses: number;
    expiredLicenses: number;
    totalUsers: number;
    activeUsers: number;
    bannedUsers: number;
    totalTokens: number;
    usedTokens: number;
    unusedTokens: number;
  };
  perApp: PerAppStat[];
  licensesByLevel: Record<string, number>;
  usersByLevel: Record<string, number>;
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
  sub,
  delay,
}: {
  label: string;
  value: number;
  icon: any;
  color: string;
  bg: string;
  sub?: string;
  delay?: number;
}) {
  return (
    <Card
      className="p-4 animate-slide-up"
      style={{ animationDelay: `${delay || 0}s` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
            {value}
          </p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={`rounded-md p-2 ${bg}`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </div>
    </Card>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

export default function StatisticsPage() {
  const { data: stats, isLoading } = useQuery<Statistics>({
    queryKey: ["/api/statistics"],
  });

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="mb-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-80" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;
  const { overview, perApp, licensesByLevel, usersByLevel } = stats;

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-primary/10 p-2">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-statistics-title">
              Statistics
            </h1>
            <p className="text-sm text-muted-foreground">
              Real-time analytics across all your applications.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Apps" value={overview.totalApps} icon={AppWindow} color="text-blue-400" bg="bg-blue-500/10" sub={`${overview.enabledApps} enabled`} delay={0} />
        <StatCard label="Total Licenses" value={overview.totalLicenses} icon={Key} color="text-emerald-400" bg="bg-emerald-500/10" sub={`${overview.activeLicenses} active`} delay={0.05} />
        <StatCard label="Total Users" value={overview.totalUsers} icon={Users} color="text-amber-400" bg="bg-amber-500/10" sub={`${overview.activeUsers} active`} delay={0.1} />
        <StatCard label="Total Tokens" value={overview.totalTokens} icon={Coins} color="text-purple-400" bg="bg-purple-500/10" sub={`${overview.usedTokens} used`} delay={0.15} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-5 animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <Key className="h-4 w-4 text-emerald-400" />
            License Breakdown
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Active
              </span>
              <span className="text-sm font-medium tabular-nums" data-testid="stat-active-licenses">{overview.activeLicenses}</span>
            </div>
            <ProgressBar value={overview.activeLicenses} max={overview.totalLicenses} color="bg-emerald-500" />
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-3.5 w-3.5 text-blue-400" />
                Used
              </span>
              <span className="text-sm font-medium tabular-nums" data-testid="stat-used-licenses">{overview.usedLicenses}</span>
            </div>
            <ProgressBar value={overview.usedLicenses} max={overview.totalLicenses} color="bg-blue-500" />
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-sm">
                <XCircle className="h-3.5 w-3.5 text-red-400" />
                Expired
              </span>
              <span className="text-sm font-medium tabular-nums" data-testid="stat-expired-licenses">{overview.expiredLicenses}</span>
            </div>
            <ProgressBar value={overview.expiredLicenses} max={overview.totalLicenses} color="bg-red-500" />
          </div>
        </Card>

        <Card className="p-5 animate-slide-up" style={{ animationDelay: "0.25s" }}>
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <Users className="h-4 w-4 text-amber-400" />
            User Breakdown
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Active
              </span>
              <span className="text-sm font-medium tabular-nums" data-testid="stat-active-users">{overview.activeUsers}</span>
            </div>
            <ProgressBar value={overview.activeUsers} max={overview.totalUsers} color="bg-emerald-500" />
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-sm">
                <Ban className="h-3.5 w-3.5 text-red-400" />
                Banned
              </span>
              <span className="text-sm font-medium tabular-nums" data-testid="stat-banned-users">{overview.bannedUsers}</span>
            </div>
            <ProgressBar value={overview.bannedUsers} max={overview.totalUsers} color="bg-red-500" />
          </div>
        </Card>

        <Card className="p-5 animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <Coins className="h-4 w-4 text-purple-400" />
            Token Breakdown
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                Used
              </span>
              <span className="text-sm font-medium tabular-nums" data-testid="stat-used-tokens">{overview.usedTokens}</span>
            </div>
            <ProgressBar value={overview.usedTokens} max={overview.totalTokens} color="bg-emerald-500" />
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-sm">
                <ShieldOff className="h-3.5 w-3.5 text-muted-foreground" />
                Unused
              </span>
              <span className="text-sm font-medium tabular-nums" data-testid="stat-unused-tokens">{overview.unusedTokens}</span>
            </div>
            <ProgressBar value={overview.unusedTokens} max={overview.totalTokens} color="bg-muted-foreground" />
          </div>
        </Card>
      </div>

      {Object.keys(licensesByLevel).length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Card className="p-5 animate-slide-up" style={{ animationDelay: "0.35s" }}>
            <h3 className="mb-4 flex items-center gap-2 font-semibold">
              <TrendingUp className="h-4 w-4 text-primary" />
              Licenses by Level
            </h3>
            <div className="space-y-2">
              {Object.entries(licensesByLevel).sort(([a], [b]) => Number(a) - Number(b)).map(([level, count]) => (
                <div key={level} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">Level {level}</Badge>
                  </div>
                  <span className="text-sm font-medium tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 animate-slide-up" style={{ animationDelay: "0.4s" }}>
            <h3 className="mb-4 flex items-center gap-2 font-semibold">
              <TrendingUp className="h-4 w-4 text-primary" />
              Users by Level
            </h3>
            <div className="space-y-2">
              {Object.entries(usersByLevel).sort(([a], [b]) => Number(a) - Number(b)).map(([level, count]) => (
                <div key={level} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">Level {level}</Badge>
                  </div>
                  <span className="text-sm font-medium tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {perApp.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-4 text-lg font-semibold">Per-Application Breakdown</h3>
          <div className="grid gap-4 lg:grid-cols-2">
            {perApp.map((app, i) => (
              <Card key={app.appId} className="p-5 animate-slide-up" style={{ animationDelay: `${0.45 + i * 0.05}s` }}>
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-primary/10 p-2">
                      <AppWindow className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold" data-testid={`stat-app-name-${app.appId}`}>{app.appName}</p>
                      <p className="text-xs text-muted-foreground">v{app.version}</p>
                    </div>
                  </div>
                  <Badge variant={app.enabled ? "secondary" : "destructive"} className="text-xs">
                    {app.enabled ? "Active" : "Disabled"}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-xl font-bold tabular-nums">{app.totalLicenses}</p>
                    <p className="text-xs text-muted-foreground">Licenses</p>
                    <p className="text-xs text-emerald-400">{app.usedLicenses} used</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold tabular-nums">{app.totalUsers}</p>
                    <p className="text-xs text-muted-foreground">Users</p>
                    <p className="text-xs text-emerald-400">{app.activeUsers} active</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold tabular-nums">{app.totalTokens}</p>
                    <p className="text-xs text-muted-foreground">Tokens</p>
                    <p className="text-xs text-emerald-400">{app.usedTokens} used</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
