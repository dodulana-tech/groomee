"use client";

import { useEffect, useState, useCallback } from "react";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface AdminRole {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  _count: { users: number };
}

interface TeamMember {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  adminRoleId: string | null;
  adminRole: { id: string; name: string; slug: string } | null;
  createdAt: string;
  lastActiveAt: string | null;
}

interface ActivityRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  admin: { id: string; name: string | null; phone: string; email: string | null };
}

interface TeamMeta {
  count: number;
  cap: number;
}

// ─── PERMISSION GROUPS (mirrors server) ──────────────────────────────────────

const PERMISSION_GROUPS = [
  {
    label: "Dashboard",
    permissions: [{ key: "dashboard.view", label: "View dashboard" }],
  },
  {
    label: "Bookings",
    permissions: [
      { key: "bookings.view", label: "View bookings" },
      { key: "bookings.manage", label: "Manage bookings" },
      { key: "bookings.force_complete", label: "Force-complete" },
      { key: "bookings.refund", label: "Initiate refunds" },
    ],
  },
  {
    label: "Disputes",
    permissions: [
      { key: "disputes.view", label: "View disputes" },
      { key: "disputes.manage", label: "Resolve disputes" },
    ],
  },
  {
    label: "Beauty Pros",
    permissions: [
      { key: "pros.view", label: "View pros" },
      { key: "pros.manage", label: "Manage pros" },
    ],
  },
  {
    label: "Customers",
    permissions: [
      { key: "customers.view", label: "View customers" },
      { key: "customers.manage", label: "Manage customers" },
    ],
  },
  {
    label: "Payouts",
    permissions: [
      { key: "payouts.view", label: "View payouts" },
      { key: "payouts.manage", label: "Process payouts" },
    ],
  },
  {
    label: "Catalog",
    permissions: [
      { key: "catalog.view", label: "View catalog" },
      { key: "catalog.manage", label: "Manage catalog" },
    ],
  },
  {
    label: "Settings",
    permissions: [
      { key: "settings.view", label: "View settings" },
      { key: "settings.manage_ops", label: "Edit ops settings" },
      { key: "settings.manage_finance", label: "Edit finance settings" },
    ],
  },
  {
    label: "Team",
    permissions: [
      { key: "team.view", label: "View team" },
      { key: "team.manage", label: "Manage team & roles" },
    ],
  },
  {
    label: "Analytics",
    permissions: [
      { key: "analytics.view", label: "View analytics" },
      { key: "analytics.export", label: "Export data" },
    ],
  },
  {
    label: "Advances",
    permissions: [
      { key: "advances.view", label: "View advances" },
      { key: "advances.manage", label: "Manage advances" },
    ],
  },
  {
    label: "Subscriptions",
    permissions: [
      { key: "subscriptions.view", label: "View subscriptions" },
      { key: "subscriptions.manage", label: "Manage subscriptions" },
    ],
  },
  {
    label: "Notes & Activity",
    permissions: [
      { key: "notes.view", label: "View notes" },
      { key: "notes.manage", label: "Add/edit notes" },
      { key: "activity.view", label: "View activity log" },
    ],
  },
];

// ─── PAGE ────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const [tab, setTab] = useState<"members" | "roles" | "activity">("members");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [meta, setMeta] = useState<TeamMeta | null>(null);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showInvite, setShowInvite] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [membersRes, rolesRes] = await Promise.all([
        fetch("/api/admin/team"),
        fetch("/api/admin/roles"),
      ]);
      const membersData = await membersRes.json();
      const rolesData = await rolesRes.json();
      if (membersData.success) {
        setMembers(membersData.data);
        if (membersData.meta) setMeta(membersData.meta);
      }
      if (rolesData.success) setRoles(rolesData.data);
    } catch {
      setError("Failed to load team data");
    } finally {
      setLoading(false);
    }
  }, []);

  const atCap = Boolean(meta && meta.count >= meta.cap);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Team Management</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Manage admin users and their roles
            {meta && (
              <>
                {" "}&middot;{" "}
                <span
                  className={`font-semibold ${atCap ? "text-amber-600" : "text-gray-500"}`}
                >
                  {meta.count}/{meta.cap} admins
                </span>
              </>
            )}
          </p>
        </div>
        {tab !== "activity" && (
          <button
            onClick={() => (tab === "members" ? setShowInvite(true) : setShowRoleForm(true))}
            disabled={tab === "members" && atCap}
            title={tab === "members" && atCap ? "Admin team is at capacity" : undefined}
            className="text-sm font-semibold text-white bg-green-600 px-4 py-2 rounded-xl hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {tab === "members" ? "+ Invite member" : "+ Create role"}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
      )}

      {atCap && tab === "members" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ Admin team is at capacity ({meta?.cap}). Remove a member before inviting another.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(["members", "roles", "activity"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              tab === t
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "members"
              ? `Members (${members.length})`
              : t === "roles"
                ? `Roles (${roles.length})`
                : "Activity"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "members" && (
        <MembersTable
          members={members}
          roles={roles}
          onEdit={setEditingMember}
        />
      )}
      {tab === "roles" && (
        <RolesGrid
          roles={roles}
          onEdit={(role) => {
            setEditingRole(role);
            setShowRoleForm(true);
          }}
          onDelete={async (id) => {
            if (!confirm("Delete this role?")) return;
            const res = await fetch(`/api/admin/roles/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) fetchData();
            else alert(data.error);
          }}
        />
      )}
      {tab === "activity" && <ActivityTab />}

      {/* Invite modal */}
      {showInvite && (
        <InviteModal
          roles={roles}
          onClose={() => setShowInvite(false)}
          onSuccess={fetchData}
        />
      )}

      {/* Role form modal */}
      {showRoleForm && (
        <RoleFormModal
          role={editingRole}
          onClose={() => {
            setShowRoleForm(false);
            setEditingRole(null);
          }}
          onSuccess={fetchData}
        />
      )}

      {/* Edit member modal */}
      {editingMember && (
        <EditMemberModal
          member={editingMember}
          roles={roles}
          onClose={() => setEditingMember(null)}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}

// ─── MEMBERS TABLE ───────────────────────────────────────────────────────────

function MembersTable({
  members,
  roles,
  onEdit,
}: {
  members: TeamMember[];
  roles: AdminRole[];
  onEdit: (m: TeamMember) => void;
}) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {["Name", "Phone", "Role", "Last active", "Joined", "Actions"].map((h) => (
              <th
                key={h}
                className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider px-5 py-3"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr
              key={m.id}
              className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
            >
              <td className="px-5 py-3.5">
                <p className="font-semibold text-gray-800">
                  {m.name || "Unnamed"}
                </p>
                {m.email && (
                  <p className="text-xs text-gray-400">{m.email}</p>
                )}
              </td>
              <td className="px-5 py-3.5 text-gray-600 font-mono text-xs">
                {m.phone}
              </td>
              <td className="px-5 py-3.5">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  m.adminRole?.slug === "super-admin"
                    ? "bg-purple-50 text-purple-700"
                    : "bg-green-50 text-green-700"
                }`}>
                  {m.adminRole?.name || "No role"}
                </span>
              </td>
              <td className="px-5 py-3.5 text-gray-400 text-xs">
                {formatRelative(m.lastActiveAt)}
              </td>
              <td className="px-5 py-3.5 text-gray-400 text-xs">
                {new Date(m.createdAt).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </td>
              <td className="px-5 py-3.5">
                <button
                  onClick={() => onEdit(m)}
                  className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
          {members.length === 0 && (
            <tr>
              <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                No team members yet. Invite your first admin.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "Just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

// ─── ACTIVITY TAB ────────────────────────────────────────────────────────────

function ActivityTab() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/activity?page=${page}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.success) {
          setRows(data.data);
          setTotalPages(data.meta?.totalPages ?? 1);
          setError(null);
        } else {
          setError(data.error ?? "Failed to load activity");
        }
      } catch {
        if (!cancelled) setError("Failed to load activity");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page]);

  if (loading && rows.length === 0) {
    return <div className="text-sm text-gray-400">Loading activity…</div>;
  }
  if (error) {
    return <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>;
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {["When", "Admin", "Action", "Target"].map((h) => (
              <th
                key={h}
                className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider px-5 py-3"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
              <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">
                {new Date(r.createdAt).toLocaleString("en-NG", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td className="px-5 py-3 text-sm text-gray-700">
                {r.admin?.name ?? r.admin?.phone ?? "Unknown"}
              </td>
              <td className="px-5 py-3 text-sm font-mono text-gray-600">
                {r.action}
              </td>
              <td className="px-5 py-3 text-xs text-gray-500 font-mono">
                {r.entityType}: {r.entityId.slice(0, 8)}…
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-5 py-12 text-center text-gray-400">
                No activity recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <span className="text-xs text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── ROLES GRID ──────────────────────────────────────────────────────────────

function RolesGrid({
  roles,
  onEdit,
  onDelete,
}: {
  roles: AdminRole[];
  onEdit: (r: AdminRole) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {roles.map((role) => (
        <div key={role.id} className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                {role.name}
                {role.isSystem && (
                  <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                    SYSTEM
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">{role.description}</p>
            </div>
            <span className="text-xs font-mono text-gray-400">
              {role._count.users} user{role._count.users !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex flex-wrap gap-1">
            {role.permissions.includes("*") ? (
              <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                Full access
              </span>
            ) : (
              role.permissions.slice(0, 6).map((p) => (
                <span
                  key={p}
                  className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full"
                >
                  {p}
                </span>
              ))
            )}
            {!role.permissions.includes("*") && role.permissions.length > 6 && (
              <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                +{role.permissions.length - 6} more
              </span>
            )}
          </div>

          {!role.isSystem && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => onEdit(role)}
                className="text-xs font-semibold text-green-600 hover:underline"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(role.id)}
                className="text-xs font-semibold text-red-400 hover:underline"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── INVITE MODAL ────────────────────────────────────────────────────────────

function InviteModal({
  roles,
  onClose,
  onSuccess,
}: {
  roles: AdminRole[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, email: email || undefined, roleId }),
    });
    const data = await res.json();

    if (data.success) {
      onSuccess();
      onClose();
    } else {
      setError(data.error);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4"
      >
        <h3 className="text-lg font-bold text-gray-900">Invite team member</h3>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
            placeholder="e.g. Amaka Obi"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
            placeholder="+2348012345678"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            Email <span className="font-normal text-gray-400">(optional — for invite & email login)</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
            placeholder="amaka@groomee.ng"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Role</label>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 text-sm font-semibold text-gray-600 bg-gray-100 py-2.5 rounded-xl hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 text-sm font-semibold text-white bg-green-600 py-2.5 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {submitting ? "Inviting..." : "Invite"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── EDIT MEMBER MODAL ───────────────────────────────────────────────────────

function EditMemberModal({
  member,
  roles,
  onClose,
  onSuccess,
}: {
  member: TeamMember;
  roles: AdminRole[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [roleId, setRoleId] = useState(member.adminRoleId || roles[0]?.id || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/admin/team/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleId }),
    });
    const data = await res.json();

    if (data.success) {
      onSuccess();
      onClose();
    } else {
      setError(data.error);
      setSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm(`Remove ${member.name || member.phone} from the team? They'll lose admin access.`))
      return;

    setSubmitting(true);
    const res = await fetch(`/api/admin/team/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deactivate: true }),
    });
    const data = await res.json();

    if (data.success) {
      onSuccess();
      onClose();
    } else {
      setError(data.error);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
        <h3 className="text-lg font-bold text-gray-900">
          Edit: {member.name || member.phone}
        </h3>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Role</label>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 text-sm font-semibold text-gray-600 bg-gray-100 py-2.5 rounded-xl hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={submitting}
            className="flex-1 text-sm font-semibold text-white bg-green-600 py-2.5 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <button
            onClick={handleDeactivate}
            disabled={submitting}
            className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
          >
            Remove from team
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ROLE FORM MODAL (create / edit with permission picker) ──────────────────

function RoleFormModal({
  role,
  onClose,
  onSuccess,
}: {
  role: AdminRole | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEditing = !!role;
  const [name, setName] = useState(role?.name || "");
  const [description, setDescription] = useState(role?.description || "");
  const [permissions, setPermissions] = useState<string[]>(role?.permissions || []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePermission = (key: string) => {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  };

  const toggleGroup = (group: typeof PERMISSION_GROUPS[number]) => {
    const groupKeys = group.permissions.map((p) => p.key);
    const allSelected = groupKeys.every((k) => permissions.includes(k));
    if (allSelected) {
      setPermissions((prev) => prev.filter((p) => !groupKeys.includes(p)));
    } else {
      setPermissions((prev) => [...new Set([...prev, ...groupKeys])]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const url = isEditing ? `/api/admin/roles/${role.id}` : "/api/admin/roles";
    const method = isEditing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, permissions }),
    });
    const data = await res.json();

    if (data.success) {
      onSuccess();
      onClose();
    } else {
      setError(data.error);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4"
      >
        <h3 className="text-lg font-bold text-gray-900">
          {isEditing ? `Edit: ${role.name}` : "Create new role"}
        </h3>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            Role name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
            placeholder="e.g. Marketing Lead"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            Description
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
            placeholder="What this role does"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-2">
            Permissions ({permissions.length} selected)
          </label>
          <div className="space-y-3 max-h-72 overflow-y-auto border border-gray-100 rounded-xl p-3">
            {PERMISSION_GROUPS.map((group) => {
              const groupKeys = group.permissions.map((p) => p.key);
              const allSelected = groupKeys.every((k) => permissions.includes(k));
              const someSelected = groupKeys.some((k) => permissions.includes(k));

              return (
                <div key={group.label}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group)}
                    className="flex items-center gap-2 text-xs font-bold text-gray-700 uppercase tracking-wider mb-1"
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[8px] ${
                        allSelected
                          ? "bg-green-500 border-green-500 text-white"
                          : someSelected
                            ? "bg-green-100 border-green-300"
                            : "border-gray-300"
                      }`}
                    >
                      {allSelected ? "✓" : ""}
                    </span>
                    {group.label}
                  </button>
                  <div className="ml-5 space-y-0.5">
                    {group.permissions.map((p) => (
                      <label
                        key={p.key}
                        className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer py-0.5"
                      >
                        <input
                          type="checkbox"
                          checked={permissions.includes(p.key)}
                          onChange={() => togglePermission(p.key)}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 text-sm font-semibold text-gray-600 bg-gray-100 py-2.5 rounded-xl hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || permissions.length === 0}
            className="flex-1 text-sm font-semibold text-white bg-green-600 py-2.5 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {submitting ? "Saving..." : isEditing ? "Update role" : "Create role"}
          </button>
        </div>
      </form>
    </div>
  );
}
