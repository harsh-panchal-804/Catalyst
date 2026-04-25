import { mutation } from "./_generated/server";
import { requireUser } from "./auth";

export const upsertMe = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", me.clerkUserId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: me.email,
        name: me.name,
        role: me.role
      });
      return existing._id;
    }

    return ctx.db.insert("users", {
      clerkUserId: me.clerkUserId,
      email: me.email,
      name: me.name,
      role: me.role,
      createdAt: Date.now()
    });
  }
});
