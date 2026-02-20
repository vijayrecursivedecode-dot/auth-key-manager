import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Copy, Trash2, Key, Search, MoreVertical, Ban, Check } from "lucide-react";
import type { Application, License } from "@shared/schema";

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }) + ", " + d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function LicensesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState("");
  const [count, setCount] = useState("1");
  const [duration, setDuration] = useState("1");
  const [durationUnit, setDurationUnit] = useState("day");
  const [level, setLevel] = useState("1");
  const [maxUses, setMaxUses] = useState("1");
  const [note, setNote] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const deleteLicense = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/licenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      toast({ title: "License deleted" });
    },
  });

  const deleteSelected = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map((id) => apiRequest("DELETE", `/api/licenses/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      setSelectedIds(new Set());
      toast({ title: "Selected licenses deleted" });
    },
  });

  const copyToClipboard = (text: string, label = "License key") => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  const getAppName = (appId: string) =>
    apps?.find((a) => a.id === appId)?.name || "Unknown";

  const filtered = licenses?.filter(
    (l) =>
      l.licenseKey.toLowerCase().includes(search.toLowerCase()) ||
      (l.note && l.note.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleSelectAll = () => {
    if (!filtered) return;
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((l) => l.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const ownerName = user?.firstName
    ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
    : "owner";

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-licenses-title">Licenses</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Licenses allow your users to register on your application.
        </p>
      </div>

      <Card className="p-5 animate-slide-up">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search licenses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-licenses"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                onClick={() => deleteSelected.mutate()}
                disabled={deleteSelected.isPending}
                data-testid="button-delete-selected"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete ({selectedIds.size})
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Checkbox
            checked={filtered && filtered.length > 0 && selectedIds.size === filtered.length}
            onCheckedChange={toggleSelectAll}
            data-testid="checkbox-select-all"
          />
          <span className="text-sm text-muted-foreground">Select All</span>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered && filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Generated By</TableHead>
                  <TableHead>Used By</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Used On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((lic) => {
                  const isUsed = (lic.usedCount ?? 0) > 0;
                  return (
                    <TableRow key={lic.id} data-testid={`row-license-${lic.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(lic.id)}
                          onCheckedChange={() => toggleSelect(lic.id)}
                          data-testid={`checkbox-license-${lic.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <code className="max-w-[200px] truncate font-mono text-xs" data-testid={`text-license-key-${lic.id}`}>
                            {lic.licenseKey}
                          </code>
                          <button
                            onClick={() => copyToClipboard(lic.licenseKey)}
                            className="text-muted-foreground"
                            data-testid={`button-copy-license-${lic.id}`}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={isUsed ? "default" : "secondary"} data-testid={`badge-status-${lic.id}`}>
                          {isUsed ? "Used" : "Not Used"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(lic.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {lic.duration} {lic.durationUnit ? lic.durationUnit.charAt(0).toUpperCase() + lic.durationUnit.slice(1) : "Day"}(s)
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {ownerName}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {lic.usedBy || (isUsed ? "Same as key" : "-")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {lic.note || "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {isUsed ? formatDate(lic.expiresAt) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" data-testid={`menu-license-${lic.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => copyToClipboard(lic.licenseKey)}
                              data-testid={`menuitem-copy-${lic.id}`}
                            >
                              <Copy className="mr-2 h-4 w-4" /> Copy Key
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteLicense.mutate(lic.id)}
                              data-testid={`menuitem-delete-${lic.id}`}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Key className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="font-semibold">No licenses found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {apps && apps.length > 0
                ? "Generate licenses for your applications."
                : "Create an application first, then generate licenses."}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
