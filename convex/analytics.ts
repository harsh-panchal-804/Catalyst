import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./auth";

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

function extractQuestionDurations(skillRows: any[]) {
  const durations: number[] = [];
  for (const row of skillRows || []) {
    for (const q of row?.questions || []) {
      if (typeof q?.timeTakenSeconds === "number" && Number.isFinite(q.timeTakenSeconds)) {
        durations.push(Math.max(0, Number(q.timeTakenSeconds)));
      } else if (
        typeof q?.startedAt === "number" &&
        typeof q?.submittedAt === "number" &&
        q.submittedAt >= q.startedAt
      ) {
        durations.push(Math.round((q.submittedAt - q.startedAt) / 1000));
      }
    }
  }
  return durations;
}

export const jobStats = query({
  args: { jobIdRef: v.id("jobs") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_job", (q) => q.eq("jobIdRef", args.jobIdRef))
      .collect();

    const started = apps.filter((a) => a.assessmentStatus !== "not_started").length;
    const completed = apps.filter((a) => a.assessmentStatus === "completed").length;

    return {
      applicants: apps.length,
      started,
      completed
    };
  }
});

export const jobRankings = query({
  args: { jobIdRef: v.id("jobs") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const results = await ctx.db
      .query("assessmentResults")
      .withIndex("by_job_score", (q) => q.eq("jobIdRef", args.jobIdRef))
      .collect();
    const sorted = [...results].sort((a, b) => b.finalScore - a.finalScore);
    const rows = await Promise.all(
      sorted.map(async (r, index) => {
        const user = await ctx.db.get(r.candidateIdRef);
        const skillRows: any[] = await ctx.db
          .query("skillAssessments")
          .withIndex("by_candidate_job", (q) =>
            q.eq("candidateIdRef", r.candidateIdRef).eq("jobIdRef", args.jobIdRef)
          )
          .collect();
        const durations = extractQuestionDurations(skillRows);
        return {
          rank: index + 1,
          candidateEmail: user?.email || "unknown",
          finalScore: r.finalScore,
          recommendation: r.recommendation,
          medianTimePerQuestionSec: median(durations)
        };
      })
    );
    return rows;
  }
});

export const jobApplicantsDetail = query({
  args: { jobIdRef: v.id("jobs") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const job: any = await ctx.db.get(args.jobIdRef);
    if (!job) return null;

    const apps = await ctx.db
      .query("applications")
      .withIndex("by_job", (q) => q.eq("jobIdRef", args.jobIdRef))
      .collect();

    const rows = await Promise.all(
      apps.map(async (app: any) => {
        const user: any = await ctx.db.get(app.candidateIdRef);
        const result: any = await ctx.db
          .query("assessmentResults")
          .withIndex("by_application", (q) => q.eq("applicationIdRef", app._id))
          .first();
        const skillRows: any[] = await ctx.db
          .query("skillAssessments")
          .withIndex("by_candidate_job", (q) =>
            q.eq("candidateIdRef", app.candidateIdRef).eq("jobIdRef", args.jobIdRef)
          )
          .collect();

        const skillScores: Record<
          string,
          { score: number | null; status: string; conclusion: string | null }
        > = {};
        for (const s of skillRows) {
          skillScores[s.skill] = {
            score: typeof s.skillScore === "number" ? s.skillScore : null,
            status: s.status,
            conclusion: s.conclusion || null
          };
        }
        const durations = extractQuestionDurations(skillRows);

        return {
          applicationId: app._id,
          candidateId: app.candidateIdRef,
          candidateEmail: user?.email || "",
          candidateName: user?.name || "",
          appliedAt: app.appliedAt,
          assessmentStatus: app.assessmentStatus,
          finalScore: result?.finalScore ?? null,
          recommendation: result?.recommendation ?? null,
          completedAt: result?.completedAt ?? null,
          medianTimePerQuestionSec: median(durations),
          skillScores,
          fitScore: typeof app.fitScore === "number" ? app.fitScore : null,
          fitBreakdown: app.fitBreakdown || null,
          parsedAt: app.parsedAt ?? null,
          yearsOfExperience:
            typeof app.resumeStructured?.yearsOfExperience === "number"
              ? app.resumeStructured.yearsOfExperience
              : null
        };
      })
    );

    return {
      job: {
        _id: job._id,
        jobId: job.jobId,
        title: job.title,
        requiredSkills: Array.isArray(job.requiredSkills) ? job.requiredSkills : [],
        status: job.status
      },
      rows
    };
  }
});

export const jobSkillAggregate = query({
  args: { jobIdRef: v.id("jobs") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const job: any = await ctx.db.get(args.jobIdRef);
    if (!job) return null;

    const skills: string[] = Array.isArray(job.requiredSkills) ? job.requiredSkills : [];
    const aggregates = [];
    for (const skill of skills) {
      const rows: any[] = await ctx.db
        .query("skillAssessments")
        .withIndex("by_job_skill_score", (q) =>
          q.eq("jobIdRef", args.jobIdRef).eq("skill", skill)
        )
        .collect();
      const completed = rows.filter(
        (r: any) => r.status === "completed" && typeof r.skillScore === "number"
      );
      const scores = completed
        .map((r: any) => r.skillScore as number)
        .sort((a: number, b: number) => a - b);
      const n = scores.length;
      const sum = scores.reduce((a, b) => a + b, 0);
      const avg = n ? Math.round(sum / n) : 0;
      const min = n ? scores[0] : 0;
      const max = n ? scores[n - 1] : 0;
      const median = n ? scores[Math.floor(n / 2)] : 0;
      aggregates.push({ skill, count: n, avg, min, max, median });
    }

    return {
      job: {
        _id: job._id,
        jobId: job.jobId,
        title: job.title,
        requiredSkills: skills,
        status: job.status
      },
      skills: aggregates
    };
  }
});

export const getApplicationDetailAdmin = query({
  args: { applicationIdRef: v.id("applications") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const app: any = await ctx.db.get(args.applicationIdRef);
    if (!app) return null;
    const job: any = await ctx.db.get(app.jobIdRef);
    const candidate: any = await ctx.db.get(app.candidateIdRef);
    const result: any = await ctx.db
      .query("assessmentResults")
      .withIndex("by_application", (q) => q.eq("applicationIdRef", args.applicationIdRef))
      .first();
    const skills: any[] = await ctx.db
      .query("skillAssessments")
      .withIndex("by_candidate_job", (q) =>
        q.eq("candidateIdRef", app.candidateIdRef).eq("jobIdRef", app.jobIdRef)
      )
      .collect();
    return {
      application: app,
      job,
      candidate,
      result,
      skills,
      structured: app.resumeStructured || null,
      fitScore: typeof app.fitScore === "number" ? app.fitScore : null,
      fitBreakdown: app.fitBreakdown || null
    };
  }
});
