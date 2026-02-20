import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Filter,
  LayoutGrid,
  LayoutList,
  KeyRound,
  Trash2,
  Search,
  Coins,
  MoreVertical,
  Copy,
  FileDown,
} from "lucide-react";
import type { Application, Token } from "@shared/schema";

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "N/A";
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
type SortBy = "created" | "token" | "status";
type SortOrder = "asc" | "desc";
type StatusFilter = "all" | "used" | "unused";

export default function TokensPage() {
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("created");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [perPage, setPerPage] = useState("12");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [generateOpen, setGenerateOpen] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState("");
  const [count, setCount] = useState("1");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState("");

  const { data: apps } = useQuery<Application[]>({
    queryKey: ["/api/applications"],
  });

  const { data: tokens, isLoading } = useQuery<Token[]>({
    queryKey: ["/api/tokens"],
  });

  const allFiltered = useMemo(() => {
    if (!tokens) return [];
    let result = tokens.filter(
      (t) =>
        t.token.toLowerCase().includes(search.toLowerCase()) ||
        (t.usedBy && t.usedBy.toLowerCase().includes(search.toLowerCase()))
    );
    if (statusFilter === "used") {
      result = result.filter((t) => t.used);
    } else if (statusFilter === "unused") {
      result = result.filter((t) => !t.used);
    }
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "created":
          cmp = new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
          break;
        case "token":
          cmp = a.token.localeCompare(b.token);
          break;
        case "status":
          cmp = (a.used ? 1 : 0) - (b.used ? 1 : 0);
          break;
      }
      return sortOrder === "desc" ? -cmp : cmp;
    });
    return result;
  }, [tokens, search, statusFilter, sortBy, sortOrder]);

  const pp = parseInt(perPage) || 12;
  const totalPages = Math.max(1, Math.ceil(allFiltered.length / pp));
  const paginated = allFiltered.slice((currentPage - 1) * pp, currentPage * pp);

  const getAppName = (appId: string) =>
    apps?.find((a) => a.id === appId)?.name || "Unknown";

  const createTokens = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/tokens", {
        appId: selectedAppId,
        count: parseInt(count),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tokens"] });
      setGenerateOpen(false);
      setCount("1");
      toast({ title: "Token(s) generated successfully" });
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

  const deleteToken = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/tokens/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tokens"] });
      toast({ title: "Token deleted" });
    },
  });

  const bulkDelete = useMutation({
    mutationFn: async (mode: string) => {
      const body: { mode: string; ids?: string[] } = { mode };
      if (mode === "selected") {
        body.ids = Array.from(selectedIds);
      }
      const res = await apiRequest("POST", "/api/tokens/bulk-delete", body);
      return res.json();
    },
    onSuccess: (data: { deleted: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tokens"] });
      setSelectedIds(new Set());
      setDeleteOpen(false);
      setDeleteMode("");
      toast({ title: `${data.deleted} token(s) deleted` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const copyToClipboard = (text: string, label = "Token") => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  const exportTokens = (format: "json" | "csv") => {
    if (!allFiltered || allFiltered.length === 0) return;
    let content: string;
    let mime: string;
    let ext: string;
    if (format === "json") {
      content = JSON.stringify(allFiltered.map((t) => ({
        token: t.token,
        status: t.used ? "Used" : "Unused",
        assigned: t.usedBy || "",
        app: getAppName(t.appId),
        created: t.createdAt,
      })), null, 2);
      mime = "application/json";
      ext = "json";
    } else {
      const headers = "Token,Status,Assigned,Application,Created\n";
      const rows = allFiltered.map((t) =>
        `"${t.token}","${t.used ? "Used" : "Unused"}","${t.usedBy || ""}","${getAppName(t.appId)}","${t.createdAt || ""}"`
      ).join("\n");
      content = headers + rows;
      mime = "text/csv";
      ext = "csv";
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tokens.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Tokens exported as ${ext.toUpperCase()}` });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginated.map((t) => t.id)));
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

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-tokens-title">Tokens</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tokens act as access keys. While licenses allow users to login/register, tokens allow the user to access the program entirely.
        </p>
      </div>

      <Card className="p-5 animate-slide-up">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search tokens..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              data-testid="input-search-tokens"
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
              variant={viewMode === "grid" ? "default" : "outline"}
              onClick={() => setViewMode(viewMode === "grid" ? "table" : "grid")}
              data-testid="button-toggle-view"
              title={viewMode === "grid" ? "Table View" : "Grid View"}
            >
              {viewMode === "grid" ? <LayoutGrid className="h-4 w-4" /> : <LayoutList className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setGenerateOpen(true)}
              disabled={!apps || apps.length === 0}
              data-testid="button-generate-tokens"
              title="Generate Tokens"
            >
              <KeyRound className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  data-testid="button-export-tokens"
                  title="Export Tokens"
                >
                  <FileDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportTokens("json")} data-testid="menuitem-export-json">
                  Export JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportTokens("csv")} data-testid="menuitem-export-csv">
                  Export CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setDeleteOpen(true)}
              data-testid="button-delete-tokens"
              title="Delete Tokens"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="mb-4 flex flex-wrap items-end gap-4 animate-fade-in">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Sort By</label>
              <Select value={sortBy} onValueChange={(v) => { setSortBy(v as SortBy); setCurrentPage(1); }}>
                <SelectTrigger className="w-[140px]" data-testid="select-sort-by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created">Created</SelectItem>
                  <SelectItem value="token">Token</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Order</label>
              <Select value={sortOrder} onValueChange={(v) => { setSortOrder(v as SortOrder); setCurrentPage(1); }}>
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
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as StatusFilter); setCurrentPage(1); }}>
                <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                  <SelectItem value="unused">Unused</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Per Page</label>
              <Select value={perPage} onValueChange={(v) => { setPerPage(v); setCurrentPage(1); }}>
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
            checked={paginated.length > 0 && selectedIds.size === paginated.length}
            onCheckedChange={toggleSelectAll}
            data-testid="checkbox-select-all"
          />
          <span className="text-sm text-muted-foreground">Select All</span>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-36 w-full" />
            ))}
          </div>
        ) : paginated.length > 0 ? (
          <>
            {viewMode === "grid" ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {paginated.map((token) => (
                  <Card key={token.id} className="p-4 relative" data-testid={`card-token-${token.id}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                      <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                        <Checkbox
                          checked={selectedIds.has(token.id)}
                          onCheckedChange={() => toggleSelect(token.id)}
                          data-testid={`checkbox-token-${token.id}`}
                        />
                        <code className="font-mono text-xs font-semibold truncate max-w-[180px]" data-testid={`text-token-${token.id}`}>
                          {token.token}
                        </code>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant={token.used ? "secondary" : "default"} data-testid={`badge-status-${token.id}`}>
                          Status: {token.used ? "Used" : "Unbanned"}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" data-testid={`menu-token-${token.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => copyToClipboard(token.token)}
                              data-testid={`menuitem-copy-${token.id}`}
                            >
                              <Copy className="mr-2 h-4 w-4" /> Copy Token
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteToken.mutate(token.id)}
                              data-testid={`menuitem-delete-${token.id}`}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      <div>
                        <span className="text-muted-foreground">Assigned:</span>{" "}
                        <span>{token.usedBy || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Type:</span>{" "}
                        <span>{token.used ? "user" : "license"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>{" "}
                        <span>{token.used ? "Used" : "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Ban Reason:</span>{" "}
                        <span>N/A</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">App:</span>{" "}
                        <span className="truncate">{getAppName(token.appId)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Hash:</span>{" "}
                        <span>N/A</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Token</TableHead>
                      <TableHead>Application</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((token) => (
                      <TableRow key={token.id} data-testid={`row-token-${token.id}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(token.id)}
                            onCheckedChange={() => toggleSelect(token.id)}
                            data-testid={`checkbox-token-${token.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <code className="max-w-[200px] truncate font-mono text-xs" data-testid={`text-token-${token.id}`}>
                              {token.token}
                            </code>
                            <button
                              onClick={() => copyToClipboard(token.token)}
                              className="text-muted-foreground"
                              data-testid={`button-copy-token-${token.id}`}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {getAppName(token.appId)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={token.used ? "secondary" : "default"} data-testid={`badge-status-${token.id}`}>
                            {token.used ? "Used" : "Unbanned"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {token.usedBy || "N/A"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {token.used ? "user" : "license"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(token.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" data-testid={`menu-token-${token.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => copyToClipboard(token.token)}
                                data-testid={`menuitem-copy-${token.id}`}
                              >
                                <Copy className="mr-2 h-4 w-4" /> Copy Token
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteToken.mutate(token.id)}
                                data-testid={`menuitem-delete-${token.id}`}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                <Button
                  variant="outline"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground" data-testid="text-page-info">
                  Showing page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Coins className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="font-semibold">No tokens found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate registration tokens for controlled user onboarding.
            </p>
          </div>
        )}
      </Card>

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Tokens</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Application</label>
              <Select value={selectedAppId} onValueChange={setSelectedAppId}>
                <SelectTrigger data-testid="select-token-app">
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
              <Input
                type="number"
                min="1"
                max="100"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                data-testid="input-token-count"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => createTokens.mutate()}
              disabled={!selectedAppId || createTokens.isPending}
              data-testid="button-submit-token"
            >
              {createTokens.isPending ? "Generating..." : "Generate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Token(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Deletion Mode</label>
              <Select value={deleteMode} onValueChange={setDeleteMode}>
                <SelectTrigger data-testid="select-delete-mode">
                  <SelectValue placeholder="Select option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Delete All</SelectItem>
                  <SelectItem value="used">Delete Used</SelectItem>
                  <SelectItem value="unused">Delete Unused</SelectItem>
                  <SelectItem value="selected" disabled={selectedIds.size === 0}>
                    Delete Selected ({selectedIds.size})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeleteMode(""); }} data-testid="button-delete-cancel">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => bulkDelete.mutate(deleteMode)}
              disabled={!deleteMode || bulkDelete.isPending}
              data-testid="button-delete-submit"
            >
              {bulkDelete.isPending ? "Deleting..." : "Delete Token(s)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
