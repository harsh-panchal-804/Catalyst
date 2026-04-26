import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireUser } from "./auth";
import { callHfJson } from "./llm";

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

export const _getJob = query({
  args: { jobIdRef: v.id("jobs") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return ctx.db.get(args.jobIdRef);
  }
});

function buildSuggestSkillsSystemPrompt() {
  return `
You extract a focused list of required skills from a job description.
Return STRICT JSON only. No markdown.

Output shape:
{
  "skills": ["string"]
}

Rules:
- Return between 4 and 10 skills.
- Each skill must be a short canonical token (e.g. "React", "Kubernetes", "PostgreSQL", "System Design").
  Avoid full sentences, soft phrasing like "good communication", or version numbers.
- Order by importance to the role.
- Deduplicate case-insensitively.
- If the JD is too short or vague, return your best 4-6 inferred skills.
`.trim();
}

export const suggestSkillsFromJD = action({
  args: {
    jdText: v.string(),
    title: v.optional(v.string())
  },
  handler: async (ctx, args): Promise<{ skills: string[] }> => {
    await requireAdmin(ctx);
    const jdText = String(args.jdText || "").trim();
    if (jdText.length < 20) {
      throw new Error("Job description too short to suggest skills.");
    }
    const result: any = await callHfJson({
      systemPrompt: buildSuggestSkillsSystemPrompt(),
      userPrompt: {
        title: args.title || "",
        jobDescription: jdText.slice(0, 6000)
      },
      temperature: 0.3,
      maxTokens: 400
    });
    const seen = new Set<string>();
    const skills: string[] = [];
    for (const raw of Array.isArray(result?.skills) ? result.skills : []) {
      const s = String(raw || "").trim();
      if (!s) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      skills.push(s);
      if (skills.length >= 10) break;
    }
    if (skills.length < 3) {
      throw new Error("Could not derive enough skills from the description.");
    }
    return { skills };
  }
});
