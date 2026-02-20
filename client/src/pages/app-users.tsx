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
  UserPlus,
  RotateCcw,
  Trash2,
  Search,
  Users,
  MoreVertical,
  Ban,
  ShieldCheck,
  Fingerprint,
} from "lucide-react";
import type { Application, AppUser } from "@shared/schema";

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
type SortBy = "created" | "username" | "lastLogin" | "status";
type SortOrder = "asc" | "desc";
type StatusFilter = "all" | "active" | "banned" | "expired";

export default function AppUsersPage() {
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("created");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [perPage, setPerPage] = useState("12");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [resetHwidOpen, setResetHwidOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState("");

  const { data: apps } = useQuery<Application[]>({
    queryKey: ["/api/applications"],
  });

  const { data: appUsers, isLoading } = useQuery<AppUser[]>({
    queryKey: ["/api/app-users"],
  });

  const filtered = useMemo(() => {
    if (!appUsers) return [];
    let result = appUsers.filter(
      (u) =>
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        (u.hwid && u.hwid.toLowerCase().includes(search.toLowerCase())) ||
        (u.ip && u.ip.toLowerCase().includes(search.toLowerCase()))
    );
    if (statusFilter === "active") {
      result = result.filter((u) => !u.banned);
    } else if (statusFilter === "banned") {
      result = result.filter((u) => u.banned);
    } else if (statusFilter === "expired") {
      result = result.filter((u) => u.expiresAt && new Date(u.expiresAt) < new Date());
    }
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "created":
          cmp = new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
          break;
        case "username":
          cmp = a.username.localeCompare(b.username);
          break;
        case "lastLogin":
          cmp = new Date(a.lastLogin ?? 0).getTime() - new Date(b.lastLogin ?? 0).getTime();
          break;
        case "status":
          cmp = (a.banned ? 1 : 0) - (b.banned ? 1 : 0);
          break;
      }
      return sortOrder === "desc" ? -cmp : cmp;
    });
    return result.slice(0, parseInt(perPage) || 12);
  }, [appUsers, search, statusFilter, sortBy, sortOrder, perPage]);

  const getAppName = (appId: string) =>
    apps?.find((a) => a.id === appId)?.name || "Unknown";

  const createUser = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/app-users", {
        appId: selectedAppId,
        username,
        password: password || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-users"] });
      setCreateOpen(false);
      setUsername("");
      setPassword("");
      toast({ title: "User created successfully" });
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

  const toggleBan = useMutation({
    mutationFn: async ({ id, banned }: { id: string; banned: boolean }) => {
      await apiRequest("PATCH", `/api/app-users/${id}`, { banned });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-users"] });
      toast({ title: "User updated" });
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/app-users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-users"] });
      toast({ title: "User deleted" });
    },
  });

  const bulkDelete = useMutation({
    mutationFn: async (mode: string) => {
      const body: { mode: string; ids?: string[] } = { mode };
      if (mode === "selected") {
        body.ids = Array.from(selectedIds);
      }
      const res = await apiRequest("POST", "/api/app-users/bulk-delete", body);
      return res.json();
    },
    onSuccess: (data: { deleted: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-users"] });
      setSelectedIds(new Set());
      setDeleteOpen(false);
      setDeleteMode("");
      toast({ title: `${data.deleted} user(s) deleted` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetHwid = useMutation({
    mutationFn: async (mode: string) => {
      const body: { mode: string; ids?: string[] } = { mode };
      if (mode === "selected") {
        body.ids = Array.from(selectedIds);
      }
      const res = await apiRequest("POST", "/api/app-users/reset-hwid", body);
      return res.json();
    },
    onSuccess: (data: { reset: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-users"] });
      setResetHwidOpen(false);
      toast({ title: `${data.reset} HWID(s) reset` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((u) => u.id)));
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
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-users-title">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          After someone registers for your app with a license, they will appear here.
        </p>
      </div>

      <Card className="p-5 animate-slide-up">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search Users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-users"
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
              onClick={() => setCreateOpen(true)}
              disabled={!apps || apps.length === 0}
              data-testid="button-create-user"
              title="Add User"
            >
              <UserPlus className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setResetHwidOpen(true)}
              data-testid="button-reset-hwid"
              title="Reset HWID"
            >
              <Fingerprint className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/app-users"] });
                toast({ title: "Users refreshed" });
              }}
              data-testid="button-refresh-users"
              title="Refresh"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setDeleteOpen(true)}
              data-testid="button-delete-users"
              title="Delete Users"
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
                  <SelectItem value="created">Created</SelectItem>
                  <SelectItem value="username">Username</SelectItem>
                  <SelectItem value="lastLogin">Last Login</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
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
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="banned">Banned</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          viewMode === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((user) => (
                <Card key={user.id} className="p-4 relative" data-testid={`card-user-${user.id}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Checkbox
                        checked={selectedIds.has(user.id)}
                        onCheckedChange={() => toggleSelect(user.id)}
                        data-testid={`checkbox-user-${user.id}`}
                      />
                      <span className="font-semibold text-sm truncate max-w-[140px]" data-testid={`text-username-${user.id}`}>
                        {user.username}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant={user.banned ? "destructive" : "secondary"} data-testid={`badge-status-${user.id}`}>
                        Status: {user.banned ? "Banned" : "Active"}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" data-testid={`menu-user-${user.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => toggleBan.mutate({ id: user.id, banned: !user.banned })}
                            data-testid={`menuitem-ban-${user.id}`}
                          >
                            {user.banned ? (
                              <><ShieldCheck className="mr-2 h-4 w-4" /> Unban</>
                            ) : (
                              <><Ban className="mr-2 h-4 w-4" /> Ban</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              const body = { mode: "selected", ids: [user.id] };
                              const res = await apiRequest("POST", "/api/app-users/reset-hwid", body);
                              const data = await res.json();
                              queryClient.invalidateQueries({ queryKey: ["/api/app-users"] });
                              toast({ title: `${data.reset} HWID(s) reset` });
                            }}
                            data-testid={`menuitem-reset-hwid-${user.id}`}
                          >
                            <Fingerprint className="mr-2 h-4 w-4" /> Reset HWID
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteUser.mutate(user.id)}
                            data-testid={`menuitem-delete-${user.id}`}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div>
                      <span className="text-muted-foreground">Created:</span>{" "}
                      <span>{formatDate(user.createdAt)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Last Login:</span>{" "}
                      <span>{formatDate(user.lastLogin)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">IP:</span>{" "}
                      <span>{user.ip || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Level:</span>{" "}
                      <span>{user.level}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">HWID:</span>{" "}
                      <span className="truncate">{user.hwid ? "Yes" : "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">App:</span>{" "}
                      <span className="truncate">{getAppName(user.appId)}</span>
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
                    <TableHead>Username</TableHead>
                    <TableHead>Application</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>HWID</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(user.id)}
                          onCheckedChange={() => toggleSelect(user.id)}
                          data-testid={`checkbox-user-${user.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium" data-testid={`text-username-${user.id}`}>
                        {user.username}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {getAppName(user.appId)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.banned ? "destructive" : "secondary"} data-testid={`badge-status-${user.id}`}>
                          {user.banned ? "Banned" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(user.lastLogin)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {user.ip || "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{user.level}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[100px]">
                        {user.hwid ? "Yes" : "N/A"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" data-testid={`menu-user-${user.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => toggleBan.mutate({ id: user.id, banned: !user.banned })}
                              data-testid={`menuitem-ban-${user.id}`}
                            >
                              {user.banned ? (
                                <><ShieldCheck className="mr-2 h-4 w-4" /> Unban</>
                              ) : (
                                <><Ban className="mr-2 h-4 w-4" /> Ban</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                const body = { mode: "selected", ids: [user.id] };
                                const res = await apiRequest("POST", "/api/app-users/reset-hwid", body);
                                const data = await res.json();
                                queryClient.invalidateQueries({ queryKey: ["/api/app-users"] });
                                toast({ title: `${data.reset} HWID(s) reset` });
                              }}
                              data-testid={`menuitem-reset-hwid-${user.id}`}
                            >
                              <Fingerprint className="mr-2 h-4 w-4" /> Reset HWID
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteUser.mutate(user.id)}
                              data-testid={`menuitem-delete-${user.id}`}
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
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="font-semibold">No users found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {apps && apps.length > 0
                ? "Users will appear here when they authenticate with your applications."
                : "Create an application first to start managing users."}
            </p>
          </div>
        )}
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Application</label>
              <Select value={selectedAppId} onValueChange={setSelectedAppId}>
                <SelectTrigger data-testid="select-user-app">
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
              <label className="mb-1.5 block text-sm font-medium">Username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="user123"
                data-testid="input-user-username"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Password (optional)</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Optional password"
                data-testid="input-user-password"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => createUser.mutate()}
              disabled={!selectedAppId || !username.trim() || createUser.isPending}
              data-testid="button-submit-user"
            >
              {createUser.isPending ? "Creating..." : "Add User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resetHwidOpen} onOpenChange={setResetHwidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset HWID</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground pt-2">
            This will clear the hardware ID for all users, allowing them to log in from a different device.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResetHwidOpen(false)} data-testid="button-reset-hwid-cancel">
              Cancel
            </Button>
            <Button
              onClick={() => resetHwid.mutate("all")}
              disabled={resetHwid.isPending}
              data-testid="button-reset-hwid-submit"
            >
              {resetHwid.isPending ? "Resetting..." : "Reset All HWIDs"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User(s)</DialogTitle>
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
                  <SelectItem value="expired">Delete Expired</SelectItem>
                  <SelectItem value="banned">Delete Banned</SelectItem>
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
              {bulkDelete.isPending ? "Deleting..." : "Delete User(s)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
