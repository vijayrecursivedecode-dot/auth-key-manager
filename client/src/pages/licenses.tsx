import { useState, useMemo } from "react";
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
  DialogFooter,
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
import {
  Filter,
  LayoutGrid,
  LayoutList,
  KeyRound,
  Clock,
  FileDown,
  Trash2,
  Plus,
  Copy,
  Key,
  Search,
  MoreVertical,
} from "lucide-react";
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

type ViewMode = "table" | "grid";
type SortBy = "created" | "key" | "status" | "expires";
type SortOrder = "asc" | "desc";
type StatusFilter = "all" | "used" | "unused";

export default function LicensesPage() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("created");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [perPage, setPerPage] = useState("12");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [generateOpen, setGenerateOpen] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState("");
  const [count, setCount] = useState("1");
  const [duration, setDuration] = useState("1");
  const [durationUnit, setDurationUnit] = useState("day");
  const [level, setLevel] = useState("1");
  const [maxUses, setMaxUses] = useState("1");
  const [note, setNote] = useState("");
  const [mask, setMask] = useState("");
  const [useLowercase, setUseLowercase] = useState(true);
  const [useUppercase, setUseUppercase] = useState(false);

  const [extendOpen, setExtendOpen] = useState(false);
  const [extendUnit, setExtendUnit] = useState("day");
  const [extendDuration, setExtendDuration] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState("");

  const { data: apps } = useQuery<Application[]>({
    queryKey: ["/api/applications"],
  });

  const { data: licenses, isLoading } = useQuery<License[]>({
    queryKey: ["/api/licenses"],
  });

  const filtered = useMemo(() => {
    if (!licenses) return [];
    let result = licenses.filter(
      (l) =>
        l.licenseKey.toLowerCase().includes(search.toLowerCase()) ||
        (l.note && l.note.toLowerCase().includes(search.toLowerCase()))
    );
    if (statusFilter === "used") {
      result = result.filter((l) => (l.usedCount ?? 0) > 0);
    } else if (statusFilter === "unused") {
      result = result.filter((l) => (l.usedCount ?? 0) === 0);
    }
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "created":
          cmp = new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
          break;
        case "key":
          cmp = a.licenseKey.localeCompare(b.licenseKey);
          break;
        case "status":
          cmp = (a.usedCount ?? 0) - (b.usedCount ?? 0);
          break;
        case "expires":
          cmp = (a.duration ?? 0) - (b.duration ?? 0);
          break;
      }
      return sortOrder === "desc" ? -cmp : cmp;
    });
    return result.slice(0, parseInt(perPage) || 12);
  }, [licenses, search, statusFilter, sortBy, sortOrder, perPage]);

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
        mask: mask || undefined,
        useLowercase,
        useUppercase,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      setGenerateOpen(false);
      setNote("");
      setCount("1");
      setMask("");
      setUseLowercase(true);
      setUseUppercase(false);
      toast({ title: "License(s) generated successfully" });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", variant: "destructive" });
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

  const bulkDelete = useMutation({
    mutationFn: async (mode: string) => {
      const body: { mode: string; ids?: string[] } = { mode };
      if (mode === "selected") {
        body.ids = Array.from(selectedIds);
      }
      const res = await apiRequest("POST", "/api/licenses/bulk-delete", body);
      return res.json();
    },
    onSuccess: (data: { deleted: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      setSelectedIds(new Set());
      setDeleteOpen(false);
      setDeleteMode("");
      toast({ title: `${data.deleted} license(s) deleted` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const extendLicenses = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/licenses/extend", {
        unit: extendUnit,
        duration: extendDuration,
      });
      return res.json();
    },
    onSuccess: (data: { extended: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      setExtendOpen(false);
      setExtendDuration("");
      toast({ title: `${data.extended} unused license(s) extended` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const copyToClipboard = (text: string, label = "License key") => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  const exportLicenses = (format: "json" | "csv") => {
    if (!filtered || filtered.length === 0) return;
    let content: string;
    let mime: string;
    let ext: string;
    if (format === "json") {
      content = JSON.stringify(filtered.map((l) => ({
        key: l.licenseKey,
        status: (l.usedCount ?? 0) > 0 ? "Used" : "Not Used",
        created: l.createdAt,
        expires: `${l.duration} ${l.durationUnit}(s)`,
        usedBy: l.usedBy || "",
        note: l.note || "",
      })), null, 2);
      mime = "application/json";
      ext = "json";
    } else {
      const headers = "Key,Status,Created,Expires,Used By,Note\n";
      const rows = filtered.map((l) =>
        `"${l.licenseKey}","${(l.usedCount ?? 0) > 0 ? "Used" : "Not Used"}","${l.createdAt || ""}","${l.duration} ${l.durationUnit}(s)","${l.usedBy || ""}","${l.note || ""}"`
      ).join("\n");
      content = headers + rows;
      mime = "text/csv";
      ext = "csv";
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `licenses.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Licenses exported as ${ext.toUpperCase()}` });
  };

  const toggleSelectAll = () => {
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
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="icon"
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              data-testid="button-toggle-filters"
              title="Toggle Filters"
            >
              <Filter className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={viewMode === "table" ? "default" : "outline"}
              onClick={() => setViewMode(viewMode === "table" ? "grid" : "table")}
              data-testid="button-toggle-view"
              title={viewMode === "table" ? "Grid View" : "Table View"}
            >
              {viewMode === "table" ? <LayoutList className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setGenerateOpen(true)}
              disabled={!apps || apps.length === 0}
              data-testid="button-generate-licenses"
              title="Generate Licenses"
            >
              <KeyRound className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setExtendOpen(true)}
              data-testid="button-extend-licenses"
              title="Add Days to Unused Licenses"
            >
              <Clock className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  data-testid="button-export-licenses"
                  title="Export Licenses"
                >
                  <FileDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportLicenses("json")} data-testid="menuitem-export-json">
                  Export JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportLicenses("csv")} data-testid="menuitem-export-csv">
                  Export CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setDeleteOpen(true)}
              data-testid="button-delete-licenses"
              title="Delete Licenses"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="mb-4 flex flex-wrap items-end gap-4 animate-fade-in">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Sort By</label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                <SelectTrigger className="w-[140px]" data-testid="select-sort-by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created">Creation Date</SelectItem>
                  <SelectItem value="key">Key</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="expires">Expires</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Order</label>
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
                <SelectTrigger className="w-[140px]" data-testid="select-sort-order">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Descending</SelectItem>
                  <SelectItem value="asc">Ascending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Status</label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                  <SelectItem value="unused">Not Used</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Per Page</label>
              <Select value={perPage} onValueChange={setPerPage}>
                <SelectTrigger className="w-[130px]" data-testid="select-per-page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">12 per page</SelectItem>
                  <SelectItem value="25">25 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Checkbox
            checked={filtered.length > 0 && selectedIds.size === filtered.length}
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
        ) : filtered.length > 0 ? (
          viewMode === "table" ? (
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
                              <DropdownMenuItem onClick={() => copyToClipboard(lic.licenseKey)} data-testid={`menuitem-copy-${lic.id}`}>
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((lic) => {
                const isUsed = (lic.usedCount ?? 0) > 0;
                return (
                  <Card key={lic.id} className="p-4 relative" data-testid={`card-license-${lic.id}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                      <code className="font-mono text-xs font-semibold break-all" data-testid={`text-license-key-grid-${lic.id}`}>
                        {lic.licenseKey}
                      </code>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant={isUsed ? "default" : "secondary"}>
                          Status: {isUsed ? "Used" : "Not Used"}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" data-testid={`menu-license-grid-${lic.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => copyToClipboard(lic.licenseKey)} data-testid={`menuitem-copy-grid-${lic.id}`}>
                              <Copy className="mr-2 h-4 w-4" /> Copy Key
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteLicense.mutate(lic.id)}
                              data-testid={`menuitem-delete-grid-${lic.id}`}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex flex-wrap justify-between gap-2">
                        <span>Created: {formatDate(lic.createdAt)}</span>
                        <span>Duration: {lic.duration} {lic.durationUnit ? lic.durationUnit.charAt(0).toUpperCase() + lic.durationUnit.slice(1) : "Day"}(s)</span>
                      </div>
                      <div className="flex flex-wrap justify-between gap-2">
                        <span>Generated by: {ownerName}</span>
                        <span>Used by: {lic.usedBy || (isUsed ? "Same as key" : "-")}</span>
                      </div>
                      <div className="flex flex-wrap justify-between gap-2">
                        <span>Note: {lic.note || "-"}</span>
                        <span>Used on: {isUsed ? formatDate(lic.expiresAt) : "-"}</span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )
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

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
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
                    <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Count</label>
              <Input type="number" min="1" max="100" value={count} onChange={(e) => setCount(e.target.value)} data-testid="input-license-count" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">License Mask</label>
              <Input
                value={mask}
                onChange={(e) => setMask(e.target.value)}
                placeholder="Use * for random chars (e.g. ****-****-****)"
                data-testid="input-license-mask"
              />
              <div className="mt-2 flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={useLowercase}
                    onCheckedChange={(checked) => setUseLowercase(checked === true)}
                    data-testid="checkbox-lowercase"
                  />
                  Lowercase Letters
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={useUppercase}
                    onCheckedChange={(checked) => setUseUppercase(checked === true)}
                    data-testid="checkbox-uppercase"
                  />
                  Uppercase Letters
                </label>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Subscription Level</label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger data-testid="select-license-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 (default)</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">License Note</label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Giveaway batch" data-testid="input-license-note" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Expiry Unit</label>
                <Select value={durationUnit} onValueChange={setDurationUnit}>
                  <SelectTrigger data-testid="select-duration-unit"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hour">Hours</SelectItem>
                    <SelectItem value="day">Days</SelectItem>
                    <SelectItem value="week">Weeks</SelectItem>
                    <SelectItem value="month">Months</SelectItem>
                    <SelectItem value="year">Years</SelectItem>
                    <SelectItem value="lifetime">Lifetime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Expiry Duration</label>
                <Input type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} data-testid="input-license-duration" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Max Uses</label>
              <Input type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} data-testid="input-license-maxuses" />
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

      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Unused License(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Unit of time to add <span className="text-destructive">*</span></label>
              <Select value={extendUnit} onValueChange={setExtendUnit}>
                <SelectTrigger data-testid="select-extend-unit"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hour">Hours</SelectItem>
                  <SelectItem value="day">Days</SelectItem>
                  <SelectItem value="week">Weeks</SelectItem>
                  <SelectItem value="month">Months</SelectItem>
                  <SelectItem value="year">Years</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Duration of time to add <span className="text-destructive">*</span></label>
              <Input
                type="number"
                min="1"
                value={extendDuration}
                onChange={(e) => setExtendDuration(e.target.value)}
                data-testid="input-extend-duration"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setExtendOpen(false)} data-testid="button-extend-cancel">Cancel</Button>
            <Button
              onClick={() => extendLicenses.mutate()}
              disabled={!extendDuration || extendLicenses.isPending}
              data-testid="button-extend-submit"
            >
              {extendLicenses.isPending ? "Extending..." : "Extend Unused License(s)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete License(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Deletion Mode</label>
              <Select value={deleteMode} onValueChange={setDeleteMode}>
                <SelectTrigger data-testid="select-delete-mode"><SelectValue placeholder="Select option" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Delete All</SelectItem>
                  <SelectItem value="unused">Delete Unused</SelectItem>
                  <SelectItem value="used">Delete Used</SelectItem>
                  <SelectItem value="selected" disabled={selectedIds.size === 0}>
                    Delete Selected ({selectedIds.size})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeleteMode(""); }} data-testid="button-delete-cancel">Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteMode === "selected") {
                  bulkDelete.mutate("selected");
                } else {
                  bulkDelete.mutate(deleteMode);
                }
              }}
              disabled={!deleteMode || bulkDelete.isPending}
              data-testid="button-delete-submit"
            >
              {bulkDelete.isPending ? "Deleting..." : "Delete License(s)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
