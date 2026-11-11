import { Plus, Trash, Users as UsersIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Button, Empty, ErrorState, Field, Modal, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtDate, peso } from "../../lib/format";
import { useAct } from "../../lib/hooks";
import { User, ask, useAuth } from "../../store";

export default function UsersPage() {
  const [tab, setTab] = useState<"customers" | "team">("customers");
  const me = useAuth((s) => s.user)!;
  const cust = useQuery({ queryKey: ["users", "customers"], queryFn: () => api<any[]>("/admin/customers") });
  const team = useQuery({ queryKey: ["users", "team"], queryFn: () => api<User[]>("/admin/team") });
  const [adding, setAdding] = useState(false);

  const patch = useAct(({ id, body }: { id: number; body: object }) => api(`/admin/users/${id}`, { method: "PATCH", body }), { invalidate: ["users"], success: "User updated" });
  const remove = useAct(async (u: { id: number; name: string }) => {
    const ok = await ask({ title: `Delete ${u.name}?`, body: "Accounts with orders can only be deactivated.", confirm: "Delete", danger: true });
    if (!ok) throw new Error("Cancelled");
    return api(`/admin/users/${u.id}`, { method: "DELETE" });
  }, { invalidate: ["users"], success: "User deleted" });
  const add = useAct((b: object) => api("/admin/team", { body: b }), { invalidate: ["users"], success: "Team member added" });

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    add.mutate(Object.fromEntries(new FormData(e.currentTarget)), { onSuccess: () => setAdding(false) });
  };

  return (
    <div className="admin-detail-page admin-users-page">
      <div className="page-title">
        <h1>Users</h1>
      </div>
      <div className="admin-users-toolbar">
      <div className="seg admin-user-tabs" role="group" aria-label="User groups">
        <button type="button" aria-pressed={tab === "customers"} onClick={() => setTab("customers")}>Customers</button>
        <button type="button" aria-pressed={tab === "team"} onClick={() => setTab("team")}>Team &amp; Access</button>
      </div>
      <button type="button" className="btn primary admin-add-member" style={{ visibility: tab === "team" ? "visible" : "hidden" }} aria-hidden={tab !== "team"} tabIndex={tab === "team" ? 0 : -1} onClick={() => setAdding(true)}><Plus size={18} aria-hidden="true" /> Add team member</button>
      </div>
      <div className="card flush">
        {tab === "customers" ? (
          cust.isLoading ? <div style={{ padding: 16 }}><Skeleton h={160} /></div> : cust.isError ? <ErrorState error={cust.error} retry={() => cust.refetch()} /> : !cust.data?.length ? (
            <Empty icon={<UsersIcon size={32} aria-hidden="true" />} title="No customers yet" />
          ) : (
            <div className="table-wrap admin-users-table"><table>
              <thead><tr><th>Customer</th><th>Phone</th><th className="r">Orders</th><th className="r">Spent</th><th>Joined</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>{cust.data.map((c) => (
                <tr key={c.id}>
                  <td data-label="Customer"><strong className="admin-person-name">{c.name}</strong><div className="muted wrap-any admin-person-email">{c.email}</div></td>
                  <td data-label="Phone" className="num">{c.phone || "—"}</td><td data-label="Orders" className="r num">{c.orders}</td><td data-label="Spent" className="r num">{peso(c.spent)}</td><td data-label="Joined">{fmtDate(c.created_at)}</td>
                  <td data-label="Status"><span className={`badge ${c.is_active ? "ok" : "bad"}`}>{c.is_active ? "Active" : "Deactivated"}</span></td>
                  <td data-label="Actions"><div className="row admin-table-actions">
                    <button className="btn sm" disabled={patch.isPending} onClick={() => patch.mutate({ id: c.id, body: { is_active: !c.is_active } })}>{c.is_active ? "Deactivate" : "Activate"}</button>
                    <button className="btn sm danger" disabled={remove.isPending} aria-label={`Delete ${c.name}`} onClick={() => remove.mutate(c)}><Trash size={16} aria-hidden="true" /></button>
                  </div></td>
                </tr>))}</tbody></table></div>
          )
        ) : team.isLoading ? <div style={{ padding: 16 }}><Skeleton h={160} /></div> : team.isError ? <ErrorState error={team.error} retry={() => team.refetch()} /> : !team.data?.length ? <Empty icon={<UsersIcon size={32} aria-hidden="true" />} title="No team members yet" /> : (
          <div className="table-wrap admin-users-table"><table>
            <thead><tr><th>Member</th><th>Role</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{team.data!.map((m) => (
              <tr key={m.id}>
                <td data-label="Member"><strong className="admin-person-name">{m.name}</strong><div className="muted wrap-any admin-person-email">{m.email}</div></td>
                <td data-label="Role">
                  <label><span className="sr-only">Role for {m.name}</span>
                    <select className="input" value={m.role} disabled={patch.isPending || m.id === me.id || (m.role === "admin" && me.role !== "admin")}
                      onChange={(e) => patch.mutate({ id: m.id, body: { role: e.target.value } })}>
                      <option value="staff">Staff</option><option value="rider">Rider</option><option value="owner">Owner</option>{(me.role === "admin" || m.role === "admin") && <option value="admin">Admin</option>}
                    </select></label>
                </td>
                <td data-label="Status"><span className={`badge ${(m as any).is_active ? "ok" : "bad"}`}>{(m as any).is_active ? "Active" : "Deactivated"}</span></td>
                <td data-label="Actions">{m.id !== me.id && <div className="row admin-table-actions">
                  <button className="btn sm" disabled={patch.isPending} onClick={() => patch.mutate({ id: m.id, body: { is_active: !(m as any).is_active } })}>{(m as any).is_active ? "Deactivate" : "Activate"}</button>
                  <button className="btn sm danger" disabled={remove.isPending} aria-label={`Delete ${m.name}`} onClick={() => remove.mutate(m)}><Trash size={16} aria-hidden="true" /></button>
                </div>}</td>
              </tr>))}</tbody></table></div>
        )}
      </div>
      {adding && (
        <Modal title="Add team member" onClose={() => setAdding(false)}>
          <form className="stack admin-edit-form" onSubmit={submit}>
            <Field label="Full name">{(p) => <input {...p} className="input" name="name" required data-autofocus />}</Field>
            <Field label="Email">{(p) => <input {...p} className="input" name="email" type="email" required />}</Field>
            <Field label="Temporary password" help="At least 8 characters. They should change it after first sign-in.">{(p) => <input {...p} className="input" name="password" type="password" minLength={8} required autoComplete="new-password" />}</Field>
            <Field label="Role">{(p) => <select {...p} className="input" name="role"><option value="staff">Staff</option><option value="rider">Rider</option><option value="owner">Owner</option></select>}</Field>
            <div className="admin-form-actions">
              <button type="button" className="btn" onClick={() => setAdding(false)}>Cancel</button>
              <Button className="primary" type="submit" loading={add.isPending}>Add member</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
