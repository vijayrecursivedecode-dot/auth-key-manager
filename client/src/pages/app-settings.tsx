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
import { Save, RotateCcw, Settings, Copy, RefreshCw, Code, ExternalLink, Download, FileCode } from "lucide-react";
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
  const paddedOwnerId = ownerId.padStart(10, "0");
  const apiUrl = window.location.origin + "/api/1.3/";

  switch (lang) {
    case "C#":
      return `// Use KeyAuth_KeyVault.cs + Ed25519.cs from SDK Downloads tab
public static api KeyVaultApp = new api(
    name: "${name}",
    ownerid: "${paddedOwnerId}",
    version: "${version}"
);`;
    case "C++":
      return `// Use auth_keyvault.cpp from SDK Downloads tab
std::string name = "${name}";
std::string ownerid = "${paddedOwnerId}";
std::string version = "${version}";
std::string url = "${window.location.origin}/api/1.3/";
std::string path = "";

KeyAuth::api KeyVaultApp(name, ownerid, version, url, path);`;
    case "Java":
      return `public static KeyVault KeyVaultApp = new KeyVault(
    "${name}",
    "${paddedOwnerId}",
    "${secret}",
    "${version}",
    "${apiUrl}"
);`;
    case "Python":
      return `keyvaultapp = api(
    name="${name}",
    ownerid="${paddedOwnerId}",
    secret="${secret}",
    version="${version}",
    url="${apiUrl}"
)`;
    case "PHP":
      return `$KeyVaultApp = new KeyVault\\api(
    "${name}",
    "${paddedOwnerId}",
    "${secret}",
    "${version}",
    "${apiUrl}"
);`;
    case "JavaScript":
      return `const KeyVaultApp = new KeyVault({
    name: "${name}",
    ownerId: "${paddedOwnerId}",
    secret: "${secret}",
    version: "${version}",
    url: "${apiUrl}"
});`;
    case "TypeScript":
      return `const KeyVaultApp: KeyVault = new KeyVault({
    name: "${name}",
    ownerId: "${paddedOwnerId}",
    secret: "${secret}",
    version: "${version}",
    url: "${apiUrl}"
});`;
    case "VB.Net":
      return `Public Shared KeyVaultApp As New api(
    name:="${name}",
    ownerid:="${paddedOwnerId}",
    secret:="${secret}",
    version:="${version}",
    url:="${apiUrl}"
)`;
    case "Rust":
      return `let mut keyvaultapp = KeyVaultApi::new(
    "${name}",
    "${paddedOwnerId}",
    "${secret}",
    "${version}",
    "${apiUrl}"
);`;
    case "Go":
      return `var api = keyvault.KeyVault{
    Name:    "${name}",
    OwnerId: "${paddedOwnerId}",
    Secret:  "${secret}",
    Version: "${version}",
    Url:     "${apiUrl}",
}`;
    case "Lua":
      return `local KeyVaultApp = KeyVault:new(
    "${name}",
    "${paddedOwnerId}",
    "${secret}",
    "${version}",
    "${apiUrl}"
)`;
    case "Ruby":
      return `keyvault_app = KeyVault::API.new(
    name: "${name}",
    owner_id: "${paddedOwnerId}",
    secret: "${secret}",
    version: "${version}",
    url: "${apiUrl}"
)`;
    case "Perl":
      return `my $keyvault = KeyVault::API->new(
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
                      {(user?.id || "").padStart(10, "0")}
                    </p>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copyToClipboard((user?.id || "").padStart(10, "0"), "Owner ID")}
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
                      {getCodeSnippet(snippetLang, selectedApp, user?.id || "")}
                    </code>
                  </pre>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="default"
                    onClick={() =>
                      copyToClipboard(
                        getCodeSnippet(snippetLang, selectedApp, user?.id || ""),
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
                        Drop-in replacement for the KeyAuth C# KeyAuth.cs file. Includes Ed25519 verification.
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Files: <span className="font-mono">KeyAuth_KeyVault.cs</span> + <span className="font-mono">Ed25519.cs</span>
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
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
                      <Button
                        variant="outline"
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = "/Ed25519.cs";
                          a.download = "Ed25519.cs";
                          a.click();
                        }}
                        data-testid="button-download-ed25519"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download Ed25519.cs
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="max-w-2xl p-6">
              <h3 className="mb-1 font-semibold">Quick Setup: Use Your Existing KeyAuth Project</h3>
              <p className="mb-5 text-sm text-muted-foreground">
                Already have KeyAuth in your C++ or C# project? Just change 3 values in your main file - no need to replace auth.cpp or KeyAuth.cs
              </p>

              <div className="space-y-6">
                <div>
                  <p className="mb-3 text-sm font-semibold">C++ Project - Just change main.cpp</p>
                  <div className="space-y-3">
                    <div className="rounded-md border p-3">
                      <p className="text-sm font-medium">Find these lines in your main.cpp and update them:</p>
                      {selectedApp && (
                        <div className="mt-2 rounded-md border bg-muted/50 p-3">
                          <pre className="overflow-x-auto text-xs leading-relaxed">
                            <code data-testid="text-cpp-setup-code">{`std::string name = "${selectedApp.name}";
std::string ownerid = "${(user?.id || "").padStart(10, "0")}";
std::string version = "${selectedApp.version || "1.0"}";
std::string url = "${window.location.origin}/api/1.3/";
std::string path = "";`}</code>
                          </pre>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="mt-2"
                            onClick={() => copyToClipboard(
                              `std::string name = "${selectedApp.name}";\nstd::string ownerid = "${(user?.id || "").padStart(10, "0")}";\nstd::string version = "${selectedApp.version || "1.0"}";\nstd::string url = "${window.location.origin}/api/1.3/";\nstd::string path = "";`,
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
                    <div className="rounded-md border bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">
                        Keep your existing <span className="font-mono">auth.cpp</span>, <span className="font-mono">auth.hpp</span>, and all other KeyAuth files exactly as they are. Only change the name, ownerid, version, and url in <span className="font-mono">main.cpp</span>. Build and run - everything works the same.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <p className="mb-3 text-sm font-semibold">C# Project - Just change Program.cs</p>
                  <div className="space-y-3">
                    <div className="rounded-md border p-3">
                      <p className="text-sm font-medium">Find the KeyAuth initialization in your main file and update it:</p>
                      {selectedApp && (
                        <div className="mt-2 rounded-md border bg-muted/50 p-3">
                          <pre className="overflow-x-auto text-xs leading-relaxed">
                            <code data-testid="text-cs-setup-code">{`public static api KeyAuthApp = new api(
    name: "${selectedApp.name}",
    ownerid: "${(user?.id || "").padStart(10, "0")}",
    version: "${selectedApp.version || "1.0"}"
);`}</code>
                          </pre>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="mt-2"
                            onClick={() => copyToClipboard(
                              `public static api KeyAuthApp = new api(\n    name: "${selectedApp.name}",\n    ownerid: "${(user?.id || "").padStart(10, "0")}",\n    version: "${selectedApp.version || "1.0"}"\n);`,
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
                    <div className="rounded-md border bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">
                        Keep your existing <span className="font-mono">KeyAuth.cs</span> exactly as it is. Only change the name, ownerid, and version in your main file. Build and run.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border bg-muted/50 p-4">
                  <p className="text-sm font-medium mb-2">How It Works</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Your existing KeyAuth code sends requests to the URL you set - just point it to KeyVault</li>
                    <li>The server supports both HMAC and Ed25519 signing - compatible with all KeyAuth versions</li>
                    <li>All functions work exactly the same: init, login, register, license, upgrade, ban, check, logout</li>
                    <li>Your API URL: <span className="font-mono">{window.location.origin}/api/1.3/</span></li>
                  </ul>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">Optional: Use KeyVault SDK Instead</p>
                  <p className="text-sm text-muted-foreground">
                    If you want enhanced security with Ed25519 signature verification, download the KeyVault SDK files above and replace your auth.cpp / KeyAuth.cs. This is optional - your original KeyAuth files work fine.
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
