import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireUser } from "./auth";

export const createJob = mutation({
  args: {
    jobId: v.string(),
    title: v.string(),
    description: v.string(),
    requiredSkills: v.array(v.string())
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const existing = await ctx.db
      .query("jobs")
      .withIndex("by_job_id", (q) => q.eq("jobId", args.jobId))
      .first();
    if (existing) {
      throw new Error("Job ID already exists");
    }

    return ctx.db.insert("jobs", {
      ...args,
      createdBy: admin.email,
      createdAt: Date.now(),
      status: "open"
    });
  }
});

export const listJobs = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return ctx.db.query("jobs").withIndex("by_status", (q) => q.eq("status", "open")).collect();
  }
});

export const listJobsAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.db.query("jobs").collect();
  }
});

export const updateJobStatus = mutation({
  args: {
    jobIdRef: v.id("jobs"),
    status: v.union(v.literal("draft"), v.literal("open"), v.literal("closed"))
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const job = await ctx.db.get(args.jobIdRef);
    if (!job) throw new Error("Job not found");
    await ctx.db.patch(args.jobIdRef, { status: args.status });
    return args.jobIdRef;
  }
});

export const updateJob = mutation({
  args: {
    jobIdRef: v.id("jobs"),
    title: v.string(),
    description: v.string(),
    requiredSkills: v.array(v.string())
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const job = await ctx.db.get(args.jobIdRef);
    if (!job) throw new Error("Job not found");
    await ctx.db.patch(args.jobIdRef, {
      title: args.title.trim(),
      description: args.description,
      requiredSkills: args.requiredSkills.map((s) => s.trim()).filter(Boolean)
    });
    return args.jobIdRef;
  }
});
