import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./auth";

async function getOrCreateUser(ctx: any, me: any) {
  let user = await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", me.clerkUserId))
    .first();
  if (!user) {
    const id = await ctx.db.insert("users", {
      clerkUserId: me.clerkUserId,
      email: me.email,
      name: me.name,
      role: me.role,
      createdAt: Date.now()
    });
    user = await ctx.db.get(id);
  }
  return user;
}

export const applyToJob = mutation({
  args: {
    jobIdRef: v.id("jobs"),
    resumeFileName: v.string(),
    resumeTextSnapshot: v.string()
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const user = await getOrCreateUser(ctx, me);
    const existing = await ctx.db
      .query("applications")
      .withIndex("by_candidate", (q) => q.eq("candidateIdRef", user._id))
      .collect();
    const duplicate = existing.find((a: any) => a.jobIdRef === args.jobIdRef);
    if (duplicate) {
      throw new Error("Already applied for this job");
    }

    return ctx.db.insert("applications", {
      ...args,
      candidateIdRef: user._id,
      appliedAt: Date.now(),
      assessmentStatus: "not_started"
    });
  }
});

export const listMyApplications = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", me.clerkUserId))
      .first();
    if (!user) return [];
    return ctx.db
      .query("applications")
      .withIndex("by_candidate", (q) => q.eq("candidateIdRef", user._id))
      .collect();
  }
});

export const getMyApplicationDetail = query({
  args: { applicationIdRef: v.id("applications") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", me.clerkUserId))
      .first();
    if (!user) throw new Error("User record not found. Call users.upsertMe first.");

    const application = await ctx.db.get(args.applicationIdRef);
    if (!application) throw new Error("Application not found");
    if (application.candidateIdRef !== user._id) throw new Error("Forbidden");

    const job = await ctx.db.get(application.jobIdRef);
    const session = await ctx.db
      .query("assessmentSessions")
      .withIndex("by_application", (q) => q.eq("applicationIdRef", args.applicationIdRef))
      .first();
    const result = await ctx.db
      .query("assessmentResults")
      .withIndex("by_application", (q) => q.eq("applicationIdRef", args.applicationIdRef))
      .first();

    return { application, job, session, result };
  }
});
