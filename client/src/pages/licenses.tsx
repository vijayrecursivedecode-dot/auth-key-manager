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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Copy, Trash2, Key, Search } from "lucide-react";
import type { Application, License } from "@shared/schema";

export default function LicensesPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState("");
  const [count, setCount] = useState("1");
  const [duration, setDuration] = useState("1");
  const [durationUnit, setDurationUnit] = useState("day");
  const [level, setLevel] = useState("1");
  const [maxUses, setMaxUses] = useState("1");
  const [note, setNote] = useState("");

  const { data: apps } = useQuery<Application[]>({
    queryKey: ["/api/applications"],
  });

  const { data: licenses, isLoading } = useQuery<License[]>({
    queryKey: ["/api/licenses"],
  });

  const createLicenses = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/licenses", {
        appId: selectedAppId,
        count: parseInt(count),
        duration: parseInt(duration),
        durationUnit,
        level: parseInt(level),
        maxUses: parseInt(maxUses),
        note: note || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      setDialogOpen(false);
      setNote("");
      setCount("1");
      toast({ title: "License(s) generated successfully" });
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

  const toggleLicense = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await apiRequest("PATCH", `/api/licenses/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
    },
  });

  const deleteLicense = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/licenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      toast({ title: "License deleted" });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "License key copied" });
  };

  const getAppName = (appId: string) =>
    apps?.find((a) => a.id === appId)?.name || "Unknown";

  const filtered = licenses?.filter(
    (l) =>
      l.licenseKey.toLowerCase().includes(search.toLowerCase()) ||
      (l.note && l.note.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Licenses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate and manage license keys
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              disabled={!apps || apps.length === 0}
              data-testid="button-create-license"
            >
              <Plus className="mr-2 h-4 w-4" />
              Generate Licenses
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Licenses</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Application</label>
                <Select value={selectedAppId} onValueChange={setSelectedAppId}>
                  <SelectTrigger data-testid="select-license-app">
                    <SelectValue placeholder="Select application" />
                  </SelectTrigger>
                  <SelectContent>
                    {apps?.map((app) => (
                      <SelectItem key={app.id} value={app.id}>
                        {app.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Count</label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                    data-testid="input-license-count"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Level</label>
                  <Input
                    type="number"
                    min="1"
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    data-testid="input-license-level"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Duration</label>
                  <Input
                    type="number"
                    min="1"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    data-testid="input-license-duration"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Unit</label>
                  <Select value={durationUnit} onValueChange={setDurationUnit}>
                    <SelectTrigger data-testid="select-duration-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hour">Hour(s)</SelectItem>
                      <SelectItem value="day">Day(s)</SelectItem>
                      <SelectItem value="week">Week(s)</SelectItem>
                      <SelectItem value="month">Month(s)</SelectItem>
                      <SelectItem value="year">Year(s)</SelectItem>
                      <SelectItem value="lifetime">Lifetime</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Max Uses</label>
                <Input
                  type="number"
                  min="1"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  data-testid="input-license-maxuses"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Note (optional)</label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Giveaway batch"
                  data-testid="input-license-note"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => createLicenses.mutate()}
                disabled={!selectedAppId || createLicenses.isPending}
                data-testid="button-submit-license"
              >
                {createLicenses.isPending ? "Generating..." : "Generate"}
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
            placeholder="Search licenses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-licenses"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered && filtered.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>License Key</TableHead>
                  <TableHead>Application</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((lic) => (
                  <TableRow key={lic.id} data-testid={`row-license-${lic.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="max-w-[180px] truncate font-mono text-xs">
                          {lic.licenseKey}
                        </code>
                        <button
                          onClick={() => copyToClipboard(lic.licenseKey)}
                          className="text-muted-foreground"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {getAppName(lic.appId)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {lic.duration} {lic.durationUnit}(s)
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{lic.level}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {lic.usedCount}/{lic.maxUses}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={lic.enabled ?? false}
                        onCheckedChange={(val) =>
                          toggleLicense.mutate({ id: lic.id, enabled: val })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteLicense.mutate(lic.id)}
                        data-testid={`button-delete-license-${lic.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Key className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="font-semibold">No licenses found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {apps && apps.length > 0
              ? "Generate licenses for your applications."
              : "Create an application first, then generate licenses."}
          </p>
        </Card>
      )}
    </div>
  );
}
