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
import { Plus, Copy, Trash2, Coins, Search } from "lucide-react";
import type { Application, Token } from "@shared/schema";

export default function TokensPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState("");
  const [count, setCount] = useState("1");

  const { data: apps } = useQuery<Application[]>({
    queryKey: ["/api/applications"],
  });
  const { data: tokens, isLoading } = useQuery<Token[]>({
    queryKey: ["/api/tokens"],
  });

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
      setDialogOpen(false);
      setCount("1");
      toast({ title: "Token(s) generated successfully" });
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

  const deleteToken = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/tokens/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tokens"] });
      toast({ title: "Token deleted" });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Token copied" });
  };

  const getAppName = (appId: string) =>
    apps?.find((a) => a.id === appId)?.name || "Unknown";

  const filtered = tokens?.filter(
    (t) =>
      t.token.toLowerCase().includes(search.toLowerCase()) ||
      (t.usedBy && t.usedBy.toLowerCase().includes(search.toLowerCase()))
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
          <h1 className="text-2xl font-bold tracking-tight">Tokens</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate and manage registration tokens
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              disabled={!apps || apps.length === 0}
              data-testid="button-create-token"
            >
              <Plus className="mr-2 h-4 w-4" />
              Generate Tokens
            </Button>
          </DialogTrigger>
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
                      <SelectItem key={app.id} value={app.id}>
                        {app.name}
                      </SelectItem>
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
      </div>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search tokens..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-tokens"
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
                  <TableHead>Token</TableHead>
                  <TableHead>Application</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Used By</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((token) => (
                  <TableRow key={token.id} data-testid={`row-token-${token.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="max-w-[180px] truncate font-mono text-xs">
                          {token.token}
                        </code>
                        <button
                          onClick={() => copyToClipboard(token.token)}
                          className="text-muted-foreground"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {getAppName(token.appId)}
                    </TableCell>
                    <TableCell>
                      {token.used ? (
                        <Badge variant="secondary">Used</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Available</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {token.usedBy || "N/A"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(token.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteToken.mutate(token.id)}
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
          <Coins className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="font-semibold">No tokens found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate registration tokens for controlled user onboarding.
          </p>
        </Card>
      )}
    </div>
  );
}
