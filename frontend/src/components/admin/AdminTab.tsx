import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Users,
  Shield,
  CheckCircle2,
  XCircle,
  Search,
  Pencil,
  Trash2,
  Crown,
  UserCheck,
  UserX,
} from "lucide-react";
import {
  adminListUsers,
  adminUpdateUser,
  adminDeleteUser,
  type AdminUser,
  type AdminUserUpdate,
} from "@/api";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { cn } from "@/lib/utils";

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  colorClass,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  colorClass: string;
}) {
  return (
    <Card>
      <CardContent className="p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {label}
          </span>
          <div
            className={cn(
              "h-8 w-8 rounded-xl flex items-center justify-center",
              colorClass,
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="text-3xl font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

// ── Edit dialog ────────────────────────────────────────────────────────────────

function EditUserDialog({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onSaved: (updated: AdminUser) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [plan, setPlan] = useState<"free" | "pro">("free");
  const [isActive, setIsActive] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name ?? "");
      setPlan(user.plan as "free" | "pro");
      setIsActive(user.is_active);
      setIsAdmin(user.is_admin);
    }
  }, [user]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      const update: AdminUserUpdate = {};
      if (displayName.trim() !== (user.display_name ?? ""))
        update.display_name = displayName.trim() || null;
      if (plan !== user.plan) update.plan = plan;
      if (isActive !== user.is_active) update.is_active = isActive;
      if (isAdmin !== user.is_admin) update.is_admin = isAdmin;

      const updated = await adminUpdateUser(user.id, update);
      onSaved(updated);
      toast.success("User updated");
      onClose();
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Failed to update user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={!!user}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>{user?.email}</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 flex flex-col gap-5">
          {/* Display name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-name">Display name</Label>
            <Input
              id="edit-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. John Doe"
            />
          </div>

          {/* Plan */}
          <div className="flex flex-col gap-2">
            <Label>Plan</Label>
            <Select
              value={plan}
              onValueChange={(v) => setPlan(v as "free" | "pro")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">✦ Pro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                  {isActive ? (
                    <UserCheck className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <UserX className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">Active account</p>
                  <p className="text-xs text-muted-foreground">
                    User can log in and use the app
                  </p>
                </div>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div className="flex items-center justify-between rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                  <Shield
                    className={cn(
                      "h-4 w-4",
                      isAdmin ? "text-violet-500" : "text-muted-foreground",
                    )}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium">Admin privileges</p>
                  <p className="text-xs text-muted-foreground">
                    Full access to the admin panel
                  </p>
                </div>
              </div>
              <Switch checked={isAdmin} onCheckedChange={setIsAdmin} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// function nameFromEmail(email: string) {
//   const prefix = email.split('@')[0]
//   return prefix.charAt(0).toUpperCase() + prefix.slice(1)
// }

// ── Main component ─────────────────────────────────────────────────────────────

export function AdminTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminListUsers({
        search,
        plan: planFilter,
        status: statusFilter,
      });
      setUsers(data);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [search, planFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete() {
    if (!deleteUser) return;
    setDeleting(true);
    try {
      await adminDeleteUser(deleteUser.id);
      setUsers((prev) => prev.filter((u) => u.id !== deleteUser.id));
      toast.success(`${deleteUser.email} deleted`);
      setDeleteUser(null);
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  }

  function handleSaved(updated: AdminUser) {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  }

  const total = users.length;
  const active = users.filter((u) => u.is_active).length;
  const pro = users.filter((u) => u.plan === "pro").length;
  const inactive = users.filter((u) => !u.is_active).length;

  const filterChips = [
    { label: "All", plan: "", status: "" },
    { label: "Active", plan: "", status: "active" },
    { label: "Inactive", plan: "", status: "inactive" },
    { label: "Pro", plan: "pro", status: "" },
    { label: "Free", plan: "free", status: "" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight">User management</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {loading
            ? "Loading…"
            : `${total} user${total !== 1 ? "s" : ""} registered`}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={Users}
          label="Total"
          value={total}
          colorClass="bg-blue-500/10 text-blue-500"
        />
        <StatCard
          icon={CheckCircle2}
          label="Active"
          value={active}
          colorClass="bg-emerald-500/10 text-emerald-500"
        />
        <StatCard
          icon={Crown}
          label="Pro"
          value={pro}
          colorClass="bg-amber-500/10 text-amber-500"
        />
        <StatCard
          icon={XCircle}
          label="Inactive"
          value={inactive}
          colorClass="bg-red-500/10 text-red-500"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or name…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {filterChips.map((chip) => {
            const isActive =
              chip.plan === planFilter && chip.status === statusFilter;
            return (
              <Button
                key={chip.label}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setPlanFilter(chip.plan);
                  setStatusFilter(chip.status);
                }}
                className={cn(!isActive && "text-muted-foreground")}
              >
                {chip.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Role</TableHead>
              <TableHead className="hidden lg:table-cell">Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-16 text-muted-foreground"
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    Loading users…
                  </div>
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="h-10 w-10 text-muted-foreground/20" />
                    <p className="text-sm text-muted-foreground">
                      No users match your filters
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                        {(user.display_name ?? user.email)[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate max-w-[180px]">
                          {user.email.split("@")[0] ?? (
                            <span className="text-muted-foreground italic">
                              No name
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    {user.plan === "pro" ? (
                      <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                        ✦ Pro
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-muted-foreground"
                      >
                        Free
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell>
                    {user.is_active ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                        Inactive
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="hidden md:table-cell">
                    {user.is_admin ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-400">
                        <Shield className="h-3 w-3" />
                        Admin
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        User
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditUser(user)}
                        className="h-8 w-8"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteUser(user)}
                        className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Edit dialog */}
      <EditUserDialog
        user={editUser}
        onClose={() => setEditUser(null)}
        onSaved={handleSaved}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteUser}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteUser(null);
        }}
        title="Delete user?"
        description={`This will permanently delete ${deleteUser?.email} and all their data. This action cannot be undone.`}
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        variant="danger"
        onConfirm={handleDelete}
      />
    </div>
  );
}
