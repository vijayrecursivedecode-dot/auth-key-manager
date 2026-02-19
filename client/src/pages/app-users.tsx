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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Users,
  MoreVertical,
  Ban,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import type { Application, AppUser } from "@shared/schema";

export default function AppUsersPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const { data: apps } = useQuery<Application[]>({
    queryKey: ["/api/applications"],
  });
  const { data: appUsers, isLoading } = useQuery<AppUser[]>({
    queryKey: ["/api/app-users"],
  });

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
      setDialogOpen(false);
      setUsername("");
      setPassword("");
      toast({ title: "User created successfully" });
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

  const getAppName = (appId: string) =>
    apps?.find((a) => a.id === appId)?.name || "Unknown";

  const filtered = appUsers?.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      (u.hwid && u.hwid.toLowerCase().includes(search.toLowerCase()))
  );

  const formatDate = (date: string | Date | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage application users
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              disabled={!apps || apps.length === 0}
              data-testid="button-create-user"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
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
                      <SelectItem key={app.id} value={app.id}>
                        {app.name}
                      </SelectItem>
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
                <label className="mb-1.5 block text-sm font-medium">
                  Password (optional)
                </label>
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
                disabled={
                  !selectedAppId || !username.trim() || createUser.isPending
                }
                data-testid="button-submit-user"
              >
                {createUser.isPending ? "Creating..." : "Add User"}
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
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-users"
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
                  <TableHead>Username</TableHead>
                  <TableHead>Application</TableHead>
                  <TableHead>HWID</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell className="font-medium">
                      {user.username}
                    </TableCell>
                    <TableCell className="text-sm">
                      {getAppName(user.appId)}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs text-muted-foreground">
                        {user.hwid || "N/A"}
                      </code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.ip || "N/A"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{user.level}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(user.lastLogin)}
                    </TableCell>
                    <TableCell>
                      {user.banned ? (
                        <Badge variant="destructive">Banned</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              toggleBan.mutate({
                                id: user.id,
                                banned: !user.banned,
                              })
                            }
                          >
                            {user.banned ? (
                              <>
                                <ShieldCheck className="mr-2 h-4 w-4" /> Unban
                              </>
                            ) : (
                              <>
                                <Ban className="mr-2 h-4 w-4" /> Ban
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteUser.mutate(user.id)}
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
        </Card>
      ) : (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="font-semibold">No users found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Users will appear here when they authenticate with your applications.
          </p>
        </Card>
      )}
    </div>
  );
}
