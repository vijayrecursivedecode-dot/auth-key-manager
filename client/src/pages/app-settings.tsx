import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { isUnauthorizedError } from "@/lib/auth-utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Save, RotateCcw, Settings, Copy, RefreshCw, Code, ExternalLink, Download, FileCode, Plus, Trash2, Eye, EyeOff, ShieldCheck, Info, Bot } from "lucide-react";
import type { Application, Seller } from "@shared/schema";

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
      return `// Replace your existing KeyAuth.cs with KeyAuth_KeyVault.cs from SDK Downloads tab
// Then update your initialization:
public static KeyAuthManager.api KeyAuthApp = new KeyAuthManager.api(
    name: "${name}",
    ownerid: "${paddedOwnerId}",
    secret: "${secret}",
    version: "${version}",
    apiUrl: "${window.location.origin}/api/1.2/"
);`;
    case "C++":
      return `// Use auth_keyvault.cpp from SDK Downloads tab
std::string name = "${name}";
std::string ownerid = "${paddedOwnerId}";
std::string version = "${version}";
std::string url = "${window.location.origin}/api/1.3/";
std::string path = "";

KeyAuth::api KeyAuthApp(name, ownerid, version, url, path);`;
    case "Java":
      return `public static KeyAuthManager KeyAuthApp = new KeyAuthManager(
    "${name}",
    "${paddedOwnerId}",
    "${secret}",
    "${version}",
    "${apiUrl}"
);`;
    case "Python":
      return `keyauthapp = api(
    name="${name}",
    ownerid="${paddedOwnerId}",
    secret="${secret}",
    version="${version}",
    url="${apiUrl}"
)`;
    case "PHP":
      return `$KeyAuthApp = new KeyAuthManager\\api(
    "${name}",
    "${paddedOwnerId}",
    "${secret}",
    "${version}",
    "${apiUrl}"
);`;
    case "JavaScript":
      return `const KeyAuthApp = new KeyAuthManager({
    name: "${name}",
    ownerId: "${paddedOwnerId}",
    secret: "${secret}",
    version: "${version}",
    url: "${apiUrl}"
});`;
    case "TypeScript":
      return `const KeyAuthApp: KeyAuthManager = new KeyAuthManager({
    name: "${name}",
    ownerId: "${paddedOwnerId}",
    secret: "${secret}",
    version: "${version}",
    url: "${apiUrl}"
});`;
    case "VB.Net":
      return `Public Shared KeyAuthApp As New api(
    name:="${name}",
    ownerid:="${paddedOwnerId}",
    secret:="${secret}",
    version:="${version}",
    url:="${apiUrl}"
)`;
    case "Rust":
      return `let mut keyauthapp = KeyAuthApi::new(
    "${name}",
    "${paddedOwnerId}",
    "${secret}",
    "${version}",
    "${apiUrl}"
);`;
    case "Go":
      return `var api = keyauth.KeyAuthManager{
    Name:    "${name}",
    OwnerId: "${paddedOwnerId}",
    Secret:  "${secret}",
    Version: "${version}",
    Url:     "${apiUrl}",
}`;
    case "Lua":
      return `local KeyAuthApp = KeyAuthManager:new(
    "${name}",
    "${paddedOwnerId}",
    "${secret}",
    "${version}",
    "${apiUrl}"
)`;
    case "Ruby":
      return `keyauth_app = KeyAuthManager::API.new(
    name: "${name}",
    owner_id: "${paddedOwnerId}",
    secret: "${secret}",
    version: "${version}",
    url: "${apiUrl}"
)`;
    case "Perl":
      return `my $keyauth = KeyAuthManager::API->new(
    name     => "${name}",
    owner_id => "${paddedOwnerId}",
    secret   => "${secret}",
    version  => "${version}",
    url      => "${apiUrl}"
);`;
    default:
      return "";
  }
}

export default function AppSettingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedAppId, setSelectedAppId] = useState("");
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [hwidLock, setHwidLock] = useState(false);
  const [showSnippet, setShowSnippet] = useState(false);
  const [snippetLang, setSnippetLang] = useState<SupportedLanguage>("C#");

  const { data: apps, isLoading } = useQuery<Application[]>({
    queryKey: ["/api/applications"],
  });

  const { data: publicKeyData } = useQuery<{ publicKey: string }>({
    queryKey: ["/api/public-key"],
  });

  const selectedApp = apps?.find((a) => a.id === selectedAppId);

  useEffect(() => {
    if (apps && apps.length > 0 && !selectedAppId) {
      setSelectedAppId(apps[0].id);
    }
  }, [apps, selectedAppId]);

  useEffect(() => {
    if (selectedApp) {
      setName(selectedApp.name);
      setVersion(selectedApp.version || "1.0");
      setEnabled(selectedApp.enabled ?? true);
      setHwidLock(selectedApp.hwidLock ?? false);
    }
  }, [selectedApp]);

  const updateApp = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/applications/${selectedAppId}`, {
        name,
        version,
        enabled,
        hwidLock,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      toast({ title: "Settings saved successfully" });
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

  const resetSecret = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/applications/${selectedAppId}/reset-secret`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      toast({ title: "Secret reset successfully" });
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

  const resetForm = () => {
    if (selectedApp) {
      setName(selectedApp.name);
      setVersion(selectedApp.version || "1.0");
      setEnabled(selectedApp.enabled ?? true);
      setHwidLock(selectedApp.hwidLock ?? false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8">
        <Skeleton className="mb-6 h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!apps || apps.length === 0) {
    return (
      <div className="p-6 lg:p-8">
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Settings className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="font-semibold">No applications</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create an application first to configure its settings.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">App Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure application settings
        </p>
      </div>

      <div className="mb-6 max-w-sm">
        <label className="mb-1.5 block text-sm font-medium">
          Select Application
        </label>
        <Select value={selectedAppId} onValueChange={setSelectedAppId}>
          <SelectTrigger data-testid="select-settings-app">
            <SelectValue placeholder="Select application" />
          </SelectTrigger>
          <SelectContent>
            {apps.map((app) => (
              <SelectItem key={app.id} value={app.id}>
                {app.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedApp && (
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general" data-testid="tab-general">
              General
            </TabsTrigger>
            <TabsTrigger value="security" data-testid="tab-security">
              Security
            </TabsTrigger>
            <TabsTrigger value="credentials" data-testid="tab-credentials">
              Credentials
            </TabsTrigger>
            <TabsTrigger value="sdk" data-testid="tab-sdk">
              SDK Downloads
            </TabsTrigger>
            <TabsTrigger value="seller" data-testid="tab-seller">
              Seller
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-4">
            <Card className="max-w-2xl p-6">
              <h3 className="mb-4 font-semibold">General Settings</h3>
              <div className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Application Name
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    data-testid="input-settings-name"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Version
                  </label>
                  <Input
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    data-testid="input-settings-version"
                  />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-md border p-4">
                  <div>
                    <p className="text-sm font-medium">Application Enabled</p>
                    <p className="text-xs text-muted-foreground">
                      Disable to prevent all authentication requests
                    </p>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={setEnabled}
                    data-testid="switch-settings-enabled"
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    onClick={() => updateApp.mutate()}
                    disabled={updateApp.isPending}
                    data-testid="button-save-settings"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {updateApp.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button variant="outline" onClick={resetForm}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="mt-4">
            <Card className="max-w-2xl p-6">
              <h3 className="mb-4 font-semibold">Security Settings</h3>
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-4 rounded-md border p-4">
                  <div>
                    <p className="text-sm font-medium">HWID Lock</p>
                    <p className="text-xs text-muted-foreground">
                      Bind users to specific hardware IDs to prevent sharing
                    </p>
                  </div>
                  <Switch
                    checked={hwidLock}
                    onCheckedChange={setHwidLock}
                    data-testid="switch-settings-hwid"
                  />
                </div>
                <Button
                  onClick={() => updateApp.mutate()}
                  disabled={updateApp.isPending}
                  data-testid="button-save-security"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {updateApp.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="credentials" className="mt-4 space-y-4">
            <Card className="max-w-2xl p-6">
              <h3 className="mb-1 font-semibold">Application Credentials</h3>
              <p className="mb-5 text-sm text-muted-foreground">
                Simply replace the placeholder code in the example with these
              </p>

              <div className="mb-5 flex items-center gap-3">
                <Switch
                  checked={showSnippet}
                  onCheckedChange={setShowSnippet}
                  data-testid="switch-show-snippet"
                />
                <span className="text-sm font-medium">Display Code Snippet</span>
              </div>

              <div className="space-y-4">
                <div className="rounded-md border p-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Application Name
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold" data-testid="text-cred-app-name">
                      {selectedApp.name}
                    </p>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copyToClipboard(selectedApp.name, "App Name")}
                      data-testid="button-copy-app-name"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border p-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Account Owner ID
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-sm" data-testid="text-cred-owner-id">
                      {(user as any)?.numericId || user?.id || ""}
                    </p>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copyToClipboard((user as any)?.numericId || user?.id || "", "Owner ID")}
                      data-testid="button-copy-owner-id"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border p-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Application Secret
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="overflow-x-auto font-mono text-sm" data-testid="text-cred-secret">
                      {selectedApp.secret}
                    </p>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copyToClipboard(selectedApp.secret, "Secret")}
                      data-testid="button-copy-secret"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border p-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Application Version
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold" data-testid="text-cred-version">
                      {selectedApp.version || "1.0"}
                    </p>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copyToClipboard(selectedApp.version || "1.0", "Version")}
                      data-testid="button-copy-version"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="rounded-md border p-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Ed25519 Public Key (for auth.cpp)
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="overflow-x-auto font-mono text-xs break-all" data-testid="text-cred-public-key">
                      {publicKeyData?.publicKey || "Loading..."}
                    </p>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copyToClipboard(publicKeyData?.publicKey || "", "Public Key")}
                      data-testid="button-copy-public-key"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <Button
                variant="destructive"
                className="mt-5 w-full"
                onClick={() => resetSecret.mutate()}
                disabled={resetSecret.isPending}
                data-testid="button-reset-secret"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {resetSecret.isPending ? "Resetting..." : "Refresh Application Secret"}
              </Button>
            </Card>

            {showSnippet && selectedApp && (
              <Card className="max-w-2xl p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                  <h3 className="font-semibold">Code Snippet</h3>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Select Language:</label>
                    <Select
                      value={snippetLang}
                      onValueChange={(v) => setSnippetLang(v as SupportedLanguage)}
                    >
                      <SelectTrigger className="w-[140px]" data-testid="select-snippet-lang">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_LANGUAGES.map((lang) => (
                          <SelectItem key={lang} value={lang}>
                            {lang}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-md border bg-muted/50 p-4">
                  <pre className="overflow-x-auto text-sm leading-relaxed">
                    <code data-testid="text-code-snippet">
                      {getCodeSnippet(snippetLang, selectedApp, (user as any)?.numericId || user?.id || "")}
                    </code>
                  </pre>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="default"
                    onClick={() =>
                      copyToClipboard(
                        getCodeSnippet(snippetLang, selectedApp, (user as any)?.numericId || user?.id || ""),
                        "Code snippet"
                      )
                    }
                    data-testid="button-copy-code"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Code
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      window.open(
                        `https://github.com/KeyAuth/${snippetLang === "C#" ? "KeyAuth-CSHARP-Example" : snippetLang === "C++" ? "KeyAuth-CPP-Example" : snippetLang === "Python" ? "KeyAuth-Python-Example" : snippetLang === "Java" ? "KeyAuth-Java-Example" : "KeyAuth-" + snippetLang + "-Example"}`,
                        "_blank"
                      )
                    }
                    data-testid="button-view-example"
                  >
                    <Code className="mr-2 h-4 w-4" />
                    View Example
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      window.open("https://keyauth.readme.io/reference/", "_blank")
                    }
                    data-testid="button-view-tutorial"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Tutorial
                  </Button>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="sdk" className="mt-4 space-y-4">
            <Card className="max-w-2xl p-6">
              <h3 className="mb-1 font-semibold">Client SDK Downloads</h3>
              <p className="mb-5 text-sm text-muted-foreground">
                Download pre-configured client libraries with your server's URL and signing key already embedded. Drop these files into your project to get started.
              </p>

              <div className="space-y-4">
                <div className="rounded-md border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileCode className="h-5 w-5 text-muted-foreground" />
                        <p className="font-semibold">C++ Client Library</p>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Drop-in replacement for the KeyAuth C++ auth.cpp file. Uses libsodium for Ed25519 signature verification.
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        File: <span className="font-mono">auth_keyvault.cpp</span>
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = "/auth_keyvault.cpp";
                        a.download = "auth_keyvault.cpp";
                        a.click();
                      }}
                      data-testid="button-download-cpp"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download .cpp
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileCode className="h-5 w-5 text-muted-foreground" />
                        <p className="font-semibold">C# Client Library</p>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Drop-in replacement for the KeyAuth C# KeyAuth.cs file. Uses HMAC-SHA256 signature verification.
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        File: <span className="font-mono">KeyAuth_KeyVault.cs</span>
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = "/KeyAuth_KeyVault.cs";
                        a.download = "KeyAuth_KeyVault.cs";
                        a.click();
                      }}
                      data-testid="button-download-cs"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download .cs
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="max-w-2xl p-6">
              <h3 className="mb-1 font-semibold">Quick Setup: Use Your Existing KeyAuth Project</h3>
              <p className="mb-5 text-sm text-muted-foreground">
                Already have KeyAuth in your C++ or C# project? Just two quick changes and you're done.
              </p>

              <div className="space-y-6">
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
                  <p className="text-sm font-semibold mb-2">Step 1: Update the Public Key in auth.cpp / KeyAuth.cs</p>
                  <p className="text-sm text-muted-foreground mb-3">
                    Open your <span className="font-mono">auth.cpp</span> (or <span className="font-mono">KeyAuth.cs</span>) and find the <span className="font-mono">API_PUBLIC_KEY</span> line. Replace it with your KeyAuth Manager public key:
                  </p>
                  <div className="rounded-md border bg-muted/50 p-3 mb-3">
                    <p className="text-xs text-muted-foreground mb-1">C++ (auth.cpp):</p>
                    <pre className="overflow-x-auto text-xs leading-relaxed">
                      <code data-testid="text-public-key-cpp">{`std::string API_PUBLIC_KEY = "${publicKeyData?.publicKey || "loading..."}";`}</code>
                    </pre>
                  </div>
                  <div className="rounded-md border bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground mb-1">C# (KeyAuth.cs):</p>
                    <pre className="overflow-x-auto text-xs leading-relaxed">
                      <code data-testid="text-public-key-cs">{`public string api_public_key = "${publicKeyData?.publicKey || "loading..."}";`}</code>
                    </pre>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2"
                    onClick={() => copyToClipboard(
                      publicKeyData?.publicKey || "",
                      "Public key"
                    )}
                    data-testid="button-copy-public-key"
                  >
                    <Copy className="mr-2 h-3 w-3" />
                    Copy Public Key
                  </Button>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Without this change you will get "Signature verification failed (invalid signature)".
                  </p>
                </div>

                <div>
                  <p className="mb-3 text-sm font-semibold">Step 2: Update main.cpp / Program.cs</p>
                  <div className="space-y-3">
                    <div className="rounded-md border p-3">
                      <p className="text-sm font-medium">Find these lines in your main.cpp and update them:</p>
                      {selectedApp && (
                        <div className="mt-2 rounded-md border bg-muted/50 p-3">
                          <pre className="overflow-x-auto text-xs leading-relaxed">
                            <code data-testid="text-cpp-setup-code">{`std::string name = "${selectedApp.name}";
std::string ownerid = "${(user as any)?.numericId || user?.id || ""}";
std::string version = "${selectedApp.version || "1.0"}";
std::string url = "${window.location.origin}/api/1.3/";
std::string path = "";`}</code>
                          </pre>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="mt-2"
                            onClick={() => copyToClipboard(
                              `std::string name = "${selectedApp.name}";\nstd::string ownerid = "${(user as any)?.numericId || user?.id || ""}";\nstd::string version = "${selectedApp.version || "1.0"}";\nstd::string url = "${window.location.origin}/api/1.3/";\nstd::string path = "";`,
                              "C++ init code"
                            )}
                            data-testid="button-copy-cpp-init"
                          >
                            <Copy className="mr-2 h-3 w-3" />
                            Copy Code
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <p className="mb-3 text-sm font-semibold">C# Project - Update Program.cs</p>
                  <div className="space-y-3">
                    <div className="rounded-md border p-3">
                      <p className="text-sm font-medium">Replace the KeyAuth.cs with KeyAuth_KeyVault.cs from SDK Downloads, then update your init:</p>
                      {selectedApp && (
                        <div className="mt-2 rounded-md border bg-muted/50 p-3">
                          <pre className="overflow-x-auto text-xs leading-relaxed">
                            <code data-testid="text-cs-setup-code">{`KeyAuthManager.api.ApiUrl = "${window.location.origin}/api/1.2/";

public static api KeyAuthApp = new api(
    name: "${selectedApp.name}",
    ownerid: "${(user as any)?.numericId || user?.id || ""}",
    secret: "${selectedApp.secret}",
    version: "${selectedApp.version || "1.0"}"
);`}</code>
                          </pre>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="mt-2"
                            onClick={() => copyToClipboard(
                              `KeyAuthManager.api.ApiUrl = "${window.location.origin}/api/1.2/";\n\npublic static api KeyAuthApp = new api(\n    name: "${selectedApp.name}",\n    ownerid: "${(user as any)?.numericId || user?.id || ""}",\n    secret: "${selectedApp.secret}",\n    version: "${selectedApp.version || "1.0"}"\n);`,
                              "C# init code"
                            )}
                            data-testid="button-copy-cs-init"
                          >
                            <Copy className="mr-2 h-3 w-3" />
                            Copy Code
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-md border bg-muted/50 p-4">
                  <p className="text-sm font-medium mb-2">Summary: What to Change</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li><span className="font-mono">C++</span>: Change <span className="font-mono">API_PUBLIC_KEY</span> in auth.cpp + update name/ownerid/version/url in main.cpp</li>
                    <li><span className="font-mono">C#</span>: Replace KeyAuth.cs with KeyAuth_KeyVault.cs + update name/ownerid/secret/version + set ApiUrl</li>
                    <li>All functions work: init, login, register, license, upgrade, ban, check, logout</li>
                    <li>C++ API URL: <span className="font-mono">{window.location.origin}/api/1.3/</span></li>
                    <li>C# API URL: <span className="font-mono">{window.location.origin}/api/1.2/</span></li>
                  </ul>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="seller" className="mt-4 space-y-4">
            <SellerTab appId={selectedApp.id} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function SellerTab({ appId }: { appId: string }) {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [sellerName, setSellerName] = useState("");
  const [canCreateLicenses, setCanCreateLicenses] = useState(true);
  const [canDeleteLicenses, setCanDeleteLicenses] = useState(false);
  const [canCreateUsers, setCanCreateUsers] = useState(true);
  const [canDeleteUsers, setCanDeleteUsers] = useState(false);
  const [canResetUserHwid, setCanResetUserHwid] = useState(false);
  const [canBanUsers, setCanBanUsers] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const { data: allSellers, isLoading } = useQuery<Seller[]>({
    queryKey: ["/api/sellers"],
  });

  const sellers = allSellers?.filter(s => s.appId === appId) || [];

  const createSeller = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sellers", {
        appId,
        name: sellerName,
        canCreateLicenses,
        canDeleteLicenses,
        canCreateUsers,
        canDeleteUsers,
        canResetUserHwid,
        canBanUsers,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sellers"] });
      setCreateOpen(false);
      setSellerName("");
      setCanCreateLicenses(true);
      setCanDeleteLicenses(false);
      setCanCreateUsers(true);
      setCanDeleteUsers(false);
      setCanResetUserHwid(false);
      setCanBanUsers(false);
      toast({ title: "Seller created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleEnabled = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await apiRequest("PATCH", `/api/sellers/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sellers"] });
      toast({ title: "Seller updated" });
    },
  });

  const deleteSeller = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/sellers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sellers"] });
      toast({ title: "Seller deleted" });
    },
  });

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const sellerApiLink = `${window.location.origin}/api/seller`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="mb-5 text-lg font-semibold">Configuration</h3>
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Seller API Link</label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={sellerApiLink}
                  className="font-mono text-sm bg-muted"
                  data-testid="input-seller-api-link"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => copyToClipboard(sellerApiLink)}
                  data-testid="button-copy-seller-api-link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {sellers.length > 0 && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Seller Key</label>
                {sellers.map(seller => (
                  <div key={seller.id} className="mb-3">
                    {sellers.length > 1 && (
                      <span className="mb-1 block text-xs text-muted-foreground">{seller.name}</span>
                    )}
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={visibleKeys.has(seller.id) ? seller.sellerKey : "••••••••••••••••••••••••••••••••••••••••"}
                        className="font-mono text-sm bg-muted"
                        data-testid={`input-seller-key-${seller.id}`}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleKeyVisibility(seller.id)}
                        data-testid={`button-toggle-key-${seller.id}`}
                      >
                        {visibleKeys.has(seller.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => copyToClipboard(seller.sellerKey)}
                        data-testid={`button-copy-key-${seller.id}`}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="mb-5 text-lg font-semibold">Bots</h3>
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
              <div className="flex-1">
                <p className="mb-2 text-sm font-medium">Notice!</p>
                <p className="mb-3 text-sm text-muted-foreground">
                  Bots allow you to control your entire application without having to log into the website. Download the bot source code, add your bot token and seller key, then run it on any server.
                </p>

                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    data-testid="button-download-telegram-bot"
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = "/api/download/telegram-bot";
                      a.download = "keyauth-telegram-bot.zip";
                      a.click();
                    }}
                  >
                    <Bot className="h-4 w-4" />
                    Telegram Bot
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    data-testid="button-download-discord-bot"
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = "/api/download/discord-bot";
                      a.download = "keyauth-discord-bot.zip";
                      a.click();
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Discord Bot
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <div className="mb-3 flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-400" />
                <h4 className="text-sm font-semibold">Telegram Bot</h4>
              </div>
              <div className="mb-3 rounded border border-border bg-muted/50 p-3">
                <p className="mb-2 text-xs font-medium text-foreground">Quick Setup:</p>
                <ol className="list-inside list-decimal space-y-1 text-xs text-muted-foreground">
                  <li>Create a bot via <strong>@BotFather</strong> on Telegram</li>
                  <li>Download and extract the bot files</li>
                  <li>Copy <code className="rounded bg-muted px-1 py-0.5 font-mono">.env.example</code> to <code className="rounded bg-muted px-1 py-0.5 font-mono">.env</code></li>
                  <li>Set <code className="rounded bg-muted px-1 py-0.5 font-mono">TELEGRAM_BOT_TOKEN</code> and <code className="rounded bg-muted px-1 py-0.5 font-mono">API_URL</code></li>
                  <li>Run <code className="rounded bg-muted px-1 py-0.5 font-mono">npm install && npm start</code></li>
                </ol>
              </div>
              <p className="mb-1 text-xs font-medium text-foreground">Commands:</p>
              <div className="grid grid-cols-1 gap-0.5 text-xs text-muted-foreground">
                <div><code className="rounded bg-muted px-1 py-0.5 font-mono">/setseller</code> - Select or add app</div>
                <div><code className="rounded bg-muted px-1 py-0.5 font-mono">/create</code> - Create license(s)</div>
                <div><code className="rounded bg-muted px-1 py-0.5 font-mono">/delkey</code> - Delete a license</div>
                <div><code className="rounded bg-muted px-1 py-0.5 font-mono">/getkeys</code> - Export all keys</div>
                <div><code className="rounded bg-muted px-1 py-0.5 font-mono">/keyinfo</code> - License info</div>
                <div><code className="rounded bg-muted px-1 py-0.5 font-mono">/verify</code> - Verify license</div>
                <div><code className="rounded bg-muted px-1 py-0.5 font-mono">/adduser</code> / <code className="rounded bg-muted px-1 py-0.5 font-mono">/deluser</code> - Manage users</div>
                <div><code className="rounded bg-muted px-1 py-0.5 font-mono">/ban</code> / <code className="rounded bg-muted px-1 py-0.5 font-mono">/unban</code> - Ban/unban</div>
                <div><code className="rounded bg-muted px-1 py-0.5 font-mono">/resethwid</code> - Reset HWID</div>
                <div><code className="rounded bg-muted px-1 py-0.5 font-mono">/stats</code> / <code className="rounded bg-muted px-1 py-0.5 font-mono">/appdetails</code> - App info</div>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="mb-3 flex items-center gap-2">
                <svg className="h-5 w-5 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" /></svg>
                <h4 className="text-sm font-semibold">Discord Bot</h4>
              </div>
              <div className="mb-3 rounded border border-border bg-muted/50 p-3">
                <p className="mb-2 text-xs font-medium text-foreground">Quick Setup:</p>
                <ol className="list-inside list-decimal space-y-1 text-xs text-muted-foreground">
                  <li>Create a bot at <strong>discord.com/developers</strong></li>
                  <li>Download and extract the bot files</li>
                  <li>Copy <code className="rounded bg-muted px-1 py-0.5 font-mono">.env.example</code> to <code className="rounded bg-muted px-1 py-0.5 font-mono">.env</code></li>
                  <li>Set <code className="rounded bg-muted px-1 py-0.5 font-mono">TOKEN</code> and <code className="rounded bg-muted px-1 py-0.5 font-mono">API_URL</code></li>
                  <li>Run <code className="rounded bg-muted px-1 py-0.5 font-mono">npm install && npm start</code></li>
                </ol>
              </div>
              <p className="mb-1 text-xs font-medium text-foreground">Slash Commands:</p>
              <div className="grid grid-cols-1 gap-0.5 text-xs text-muted-foreground">
                <div><code className="rounded bg-muted px-1 py-0.5 font-mono">/setseller</code> - Set seller key (Admin)</div>
                <div><code className="rounded bg-muted px-1 py-0.5 font-mono">/add-license</code> - Create license(s)</div>
                <div><code className="rounded bg-muted px-1 py-0.5 font-mono">/delete-license</code> - Delete a license</div>
                <div><code className="rounded bg-muted px-1 py-0.5 font-mono">/fetch-all-keys</code> - Export all keys</div>
                <div><code className="rounded bg-muted px-1 py-0.5 font-mono">/license-info</code> - License info</div>
                <div><code className="rounded bg-muted px-1 py-0.5 font-mono">/verify-license</code> - Verify license</div>
                <div><code className="rounded bg-muted px-1 py-0.5 font-mono">/add-user</code> / <code className="rounded bg-muted px-1 py-0.5 font-mono">/delete-user</code> - Manage users</div>
                <div><code className="rounded bg-muted px-1 py-0.5 font-mono">/verify-user</code> / <code className="rounded bg-muted px-1 py-0.5 font-mono">/user-data</code> - User info</div>
                <div><code className="rounded bg-muted px-1 py-0.5 font-mono">/ban-user</code> / <code className="rounded bg-muted px-1 py-0.5 font-mono">/unban-user</code> - Ban/unban</div>
                <div><code className="rounded bg-muted px-1 py-0.5 font-mono">/reset-user</code> - Reset HWID</div>
                <div><code className="rounded bg-muted px-1 py-0.5 font-mono">/fetch-all-users</code> - Export all users</div>
                <div><code className="rounded bg-muted px-1 py-0.5 font-mono">/app-stats</code> / <code className="rounded bg-muted px-1 py-0.5 font-mono">/app-details</code> - App info</div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Seller Keys</h3>
            <p className="text-sm text-muted-foreground">Create seller keys to allow resellers to manage licenses and users via API.</p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)} data-testid="button-create-seller">
            <Plus className="mr-2 h-4 w-4" /> Create Seller
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : sellers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ShieldCheck className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No seller keys created yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Seller Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sellers.map(seller => (
                  <TableRow key={seller.id} data-testid={`row-seller-${seller.id}`}>
                    <TableCell className="font-medium">{seller.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <code className="text-xs bg-muted px-2 py-0.5 rounded max-w-[200px] truncate">
                          {visibleKeys.has(seller.id) ? seller.sellerKey : "••••••••••••••••"}
                        </code>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleKeyVisibility(seller.id)} data-testid={`button-toggle-key-tbl-${seller.id}`}>
                          {visibleKeys.has(seller.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyToClipboard(seller.sellerKey)} data-testid={`button-copy-key-tbl-${seller.id}`}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={seller.enabled ? "secondary" : "destructive"}>
                        {seller.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {seller.canCreateLicenses && <Badge variant="outline" className="text-xs">+License</Badge>}
                        {seller.canDeleteLicenses && <Badge variant="outline" className="text-xs">-License</Badge>}
                        {seller.canCreateUsers && <Badge variant="outline" className="text-xs">+User</Badge>}
                        {seller.canDeleteUsers && <Badge variant="outline" className="text-xs">-User</Badge>}
                        {seller.canResetUserHwid && <Badge variant="outline" className="text-xs">HWID</Badge>}
                        {seller.canBanUsers && <Badge variant="outline" className="text-xs">Ban</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <Switch
                          checked={seller.enabled ?? true}
                          onCheckedChange={(checked) => toggleEnabled.mutate({ id: seller.id, enabled: checked })}
                          data-testid={`switch-seller-${seller.id}`}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => deleteSeller.mutate(seller.id)}
                          data-testid={`button-delete-seller-${seller.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-lg font-semibold">API Reference</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Sellers can use the API endpoint to manage licenses and users programmatically.
        </p>
        <code className="block text-xs bg-muted p-4 rounded overflow-x-auto whitespace-pre font-mono">{`POST ${sellerApiLink}

// Create license
{ "sellerkey": "YOUR_SELLER_KEY", "type": "add", "expiry": "1", "amount": "1", "level": "1" }

// Delete license
{ "sellerkey": "YOUR_SELLER_KEY", "type": "del", "key": "LICENSE_KEY" }

// Create user
{ "sellerkey": "YOUR_SELLER_KEY", "type": "adduser", "user": "username", "pass": "password", "expiry": "30" }

// Delete user
{ "sellerkey": "YOUR_SELLER_KEY", "type": "deluser", "user": "username" }

// Reset HWID
{ "sellerkey": "YOUR_SELLER_KEY", "type": "resetuser", "user": "username" }

// Ban / Unban user
{ "sellerkey": "YOUR_SELLER_KEY", "type": "banuser", "user": "username" }
{ "sellerkey": "YOUR_SELLER_KEY", "type": "unbanuser", "user": "username" }

// Get app stats
{ "sellerkey": "YOUR_SELLER_KEY", "type": "stats" }

// Get app details
{ "sellerkey": "YOUR_SELLER_KEY", "type": "appdetails" }

// Get all licenses
{ "sellerkey": "YOUR_SELLER_KEY", "type": "fetchallkeys" }

// Get all users
{ "sellerkey": "YOUR_SELLER_KEY", "type": "fetchallusers" }

// Get license info
{ "sellerkey": "YOUR_SELLER_KEY", "type": "info", "key": "LICENSE_KEY" }

// Verify license exists
{ "sellerkey": "YOUR_SELLER_KEY", "type": "verify", "key": "LICENSE_KEY" }

// Get user data
{ "sellerkey": "YOUR_SELLER_KEY", "type": "getuserdata", "user": "username" }

// Validate seller key
{ "sellerkey": "YOUR_SELLER_KEY", "type": "validate" }`}</code>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Seller</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Seller Name <span className="text-destructive">*</span></label>
              <Input
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                placeholder="Reseller name"
                data-testid="input-seller-name"
              />
            </div>
            <div>
              <label className="mb-3 block text-sm font-medium">Permissions</label>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Checkbox checked={canCreateLicenses} onCheckedChange={(c) => setCanCreateLicenses(c === true)} data-testid="checkbox-can-create-licenses" />
                  <label className="text-sm">Create Licenses</label>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Checkbox checked={canDeleteLicenses} onCheckedChange={(c) => setCanDeleteLicenses(c === true)} data-testid="checkbox-can-delete-licenses" />
                  <label className="text-sm">Delete Licenses</label>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Checkbox checked={canCreateUsers} onCheckedChange={(c) => setCanCreateUsers(c === true)} data-testid="checkbox-can-create-users" />
                  <label className="text-sm">Create Users</label>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Checkbox checked={canDeleteUsers} onCheckedChange={(c) => setCanDeleteUsers(c === true)} data-testid="checkbox-can-delete-users" />
                  <label className="text-sm">Delete Users</label>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Checkbox checked={canResetUserHwid} onCheckedChange={(c) => setCanResetUserHwid(c === true)} data-testid="checkbox-can-reset-hwid" />
                  <label className="text-sm">Reset User HWID</label>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Checkbox checked={canBanUsers} onCheckedChange={(c) => setCanBanUsers(c === true)} data-testid="checkbox-can-ban-users" />
                  <label className="text-sm">Ban/Unban Users</label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)} data-testid="button-cancel-seller">
              Cancel
            </Button>
            <Button
              onClick={() => createSeller.mutate()}
              disabled={!sellerName.trim() || createSeller.isPending}
              data-testid="button-submit-seller"
            >
              {createSeller.isPending ? "Creating..." : "Create Seller"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
