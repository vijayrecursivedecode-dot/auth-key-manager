import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/auth-utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
} from "lucide-react";
import type { Application } from "@shared/schema";

export default function ManageAppsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newAppName, setNewAppName] = useState("");
  const [newAppVersion, setNewAppVersion] = useState("1.0");
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());

  const { data: apps, isLoading } = useQuery<Application[]>({
    queryKey: ["/api/applications"],
  });

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

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Applications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your registered applications
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-app">
              <Plus className="mr-2 h-4 w-4" />
              New Application
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

      <div className="mb-4">
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
      </div>

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
                <div className="flex items-start gap-4">
                  <div className="rounded-md bg-primary/10 p-2.5">
                    <AppWindow className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{app.name}</h3>
                      <Badge variant="secondary">v{app.version}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        ID:
                        <code className="font-mono">{app.id.slice(0, 8)}...</code>
                        <button
                          onClick={() => copyToClipboard(app.id, "App ID")}
                          className="text-muted-foreground transition-colors"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </span>
                      <span className="flex items-center gap-1">
                        Secret:
                        <code className="font-mono">
                          {revealedSecrets.has(app.id)
                            ? app.secret
                            : "••••••••••••"}
                        </code>
                        <button
                          onClick={() => toggleSecret(app.id)}
                          className="text-muted-foreground transition-colors"
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
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
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
  );
}
