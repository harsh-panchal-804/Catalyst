import { action, internalAction, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { requireAdmin, requireUser } from "./auth";
import { callHfJson } from "./llm";

async function getCurrentCandidate(ctx: any) {
  const me = await requireUser(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", me.clerkUserId))
    .first();
  if (!user) throw new Error("User record not found. Call users.upsertMe first.");
  return user;
}

export const getLearningProgress = query({
  args: { skillAssessmentIdRef: v.id("skillAssessments") },
  handler: async (ctx, args) => {
    const user = await getCurrentCandidate(ctx);
    const row: any = await ctx.db.get(args.skillAssessmentIdRef);
    if (!row || row.candidateIdRef !== user._id) {
      throw new Error("Forbidden");
    }
    const milestones: any[] = await ctx.db
      .query("learningProgress")
      .withIndex("by_skill_assessment", (q) => q.eq("skillAssessmentIdRef", args.skillAssessmentIdRef))
      .collect();
    return milestones;
  }
});

export const setMilestoneStatus = mutation({
  args: {
    skillAssessmentIdRef: v.id("skillAssessments"),
    milestoneIndex: v.number(),
    completed: v.boolean(),
    notes: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const user = await getCurrentCandidate(ctx);
    const row: any = await ctx.db.get(args.skillAssessmentIdRef);
    if (!row || row.candidateIdRef !== user._id) throw new Error("Forbidden");
    const totalMilestones = Array.isArray(row?.learningPlan?.weeklyMilestones)
      ? row.learningPlan.weeklyMilestones.length
      : 0;
    if (args.milestoneIndex < 0 || (totalMilestones && args.milestoneIndex >= totalMilestones)) {
      throw new Error("Invalid milestoneIndex");
    }
    const existing: any = await ctx.db
      .query("learningProgress")
      .withIndex("by_skill_assessment_milestone", (q) =>
        q
          .eq("skillAssessmentIdRef", args.skillAssessmentIdRef)
          .eq("milestoneIndex", args.milestoneIndex)
      )
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        completed: args.completed,
        completedAt: args.completed ? now : undefined,
        notes: args.notes,
        updatedAt: now
      });
      return existing._id;
    }
    return ctx.db.insert("learningProgress", {
      skillAssessmentIdRef: args.skillAssessmentIdRef,
      candidateIdRef: user._id,
      milestoneIndex: args.milestoneIndex,
      completed: args.completed,
      completedAt: args.completed ? now : undefined,
      notes: args.notes,
      updatedAt: now
    });
  }
});

export const _getSkillAssessmentForLearning = query({
  args: { skillAssessmentIdRef: v.id("skillAssessments") },
  handler: async (ctx, args) => {
    const user = await getCurrentCandidate(ctx);
    const row: any = await ctx.db.get(args.skillAssessmentIdRef);
    if (!row || row.candidateIdRef !== user._id) throw new Error("Forbidden");
    return row;
  }
});

export const _storeRefresherQuiz = mutation({
  args: {
    skillAssessmentIdRef: v.id("skillAssessments"),
    skill: v.string(),
    questions: v.array(
      v.object({
        prompt: v.string(),
        options: v.array(v.string()),
        correctOptionIndex: v.number(),
        explanation: v.optional(v.string())
      })
    )
  },
  handler: async (ctx, args) => {
    const user = await getCurrentCandidate(ctx);
    const row: any = await ctx.db.get(args.skillAssessmentIdRef);
    if (!row || row.candidateIdRef !== user._id) throw new Error("Forbidden");
    const existing: any = await ctx.db
      .query("refresherQuizzes")
      .withIndex("by_skill_assessment", (q) =>
        q.eq("skillAssessmentIdRef", args.skillAssessmentIdRef)
      )
      .filter((q) => q.eq(q.field("status"), "in_progress"))
      .first();
    if (existing) return existing._id;
    return ctx.db.insert("refresherQuizzes", {
      skillAssessmentIdRef: args.skillAssessmentIdRef,
      candidateIdRef: user._id,
      skill: args.skill,
      questions: args.questions,
      status: "in_progress",
      createdAt: Date.now()
    });
  }
});

function buildRefresherSystemPrompt() {
  return `
You generate a 5-question multiple-choice refresher quiz for ONE skill,
focused on the candidate's learning plan focus areas.
Return STRICT JSON only. No markdown.

Output shape:
{
  "questions": [
    {
      "prompt": "string",
      "options": ["A","B","C","D"],
      "correctOptionIndex": 0,
      "explanation": "string (1 sentence)"
    }
  ]
}

Rules:
- Exactly 5 questions.
- Each question must have exactly 4 distinct options.
- correctOptionIndex must be in [0,3].
- Cover the focusAreas. Mix conceptual and practical.
- Keep prompts concise (<= 350 characters).
`.trim();
}

export const generateRefresherQuiz = action({
  args: { skillAssessmentIdRef: v.id("skillAssessments") },
  handler: async (
    ctx,
    args
  ): Promise<{ refresherQuizId: any }> => {
    const row: any = await ctx.runQuery(api.learning._getSkillAssessmentForLearning, {
      skillAssessmentIdRef: args.skillAssessmentIdRef
    });
    if (!row) throw new Error("Skill assessment not found");
    if (row.status !== "completed") {
      throw new Error("Refresher available only after the initial skill assessment is completed.");
    }
    const focusAreas: string[] = Array.isArray(row?.learningPlan?.focusAreas)
      ? row.learningPlan.focusAreas
      : [];
    const skill: string = row.skill;
    const result: any = await callHfJson({
      systemPrompt: buildRefresherSystemPrompt(),
      userPrompt: {
        skill,
        focusAreas,
        priorConclusion: row.conclusion || ""
      },
      temperature: 0.5,
      maxTokens: 1400
    });
    const items = Array.isArray(result?.questions) ? result.questions : [];
    if (items.length !== 5) throw new Error("Expected exactly 5 questions from the LLM.");
    const cleaned: any[] = [];
    for (const q of items) {
      const options = Array.isArray(q?.options) ? q.options.map((o: any) => String(o)) : [];
      const idx = Number(q?.correctOptionIndex);
      const prompt = String(q?.prompt || "").trim();
      if (
        !prompt ||
        options.length !== 4 ||
        new Set(options.map((o) => o.toLowerCase())).size !== 4 ||
        !Number.isFinite(idx) ||
        idx < 0 ||
        idx > 3
      ) {
        throw new Error("LLM returned an invalid refresher question.");
      }
      cleaned.push({
        prompt: prompt.slice(0, 600),
        options,
        correctOptionIndex: idx,
        explanation:
          typeof q?.explanation === "string" ? q.explanation.trim().slice(0, 400) : undefined
      });
    }
    const refresherQuizId: any = await ctx.runMutation(api.learning._storeRefresherQuiz, {
      skillAssessmentIdRef: args.skillAssessmentIdRef,
      skill,
      questions: cleaned
    });
    return { refresherQuizId };
  }
});

export const getActiveRefresher = query({
  args: { skillAssessmentIdRef: v.id("skillAssessments") },
  handler: async (ctx, args) => {
    const user = await getCurrentCandidate(ctx);
    const row: any = await ctx.db
      .query("refresherQuizzes")
      .withIndex("by_skill_assessment", (q) =>
        q.eq("skillAssessmentIdRef", args.skillAssessmentIdRef)
      )
      .order("desc")
      .first();
    if (!row) return null;
    if (row.candidateIdRef !== user._id) throw new Error("Forbidden");
    return row;
  }
});

export const submitRefresherAnswers = mutation({
  args: {
    refresherQuizIdRef: v.id("refresherQuizzes"),
    answers: v.array(v.number())
  },
  handler: async (ctx, args) => {
    const user = await getCurrentCandidate(ctx);
    const row: any = await ctx.db.get(args.refresherQuizIdRef);
    if (!row || row.candidateIdRef !== user._id) throw new Error("Forbidden");
    if (row.status === "completed") return row._id;
    if (!Array.isArray(row.questions)) throw new Error("Quiz has no questions");
    if (args.answers.length !== row.questions.length) {
      throw new Error("Answer count does not match question count");
    }
    let correct = 0;
    const updatedQuestions = row.questions.map((q: any, i: number) => {
      const selected = Number(args.answers[i]);
      const isCorrect =
        Number.isFinite(selected) && selected >= 0 && selected <= 3 && selected === q.correctOptionIndex;
      if (isCorrect) correct++;
      return {
        ...q,
        selectedOptionIndex: Number.isFinite(selected) ? selected : undefined,
        isCorrect
      };
    });
    const score = Math.round((correct / row.questions.length) * 100);
    await ctx.db.patch(args.refresherQuizIdRef, {
      questions: updatedQuestions,
      status: "completed",
      score,
      completedAt: Date.now()
    });
    return { _id: args.refresherQuizIdRef, score };
  }
});

export const getCandidateLearningOverview = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentCandidate(ctx);
    const skillRows: any[] = await ctx.db
      .query("skillAssessments")
      .withIndex("by_candidate", (q) => q.eq("candidateIdRef", user._id))
      .collect();
    const completedRows = skillRows.filter(
      (r) => r.status === "completed" && r.learningPlan
    );
    const milestones: any[] = await ctx.db
      .query("learningProgress")
      .withIndex("by_candidate", (q) => q.eq("candidateIdRef", user._id))
      .collect();
    const milestonesBySkill: Record<string, any[]> = {};
    for (const m of milestones) {
      const k = String(m.skillAssessmentIdRef);
      milestonesBySkill[k] = milestonesBySkill[k] || [];
      milestonesBySkill[k].push(m);
    }
    const refreshers: any[] = await ctx.db
      .query("refresherQuizzes")
      .withIndex("by_candidate", (q) => q.eq("candidateIdRef", user._id))
      .collect();
    const refreshersBySkill: Record<string, any[]> = {};
    for (const r of refreshers) {
      const k = String(r.skillAssessmentIdRef);
      refreshersBySkill[k] = refreshersBySkill[k] || [];
      refreshersBySkill[k].push(r);
    }

    const urls = new Set<string>();
    for (const row of completedRows) {
      const resources = row?.learningPlan?.resources || [];
      for (const r of resources) {
        if (typeof r?.link === "string" && r.link) urls.add(r.link);
      }
    }
    const healthRows: any[] = [];
    for (const url of urls) {
      const h = await ctx.db
        .query("resourceHealth")
        .withIndex("by_url", (q) => q.eq("url", url))
        .first();
      if (h) healthRows.push(h);
    }
    const healthByUrl: Record<string, any> = {};
    for (const h of healthRows) healthByUrl[h.url] = h;

    return {
      skillAssessments: completedRows.map((r) => ({
        _id: r._id,
        skill: r.skill,
        skillScore: r.skillScore ?? null,
        conclusion: r.conclusion || null,
        learningPlan: r.learningPlan,
        completedAt: r.completedAt ?? null,
        milestones: milestonesBySkill[String(r._id)] || [],
        refreshers: refreshersBySkill[String(r._id)] || []
      })),
      resourceHealth: healthByUrl
    };
  }
});

function levelRank(level: string) {
  const map: Record<string, number> = {
    beginner: 0,
    foundational: 1,
    intermediate: 2,
    advanced: 3,
    expert: 4
  };
  return map[String(level || "").toLowerCase()] ?? -1;
}

export const getRecommendedJobs = query({
  args: { minScore: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await getCurrentCandidate(ctx);
    const minScore = Number.isFinite(Number(args.minScore))
      ? Math.max(0, Math.min(100, Number(args.minScore)))
      : 70;

    const skillRows: any[] = await ctx.db
      .query("skillAssessments")
      .withIndex("by_candidate", (q) => q.eq("candidateIdRef", user._id))
      .collect();
    const refreshers: any[] = await ctx.db
      .query("refresherQuizzes")
      .withIndex("by_candidate", (q) => q.eq("candidateIdRef", user._id))
      .collect();

    type SkillState = {
      skillScore: number | null;
      refresherScore: number | null;
      currentLevel: string | null;
      targetLevel: string | null;
      hitTarget: boolean;
    };
    const stateBySkill = new Map<string, SkillState>();
    for (const row of skillRows) {
      if (row.status !== "completed") continue;
      const skill = String(row.skill || "").toLowerCase();
      if (!skill) continue;
      const refresherForRow = refreshers
        .filter((r) => String(r.skillAssessmentIdRef) === String(row._id) && r.status === "completed")
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))[0];
      const refresherScore = refresherForRow?.score ?? null;
      const currentLevel = row?.learningPlan?.currentLevel || null;
      const targetLevel = row?.learningPlan?.targetLevel || null;
      const hitTarget =
        (typeof row.skillScore === "number" && row.skillScore >= minScore) ||
        (typeof refresherScore === "number" && refresherScore >= minScore) ||
        (currentLevel && targetLevel && levelRank(currentLevel) >= levelRank(targetLevel));
      stateBySkill.set(skill, {
        skillScore: row.skillScore ?? null,
        refresherScore,
        currentLevel,
        targetLevel,
        hitTarget: Boolean(hitTarget)
      });
    }

    const myApplications = await ctx.db
      .query("applications")
      .withIndex("by_candidate", (q) => q.eq("candidateIdRef", user._id))
      .collect();
    const appliedJobIds = new Set(myApplications.map((a: any) => String(a.jobIdRef)));

    const openJobs = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();

    const recommendations = openJobs
      .filter((j: any) => !appliedJobIds.has(String(j._id)))
      .map((j: any) => {
        const reqs: string[] = Array.isArray(j.requiredSkills) ? j.requiredSkills : [];
        if (!reqs.length) return null;
        let metCount = 0;
        const met: string[] = [];
        const gap: string[] = [];
        for (const req of reqs) {
          const k = req.toLowerCase();
          const state = stateBySkill.get(k);
          if (state?.hitTarget) {
            metCount++;
            met.push(req);
          } else {
            gap.push(req);
          }
        }
        if (!metCount) return null;
        const matchPct = Math.round((metCount / reqs.length) * 100);
        return {
          job: {
            _id: j._id,
            jobId: j.jobId,
            title: j.title,
            description: j.description,
            requiredSkills: reqs
          },
          matchPct,
          metSkills: met,
          gapSkills: gap
        };
      })
      .filter(Boolean) as any[];

    recommendations.sort((a, b) => b.matchPct - a.matchPct);
    return recommendations.slice(0, 10);
  }
});

export const _listAllResourceLinks = query({
  args: {},
  handler: async (ctx) => {
    const rows: any[] = await ctx.db.query("skillAssessments").collect();
    const urls = new Set<string>();
    for (const row of rows) {
      const resources = row?.learningPlan?.resources || [];
      for (const r of resources) {
        if (typeof r?.link === "string" && r.link.startsWith("https://")) urls.add(r.link);
      }
    }
    return Array.from(urls);
  }
});

export const _upsertResourceHealth = mutation({
  args: {
    url: v.string(),
    status: v.union(v.literal("ok"), v.literal("broken"), v.literal("unknown")),
    httpStatus: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const existing: any = await ctx.db
      .query("resourceHealth")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .first();
    const now = Date.now();
    const failureCount =
      args.status === "broken" ? (existing?.failureCount || 0) + 1 : 0;
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        httpStatus: args.httpStatus,
        lastCheckedAt: now,
        failureCount
      });
      return existing._id;
    }
    return ctx.db.insert("resourceHealth", {
      url: args.url,
      status: args.status,
      httpStatus: args.httpStatus,
      lastCheckedAt: now,
      failureCount
    });
  }
});

async function checkUrl(url: string, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal
    });
    if (!response.ok || response.status >= 400) {
      response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { Range: "bytes=0-512" }
      });
    }
    return {
      ok: response.status < 400,
      status: response.status as number | undefined
    };
  } catch (_e) {
    return { ok: false, status: undefined };
  } finally {
    clearTimeout(timer);
  }
}

async function runResourceValidation(
  ctx: any,
  limit: number
): Promise<{ checked: number; ok: number; broken: number }> {
  const urls: string[] = await ctx.runQuery(api.learning._listAllResourceLinks, {});
  const subset = urls.slice(0, limit);
  let ok = 0;
  let broken = 0;
  for (const url of subset) {
    const result = await checkUrl(url);
    const status: "ok" | "broken" = result.ok ? "ok" : "broken";
    if (result.ok) ok++;
    else broken++;
    try {
      await ctx.runMutation(api.learning._upsertResourceHealth, {
        url,
        status,
        httpStatus: result.status
      });
    } catch (e: any) {
      console.warn("upsertResourceHealth failed for", url, e?.message || e);
    }
  }
  return { checked: subset.length, ok, broken };
}

export const validateResourceLinks = action({
  args: { limit: v.optional(v.number()) },
  handler: async (
    ctx,
    args
  ): Promise<{ checked: number; ok: number; broken: number }> => {
    await requireAdmin(ctx);
    const limit = Math.max(1, Math.min(200, Number(args.limit) || 100));
    return runResourceValidation(ctx, limit);
  }
});

export const validateResourceLinksInternal = internalAction({
  args: {},
  handler: async (ctx): Promise<{ checked: number; ok: number; broken: number }> => {
    return runResourceValidation(ctx, 100);
  }
});
