import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { isUnauthorizedError } from "@/lib/auth-utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreVertical,
  Copy,
  Trash2,
  AppWindow,
  Search,
  Eye,
  EyeOff,
  Key,
  Activity,
  Pause,
  Radio,
  Code,
} from "lucide-react";
import type { Application } from "@shared/schema";

const SUPPORTED_LANGUAGES = [
  "C#", "C++", "Python", "PHP", "JavaScript", "TypeScript",
  "Java", "VB.Net", "Rust", "Go", "Lua", "Ruby", "Perl",
] as const;

type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

function getCodeSnippet(lang: SupportedLanguage, app: Application, ownerId: string): string {
  const name = app.name;
  const secret = app.secret;
  const version = app.version || "1.0";
  const paddedOwnerId = ownerId;
  const apiUrl = window.location.origin + "/api/1.3/";

  switch (lang) {
    case "C#":
      return `public static KeyAuthManager.api KeyAuthApp = new KeyAuthManager.api(
    name: "${name}",
    ownerid: "${paddedOwnerId}",
    secret: "${secret}",
    version: "${version}",
    apiUrl: "${window.location.origin}/api/1.2/"
);`;
    case "C++":
      return `std::string name = "${name}";
std::string ownerid = "${paddedOwnerId}";
std::string version = "${version}";
std::string url = "${window.location.origin}/api/1.3/";
std::string path = "";

KeyAuth::api KeyAuthApp(name, ownerid, version, url, path);`;
    case "Python":
      return `keyauthapp = api(
    name="${name}",
    ownerid="${paddedOwnerId}",
    secret="${secret}",
    version="${version}",
    url="${apiUrl}"
)`;
    case "Java":
      return `public static KeyAuthManager KeyAuthApp = new KeyAuthManager(
    "${name}",
    "${paddedOwnerId}",
    "${secret}",
    "${version}",
    "${apiUrl}"
);`;
    default:
      return `name: "${name}"
ownerid: "${paddedOwnerId}"
secret: "${secret}"
version: "${version}"
url: "${apiUrl}"`;
  }
}

export default function ManageAppsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newAppName, setNewAppName] = useState("");
  const [newAppVersion, setNewAppVersion] = useState("1.0");
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  const [selectedCredApp, setSelectedCredApp] = useState("");
  const [showSnippet, setShowSnippet] = useState(false);
  const [snippetLang, setSnippetLang] = useState<SupportedLanguage>("C#");

  const { data: apps, isLoading } = useQuery<Application[]>({
    queryKey: ["/api/applications"],
  });

  const selectedApp = apps?.find((a) => a.id === selectedCredApp);

  useEffect(() => {
    if (apps && apps.length > 0 && !selectedCredApp) {
      setSelectedCredApp(apps[0].id);
    }
  }, [apps, selectedCredApp]);

  const createApp = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/applications", {
        name: newAppName,
        version: newAppVersion,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      setDialogOpen(false);
      setNewAppName("");
      setNewAppVersion("1.0");
      toast({ title: "Application created successfully" });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleApp = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await apiRequest("PATCH", `/api/applications/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteApp = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/applications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/app-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tokens"] });
      setSelectedCredApp("");
      toast({ title: "Application deleted" });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied to clipboard` });
  };

  const toggleSecret = (id: string) => {
    setRevealedSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = apps?.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalApps = apps?.length ?? 0;
  const activeApps = apps?.filter((a) => a.enabled).length ?? 0;
  const pausedApps = apps?.filter((a) => !a.enabled).length ?? 0;
  const ownerId = user?.numericId || user?.id || "";

  const stats = [
    { label: "Total Apps", value: totalApps, icon: AppWindow, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Active", value: activeApps, icon: Activity, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Paused", value: pausedApps, icon: Pause, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Active Sessions", value: 0, icon: Radio, color: "text-purple-400", bg: "bg-purple-500/10" },
  ];

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-manage-apps-title">Manage Applications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your applications and view credentials
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {stats.map((stat, i) => (
          <Card key={stat.label} className="p-5 animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                {isLoading ? (
                  <Skeleton className="mt-2 h-8 w-16" />
                ) : (
                  <p className="mt-1 text-3xl font-bold tabular-nums" data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>
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

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Card className="p-5 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <h2 className="text-lg font-semibold mb-1" data-testid="text-credentials-title">Application Credentials</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Simply replace the placeholder code in the example with these
            </p>

            {apps && apps.length > 1 && (
              <div className="mb-4">
                <Select value={selectedCredApp} onValueChange={setSelectedCredApp}>
                  <SelectTrigger data-testid="select-cred-app">
                    <SelectValue placeholder="Select application" />
                  </SelectTrigger>
                  <SelectContent>
                    {apps.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Switch
                checked={showSnippet}
                onCheckedChange={setShowSnippet}
                data-testid="switch-code-snippet"
              />
              <span className="text-sm font-medium">Display Code Snippet</span>
            </div>

            {showSnippet && selectedApp ? (
              <div className="space-y-3">
                <Select value={snippetLang} onValueChange={(v) => setSnippetLang(v as SupportedLanguage)}>
                  <SelectTrigger data-testid="select-snippet-lang">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative">
                  <pre className="rounded-md bg-muted p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all" data-testid="text-code-snippet">
                    {getCodeSnippet(snippetLang, selectedApp, ownerId)}
                  </pre>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(getCodeSnippet(snippetLang, selectedApp, ownerId), "Code snippet")}
                    data-testid="button-copy-snippet"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : selectedApp ? (
              <div className="space-y-3">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Application Name</p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate" data-testid="text-cred-name">{selectedApp.name}</p>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copyToClipboard(selectedApp.name, "Application Name")}
                      data-testid="button-copy-name"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Account Owner ID</p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-mono" data-testid="text-cred-ownerid">{ownerId}</p>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copyToClipboard(ownerId, "Owner ID")}
                      data-testid="button-copy-ownerid"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Application Secret</p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-mono truncate" data-testid="text-cred-secret">{selectedApp.secret}</p>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copyToClipboard(selectedApp.secret, "Application Secret")}
                      data-testid="button-copy-secret"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No application selected</p>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">My Applications</h2>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-app">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Application
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Application</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Name</label>
                    <Input
                      value={newAppName}
                      onChange={(e) => setNewAppName(e.target.value)}
                      placeholder="My Application"
                      data-testid="input-app-name"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Version</label>
                    <Input
                      value={newAppVersion}
                      onChange={(e) => setNewAppVersion(e.target.value)}
                      placeholder="1.0"
                      data-testid="input-app-version"
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => createApp.mutate()}
                    disabled={!newAppName.trim() || createApp.isPending}
                    data-testid="button-submit-app"
                  >
                    {createApp.isPending ? "Creating..." : "Create Application"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search applications..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-apps"
            />
          </div>

          <p className="text-sm text-muted-foreground">All Applications</p>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : filtered && filtered.length > 0 ? (
            <div className="space-y-3">
              {filtered.map((app) => (
                <Card key={app.id} className="p-5" data-testid={`card-app-${app.id}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex flex-wrap items-start gap-4">
                      <div className="rounded-md bg-primary/10 p-2.5">
                        <AppWindow className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{app.name}</h3>
                          <Badge variant="secondary">v{app.version}</Badge>
                          <Badge variant={app.enabled ? "default" : "secondary"}>
                            {app.enabled ? "Active" : "Paused"}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex flex-wrap items-center gap-1">
                            ID:
                            <code className="font-mono">{app.id.slice(0, 8)}...</code>
                            <button
                              onClick={() => copyToClipboard(app.id, "App ID")}
                              className="text-muted-foreground transition-colors"
                              data-testid={`button-copy-appid-${app.id}`}
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </span>
                          <span className="flex flex-wrap items-center gap-1">
                            Secret:
                            <code className="font-mono">
                              {revealedSecrets.has(app.id)
                                ? app.secret
                                : app.secret.slice(0, 8) + "..."}
                            </code>
                            <button
                              onClick={() => toggleSecret(app.id)}
                              className="text-muted-foreground transition-colors"
                              data-testid={`button-toggle-secret-${app.id}`}
                            >
                              {revealedSecrets.has(app.id) ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </button>
                            <button
                              onClick={() => copyToClipboard(app.secret, "Secret")}
                              className="text-muted-foreground transition-colors"
                              data-testid={`button-copy-secret-${app.id}`}
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Switch
                        checked={app.enabled ?? false}
                        onCheckedChange={(val) =>
                          toggleApp.mutate({ id: app.id, enabled: val })
                        }
                        data-testid={`switch-app-${app.id}`}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" data-testid={`menu-app-${app.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedCredApp(app.id);
                            }}
                          >
                            <Code className="mr-2 h-4 w-4" /> View Credentials
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => copyToClipboard(app.id, "App ID")}
                          >
                            <Copy className="mr-2 h-4 w-4" /> Copy App ID
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => copyToClipboard(app.secret, "Secret")}
                          >
                            <Key className="mr-2 h-4 w-4" /> Copy Secret
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteApp.mutate(app.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="flex flex-col items-center justify-center p-12 text-center">
              <AppWindow className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="font-semibold">No applications found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first application to get started.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
