import CreateUserForm from "@/components/users/CreateUserForm";
import { getSession } from "@/lib/session";
import { normalizeRoleId, roles } from "@/lib/roles";

export default async function CreateUserPage() {
  const session = await getSession();
  const roleId = normalizeRoleId(session?.role);
  const canCreate = [roles.CEO, roles.PM, roles.CTO].includes(roleId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
            User management
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Create user accounts
          </h2>
          <p className="mt-2 text-sm text-white/60">
            Only executive and product leadership can provision new access.
          </p>
        </div>
      </div>

      {canCreate ? (
        <CreateUserForm />
      ) : (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-100">
          You do not have permission to create users.
        </div>
      )}
    </div>
  );
}
