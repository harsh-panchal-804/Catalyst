import { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export type AnyAuthCtx = QueryCtx | MutationCtx | ActionCtx;

export async function requireUser(ctx: AnyAuthCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized");
  }

  const email = (identity.email || "").toLowerCase();
  const role = getAdminEmails().includes(email) ? "admin" : "user";

  return {
    clerkUserId: identity.subject,
    email,
    name: identity.name || "",
    role
  };
}

export async function requireAdmin(ctx: AnyAuthCtx) {
  const user = await requireUser(ctx);
  if (user.role !== "admin") {
    throw new Error("Admin access required");
  }
  return user;
}

export function isAdminEmail(email: string) {
  return getAdminEmails().includes((email || "").toLowerCase());
}
