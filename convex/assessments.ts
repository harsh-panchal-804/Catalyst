import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { requireUser } from "./auth";
import { callHfJson } from "./llm";

function buildQuestionBatchSystemPrompt() {
  return `
You design a 7-question interview for ONE skill, returned in a single response.

Return STRICT JSON only — no markdown, no commentary.

Top-level shape:
{
  "questions": [Q1, Q2, Q3, Q4, Q5, Q6, Q7]
}

Strict order and kinds (positional):
- questions[0..2] -> kind="mcq"  (3 multiple-choice)
- questions[3..5] -> kind="descriptive"  (3 short-answer)
- questions[6]    -> kind="coding"  (1 coding problem)

Each question shape:
MCQ:
{
  "kind": "mcq",
  "prompt": "string",
  "options": ["A","B","C","D"],
  "correctOptionIndex": 0
}

Descriptive (short text):
{
  "kind": "descriptive",
  "prompt": "string"
}

Coding:
{
  "kind": "coding",
  "prompt": "string (problem, inputs/outputs, examples, constraints)",
  "language": "javascript|typescript|python|java|cpp|go",
  "boilerplate": "// starter code with function signature and TODO"
}

Hard rules — violating any of these is unacceptable:
1. UNIQUENESS: Every prompt MUST be distinctly different from the other 6. No repeats, no near-duplicates, no rewording the same question.
2. COVERAGE: The 7 prompts together must cover DIFFERENT subtopics of the skill (e.g. for React: hooks, rendering, state, effects, performance, ecosystem). No two questions on the same subtopic.
3. DIFFICULTY: Increase progressively across positions 0->6 — easy -> medium -> hard.
4. MCQs must have exactly 4 distinct options and one correctOptionIndex in [0,3].
5. The coding boilerplate must compile/parse, define the function/class signature, include a TODO, and stay under ~30 lines.
6. Calibrate questions to the candidate's resumeText and the jobDescription provided in the user message.
`.trim();
}

const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  javascript: "javascript",
  node: "javascript",
  nodejs: "javascript",
  ts: "typescript",
  typescript: "typescript",
  py: "python",
  python: "python",
  python3: "python",
  java: "java",
  cpp: "cpp",
  "c++": "cpp",
  cxx: "cpp",
  go: "go",
  golang: "go"
};

function defaultBoilerplate(language: string, skill: string): string {
  const fnName = "solve";
  const note = `// TODO: implement using ${skill}`;
  switch (language) {
    case "typescript":
      return `function ${fnName}(input: any): any {\n  ${note}\n  return null;\n}`;
    case "python":
      return `def ${fnName}(input):\n    ${note}\n    return None\n`;
    case "java":
      return `public class Solution {\n  public static Object ${fnName}(Object input) {\n    ${note}\n    return null;\n  }\n}`;
    case "cpp":
      return `#include <bits/stdc++.h>\nusing namespace std;\n\nint ${fnName}(int input) {\n  ${note}\n  return 0;\n}`;
    case "go":
      return `package main\n\nfunc ${fnName}(input int) int {\n  ${note}\n  return 0\n}`;
    case "javascript":
    default:
      return `function ${fnName}(input) {\n  ${note}\n  return null;\n}`;
  }
}

function normalizeQuestion(
  q: any,
  expectedKind: "mcq" | "descriptive" | "coding",
  skill: string
): any | null {
  if (!q || typeof q !== "object") return null;
  const promptText = String(q.prompt || q.question || "").trim();
  if (!promptText) return null;
  const rawKind = String(q.kind || "").trim().toLowerCase();
  // For descriptive/coding, allow the kind to be missing or wrong as long as
  // the rest of the payload is shaped right — we already know what kind we asked for.
  if (expectedKind === "mcq") {
    if (rawKind && rawKind !== "mcq") return null;
    let options = Array.isArray(q.options) ? q.options.map((x: any) => String(x)) : [];
    if (options.length === 3) options.push("None of the above");
    if (options.length === 5) options = options.slice(0, 4);
    if (options.length !== 4) return null;
    let idx = Number(q.correctOptionIndex ?? q.correct ?? 0);
    if (!Number.isFinite(idx)) idx = 0;
    idx = Math.max(0, Math.min(3, Math.round(idx)));
    return { kind: "mcq", prompt: promptText, options, correctOptionIndex: idx };
  }
  if (expectedKind === "descriptive") {
    return { kind: "descriptive", prompt: promptText };
  }
  // coding
  const langRaw = String(q.language || q.lang || "javascript").trim().toLowerCase();
  const language =
    LANGUAGE_ALIASES[langRaw] ||
    (Object.values(LANGUAGE_ALIASES).includes(langRaw) ? langRaw : null);
  if (!language) return null;
  const boilerRaw = String(q.boilerplate || q.starter || q.template || "");
  const boilerplate = boilerRaw.trim() ? boilerRaw : defaultBoilerplate(language, skill);
  return { kind: "coding", prompt: promptText, language, boilerplate };
}

function sanitizeResources(resources: any[]): any[] {
  if (!Array.isArray(resources)) return [];
  return resources
    .map((r: any) => {
      const title = String(r?.title || "").trim();
      const type = String(r?.type || "Resource").trim() || "Resource";
      if (!title) return null;
      // Intentionally drop any LLM-generated URL — the client derives a safe
      // canonical or web-search link from (title, type, skill) at render time.
      return { title: title.slice(0, 200), type: type.slice(0, 50) };
    })
    .filter(Boolean) as any[];
}

function buildGradeSystemPrompt() {
  return `
You are grading a candidate answer for ONE skill.
Return STRICT JSON only.

Scoring:
- score: number 0-100
- feedback: 1-3 short sentences

For coding answers (kind="coding"), evaluate:
- correctness against the stated problem
- handling of edge cases
- time/space complexity vs. expected
- code clarity and idiomatic style for the chosen language

Timing context:
- questionTiming may include startedAt, submittedAt, and timeTakenSeconds.
- Use timing as a weak signal only. Do NOT over-penalize slow answers if the answer quality is strong.
- Very fast + very weak answers can slightly reduce confidence.

If questionNumber == 7, also return:
- skillScore: number 0-100 (overall for the skill across all 7 questions)
- conclusion: concise conclusion for this skill
- learningPlan: a curated plan to improve THIS skill with the following shape:

{
  "currentLevel": "Beginner|Foundational|Intermediate|Advanced|Expert",
  "targetLevel": "Foundational|Intermediate|Advanced|Expert",
  "priority": "High|Medium|Low",
  "estimatedHours": number,
  "timelineWeeks": number,
  "focusAreas": ["string"],
  "adjacentSkills": ["string"],
  "resources": [{"title":"string","type":"Documentation|Course|Project|Book|Practice"}],
  "weeklyMilestones": ["Week 1: ...", "Week 2: ..."]
}

Resource policy (CRITICAL):
- Each resource MUST have ONLY a "title" and a "type". Do NOT output a "link" field.
  The application maps (title, type, skill) to a canonical safe URL on its own.
  Inventing URLs leads to broken 404 links — never include them.
- title: short, specific, descriptive (e.g., "Official React Tutorial",
  "Effective Python — Brett Slatkin", "Advent of Code – Day 1: Two Sum").
- type: one of Documentation | Course | Project | Book | Practice.
- Aim for 3-6 high-signal resources, sorted by recommended order.

Output JSON:
{
  "score": 0,
  "feedback": "string",
  "skillScore": 0,
  "conclusion": "string",
  "learningPlan": { ... }
}
Do not include markdown.
`.trim();
}

export const startAssessment = mutation({
  args: {
    applicationIdRef: v.id("applications")
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const now = Date.now();
    const session = await ctx.db
      .query("assessmentSessions")
      .withIndex("by_application", (q) => q.eq("applicationIdRef", args.applicationIdRef))
      .first();
    if (session) return session._id;

    await ctx.db.patch(args.applicationIdRef, { assessmentStatus: "in_progress" });
    return ctx.db.insert("assessmentSessions", {
      applicationIdRef: args.applicationIdRef,
      startedAt: now,
      lastQuestionAt: now,
      status: "in_progress"
    });
  }
});

export const addMessage = mutation({
  args: {
    sessionIdRef: v.id("assessmentSessions"),
    skill: v.string(),
    role: v.union(v.literal("assistant"), v.literal("user")),
    text: v.string()
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    await ctx.db.patch(args.sessionIdRef, { lastQuestionAt: Date.now() });
    return ctx.db.insert("assessmentMessages", {
      ...args,
      createdAt: Date.now()
    });
  }
});

export const getSessionMessages = query({
  args: {
    sessionIdRef: v.id("assessmentSessions"),
    skill: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    if (args.skill) {
      return ctx.db
        .query("assessmentMessages")
        .withIndex("by_session_skill", (q) =>
          q.eq("sessionIdRef", args.sessionIdRef).eq("skill", args.skill!)
        )
        .collect();
    }
    return ctx.db
      .query("assessmentMessages")
      .withIndex("by_session", (q) => q.eq("sessionIdRef", args.sessionIdRef))
      .collect();
  }
});

export const storeResult = mutation({
  args: {
    applicationIdRef: v.id("applications"),
    jobIdRef: v.id("jobs"),
    candidateIdRef: v.id("users"),
    baseScore: v.number(),
    finalScore: v.number(),
    companySignal: v.optional(v.string()),
    recommendation: v.string()
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    await ctx.db.patch(args.applicationIdRef, { assessmentStatus: "completed" });
    return ctx.db.insert("assessmentResults", {
      ...args,
      completedAt: Date.now()
    });
  }
});

export const startSkillAssessment = mutation({
  args: {
    applicationIdRef: v.id("applications"),
    skill: v.string()
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const app = await ctx.db.get(args.applicationIdRef);
    if (!app) throw new Error("Application not found");

    const job = await ctx.db.get(app.jobIdRef);
    if (!job) throw new Error("Job not found for application");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", me.clerkUserId))
      .first();
    if (!user) throw new Error("User record not found. Call users.upsertMe first.");

    const normalizedSkill = args.skill.trim();
    if (!normalizedSkill) throw new Error("skill is required");

    const existing = await ctx.db
      .query("skillAssessments")
      .withIndex("by_application_skill", (q) =>
        q.eq("applicationIdRef", args.applicationIdRef).eq("skill", normalizedSkill)
      )
      .first();
    if (existing) return existing._id;

    const now = Date.now();
    return ctx.db.insert("skillAssessments", {
      applicationIdRef: args.applicationIdRef,
      jobIdRef: app.jobIdRef,
      candidateIdRef: user._id,
      skill: normalizedSkill,
      status: "in_progress",
      questionIndex: 0,
      questions: [],
      createdAt: now,
      updatedAt: now
    });
  }
});

export const getSkillAssessment = query({
  args: {
    applicationIdRef: v.id("applications"),
    skill: v.string()
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const row = await ctx.db
      .query("skillAssessments")
      .withIndex("by_application_skill", (q) =>
        q.eq("applicationIdRef", args.applicationIdRef).eq("skill", args.skill.trim())
      )
      .first();
    return row || null;
  }
});

export const listSkillAssessmentsForApplication = query({
  args: {
    applicationIdRef: v.id("applications")
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", me.clerkUserId))
      .first();
    if (!user) return [];
    const app: any = await ctx.db.get(args.applicationIdRef);
    if (!app || app.candidateIdRef !== user._id) throw new Error("Forbidden");
    return ctx.db
      .query("skillAssessments")
      .withIndex("by_application", (q) => q.eq("applicationIdRef", args.applicationIdRef))
      .collect();
  }
});

export const getSkillAnswerDraft = query({
  args: {
    skillAssessmentIdRef: v.id("skillAssessments"),
    questionIndex: v.number()
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", me.clerkUserId))
      .first();
    if (!user) return null;
    const row: any = await ctx.db.get(args.skillAssessmentIdRef);
    if (!row || row.candidateIdRef !== user._id) throw new Error("Forbidden");
    const draft = await ctx.db
      .query("skillAnswerDrafts")
      .withIndex("by_skill_assessment_question", (q) =>
        q.eq("skillAssessmentIdRef", args.skillAssessmentIdRef).eq("questionIndex", args.questionIndex)
      )
      .first();
    return draft || null;
  }
});

export const upsertSkillAnswerDraft = mutation({
  args: {
    skillAssessmentIdRef: v.id("skillAssessments"),
    questionIndex: v.number(),
    kind: v.union(v.literal("mcq"), v.literal("descriptive"), v.literal("coding")),
    answerText: v.optional(v.string()),
    selectedOptionIndex: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", me.clerkUserId))
      .first();
    if (!user) throw new Error("User record not found");
    const row: any = await ctx.db.get(args.skillAssessmentIdRef);
    if (!row || row.candidateIdRef !== user._id) throw new Error("Forbidden");
    if (args.questionIndex < 0 || args.questionIndex > 6) throw new Error("Invalid questionIndex");

    const answerText = typeof args.answerText === "string" ? args.answerText : "";
    const hasSelection = Number.isFinite(args.selectedOptionIndex as number);
    const hasText = answerText.length > 0;

    const existing = await ctx.db
      .query("skillAnswerDrafts")
      .withIndex("by_skill_assessment_question", (q) =>
        q.eq("skillAssessmentIdRef", args.skillAssessmentIdRef).eq("questionIndex", args.questionIndex)
      )
      .first();

    if (!hasSelection && !hasText) {
      if (existing) await ctx.db.delete(existing._id);
      return null;
    }

    const payload: any = {
      skillAssessmentIdRef: args.skillAssessmentIdRef,
      questionIndex: args.questionIndex,
      kind: args.kind,
      updatedAt: Date.now()
    };
    if (hasText) payload.answerText = answerText;
    if (hasSelection) payload.selectedOptionIndex = Number(args.selectedOptionIndex);

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return ctx.db.insert("skillAnswerDrafts", payload);
  }
});

export const _deleteSkillAnswerDraft = mutation({
  args: {
    skillAssessmentIdRef: v.id("skillAssessments"),
    questionIndex: v.number()
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", me.clerkUserId))
      .first();
    if (!user) throw new Error("User record not found");
    const row: any = await ctx.db.get(args.skillAssessmentIdRef);
    if (!row || row.candidateIdRef !== user._id) throw new Error("Forbidden");
    const existing = await ctx.db
      .query("skillAnswerDrafts")
      .withIndex("by_skill_assessment_question", (q) =>
        q.eq("skillAssessmentIdRef", args.skillAssessmentIdRef).eq("questionIndex", args.questionIndex)
      )
      .first();
    if (existing) await ctx.db.delete(existing._id);
    return null;
  }
});

export const markQuestionStarted = mutation({
  args: {
    skillAssessmentIdRef: v.id("skillAssessments"),
    questionIndex: v.number()
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", me.clerkUserId))
      .first();
    if (!user) throw new Error("User record not found");
    const row: any = await ctx.db.get(args.skillAssessmentIdRef);
    if (!row || row.candidateIdRef !== user._id) throw new Error("Forbidden");
    if (!Array.isArray(row.questions) || args.questionIndex < 0 || args.questionIndex >= row.questions.length) {
      throw new Error("Invalid question index");
    }
    const current = row.questions[args.questionIndex];
    if (current.startedAt) return current.startedAt;
    const nextQuestions = [...row.questions];
    nextQuestions[args.questionIndex] = {
      ...current,
      startedAt: Date.now()
    };
    await ctx.db.patch(args.skillAssessmentIdRef, {
      questions: nextQuestions,
      updatedAt: Date.now()
    });
    return nextQuestions[args.questionIndex].startedAt;
  }
});

export const _getSkillAssessmentContext = query({
  args: {
    skillAssessmentId: v.id("skillAssessments")
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const row: any = await ctx.db.get(args.skillAssessmentId);
    if (!row) return null;
    const app: any = await ctx.db.get(row.applicationIdRef);
    const job: any = app ? await ctx.db.get(app.jobIdRef) : null;
    return { row, app, job };
  }
});

export const _setSkillQuestions = mutation({
  args: {
    skillAssessmentId: v.id("skillAssessments"),
    questions: v.array(
      v.object({
        kind: v.union(
          v.literal("mcq"),
          v.literal("descriptive"),
          v.literal("coding")
        ),
        prompt: v.string(),
        options: v.optional(v.array(v.string())),
        correctOptionIndex: v.optional(v.number()),
        language: v.optional(v.string()),
        boilerplate: v.optional(v.string())
      })
    )
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    await ctx.db.patch(args.skillAssessmentId, {
      questions: args.questions,
      questionIndex: 0,
      status: "in_progress",
      updatedAt: Date.now()
    });
    return args.skillAssessmentId;
  }
});

export const _getSubmitContext = query({
  args: {
    applicationIdRef: v.id("applications"),
    skill: v.string()
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", me.clerkUserId))
      .first();
    if (!user) return null;

    const app: any = await ctx.db.get(args.applicationIdRef);
    if (!app) return null;
    if (app.candidateIdRef !== user._id) throw new Error("Forbidden");

    const job: any = await ctx.db.get(app.jobIdRef);
    if (!job) return null;

    const row: any = await ctx.db
      .query("skillAssessments")
      .withIndex("by_application_skill", (q) =>
        q.eq("applicationIdRef", args.applicationIdRef).eq("skill", args.skill.trim())
      )
      .first();

    return { user, app, job, row };
  }
});

export const _commitAnswer = mutation({
  args: {
    skillAssessmentId: v.id("skillAssessments"),
    applicationIdRef: v.id("applications"),
    candidateIdRef: v.id("users"),
    jobIdRef: v.id("jobs"),
    questions: v.array(
      v.object({
        kind: v.union(
          v.literal("mcq"),
          v.literal("descriptive"),
          v.literal("coding")
        ),
        prompt: v.string(),
        options: v.optional(v.array(v.string())),
        correctOptionIndex: v.optional(v.number()),
        language: v.optional(v.string()),
        boilerplate: v.optional(v.string()),
        answerText: v.optional(v.string()),
        selectedOptionIndex: v.optional(v.number()),
        startedAt: v.optional(v.number()),
        submittedAt: v.optional(v.number()),
        timeTakenSeconds: v.optional(v.number()),
        score: v.optional(v.number()),
        feedback: v.optional(v.string())
      })
    ),
    nextIndex: v.number(),
    completedSkill: v.boolean(),
    skillScore: v.optional(v.number()),
    conclusion: v.optional(v.string()),
    learningPlan: v.optional(
      v.object({
        currentLevel: v.string(),
        targetLevel: v.string(),
        priority: v.union(v.literal("High"), v.literal("Medium"), v.literal("Low")),
        estimatedHours: v.number(),
        timelineWeeks: v.number(),
        focusAreas: v.array(v.string()),
        adjacentSkills: v.array(v.string()),
        resources: v.array(
          v.object({
            title: v.string(),
            type: v.string(),
            link: v.optional(v.string())
          })
        ),
        weeklyMilestones: v.array(v.string())
      })
    ),
    requiredSkills: v.array(v.string())
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const now = Date.now();

    const patch: any = {
      questions: args.questions,
      questionIndex: Math.min(7, args.nextIndex),
      updatedAt: now
    };
    if (args.completedSkill) {
      patch.status = "completed";
      patch.skillScore = args.skillScore;
      patch.conclusion = args.conclusion;
      patch.learningPlan = args.learningPlan;
      patch.completedAt = now;
    }
    await ctx.db.patch(args.skillAssessmentId, patch);

    if (!args.completedSkill) {
      return { status: "in_progress" as const };
    }

    const allRows = await ctx.db
      .query("skillAssessments")
      .withIndex("by_candidate_job", (q) =>
        q.eq("candidateIdRef", args.candidateIdRef).eq("jobIdRef", args.jobIdRef)
      )
      .collect();
    const bySkill = new Map(allRows.map((r: any) => [r.skill, r]));
    const allDone = args.requiredSkills.every((s) => {
      const r: any = bySkill.get(s);
      return r && r.status === "completed" && Number.isFinite(r.skillScore);
    });

    if (allDone && args.requiredSkills.length) {
      const total = args.requiredSkills.reduce((acc, s) => acc + Number((bySkill.get(s) as any).skillScore), 0);
      const overall = Math.round(total / args.requiredSkills.length);
      const recommendation = overall >= 80 ? "Strong match" : overall >= 65 ? "Potential match" : "Needs upskilling";

      const existingResult = await ctx.db
        .query("assessmentResults")
        .withIndex("by_application", (q) => q.eq("applicationIdRef", args.applicationIdRef))
        .first();

      await ctx.db.patch(args.applicationIdRef, { assessmentStatus: "completed" });
      if (existingResult) {
        await ctx.db.patch(existingResult._id, {
          baseScore: overall,
          finalScore: overall,
          recommendation,
          completedAt: now
        });
      } else {
        await ctx.db.insert("assessmentResults", {
          applicationIdRef: args.applicationIdRef,
          jobIdRef: args.jobIdRef,
          candidateIdRef: args.candidateIdRef,
          baseScore: overall,
          finalScore: overall,
          recommendation,
          completedAt: now
        });
      }
      return { status: "completed" as const, overall };
    }

    await ctx.db.patch(args.applicationIdRef, { assessmentStatus: "in_progress" });
    return { status: "skill_completed" as const };
  }
});

export const initializeSkillQuestions = action({
  args: {
    skillAssessmentId: v.id("skillAssessments")
  },
  handler: async (ctx, args) => {
    const ctxData: any = await ctx.runQuery(api.assessments._getSkillAssessmentContext, {
      skillAssessmentId: args.skillAssessmentId
    });
    if (!ctxData?.row) throw new Error("Skill assessment not found");
    if (ctxData.row.status === "completed") {
      return ctxData.row._id;
    }
    if (Array.isArray(ctxData.row.questions) && ctxData.row.questions.length === 7) {
      return ctxData.row._id;
    }
    if (!ctxData.app) throw new Error("Application not found");
    if (!ctxData.job) throw new Error("Job not found");

    const systemPrompt = buildQuestionBatchSystemPrompt();
    const expectedKinds: Array<"mcq" | "descriptive" | "coding"> = [
      "mcq",
      "mcq",
      "mcq",
      "descriptive",
      "descriptive",
      "descriptive",
      "coding"
    ];

    async function generateBatch(extraNote?: string) {
      const raw: any = await callHfJson({
        systemPrompt,
        userPrompt: {
          task: "Generate all 7 unique questions for this single skill in one response.",
          jobDescription: ctxData.job.description,
          resumeText: ctxData.app.resumeTextSnapshot,
          skill: ctxData.row.skill,
          ...(extraNote ? { regenerationNote: extraNote } : {})
        },
        // 7 questions including a coding boilerplate need more headroom than
        // the default 1500-token cap.
        maxTokens: 3500
      });
      return Array.isArray(raw?.questions)
        ? raw.questions
        : Array.isArray(raw)
          ? raw
          : null;
    }

    function normalizeAndDedupe(arr: any[] | null): any[] | null {
      if (!Array.isArray(arr) || arr.length < 7) return null;
      const out: any[] = [];
      const seen = new Set<string>();
      for (let i = 0; i < 7; i++) {
        const norm = normalizeQuestion(arr[i], expectedKinds[i], ctxData.row.skill);
        if (!norm) return null;
        const fingerprint = String(norm.prompt || "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 160);
        if (!fingerprint || seen.has(fingerprint)) return null;
        seen.add(fingerprint);
        out.push(norm);
      }
      return out;
    }

    let batch = await generateBatch();
    let questions = normalizeAndDedupe(batch);
    if (!questions) {
      // One corrective retry — the model usually drops a coding boilerplate or
      // repeats a prompt the first time around.
      batch = await generateBatch(
        "Your previous response was rejected. Make sure: exactly 7 entries; positions 0..2 are MCQs, 3..5 descriptive, 6 coding; every prompt is unique and on a different subtopic; coding has language + boilerplate."
      );
      questions = normalizeAndDedupe(batch);
    }
    if (!questions) {
      throw new Error(
        `LLM did not return 7 unique valid questions for skill "${ctxData.row.skill}" after retry. Got ${
          Array.isArray(batch) ? batch.length : 0
        } entries.`
      );
    }

    await ctx.runMutation(api.assessments._setSkillQuestions, {
      skillAssessmentId: args.skillAssessmentId,
      questions
    });
    return args.skillAssessmentId;
  }
});

export const submitSkillAnswer = action({
  args: {
    applicationIdRef: v.id("applications"),
    skill: v.string(),
    answerText: v.optional(v.string()),
    selectedOptionIndex: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const skill = args.skill.trim();
    if (!skill) throw new Error("skill is required");

    const ctxData: any = await ctx.runQuery(api.assessments._getSubmitContext, {
      applicationIdRef: args.applicationIdRef,
      skill
    });
    if (!ctxData) throw new Error("Submit context unavailable");
    const { user, app, job, row } = ctxData;
    if (!row) throw new Error("Skill assessment not started");
    if (!Array.isArray(row.questions) || row.questions.length !== 7) {
      throw new Error("Skill questions not initialized");
    }
    if (row.status === "completed") {
      return { status: "completed", skillAssessmentId: row._id };
    }

    const idx = Number(row.questionIndex) || 0;
    if (idx < 0 || idx > 6) throw new Error("Invalid question index");

    const current = row.questions[idx];
    if (current.kind === "mcq") {
      const sel = Number(args.selectedOptionIndex);
      if (!Number.isFinite(sel) || sel < 0 || sel > 3) throw new Error("selectedOptionIndex must be 0-3");
    } else if (!(args.answerText || "").trim()) {
      throw new Error("answerText is required");
    }

    const submittedAt = Date.now();
    const startedAt =
      typeof current.startedAt === "number" && Number.isFinite(current.startedAt)
        ? Number(current.startedAt)
        : submittedAt;
    const timeTakenSeconds = Math.max(0, Math.round((submittedAt - startedAt) / 1000));

    const answer =
      current.kind === "mcq"
        ? { selectedOptionIndex: Number(args.selectedOptionIndex) }
        : { answerText: (args.answerText || "").trim() };

    const priorSkillQA = row.questions
      .map((q: any, i: number) => {
        if (i >= idx) return null;
        const a =
          q.kind === "mcq"
            ? { selectedOptionIndex: q.selectedOptionIndex }
            : { answerText: q.answerText };
        if (q.selectedOptionIndex === undefined && !q.answerText) return null;
        return {
          questionNumber: i + 1,
          question: q,
          answer: a,
          timing: {
            startedAt: q.startedAt,
            submittedAt: q.submittedAt,
            timeTakenSeconds: q.timeTakenSeconds
          },
          score: q.score,
          feedback: q.feedback
        };
      })
      .filter(Boolean);

    const grade = await callHfJson({
      systemPrompt: buildGradeSystemPrompt(),
      userPrompt: {
        task: "Grade a single answer for a single skill.",
        jobDescription: job.description,
        resumeText: app.resumeTextSnapshot,
        skill,
        questionNumber: idx + 1,
        question: current,
        answer,
        questionTiming: {
          startedAt,
          submittedAt,
          timeTakenSeconds
        },
        priorSkillQA
      }
    });

    const score = Number(grade.score);
    if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error("Invalid grade score");
    const feedback = String(grade.feedback || "").trim();
    if (!feedback) throw new Error("Invalid grade feedback");

    const nextQuestions = [...row.questions];
    nextQuestions[idx] = {
      ...current,
      ...(current.kind === "mcq"
        ? { selectedOptionIndex: Number(args.selectedOptionIndex) }
        : { answerText: (args.answerText || "").trim() }),
      startedAt,
      submittedAt,
      timeTakenSeconds,
      score,
      feedback
    };

    const nextIndex = idx + 1;
    let completedSkill = false;
    let skillScore: number | undefined;
    let conclusion: string | undefined;
    let learningPlan: any | undefined;

    if (nextIndex >= 7) {
      const ss = Number(grade.skillScore);
      const c = String(grade.conclusion || "").trim();
      if (!Number.isFinite(ss) || ss < 0 || ss > 100) throw new Error("Invalid final skillScore");
      if (!c) throw new Error("Invalid final conclusion");
      const lp = grade.learningPlan;
      if (
        !lp ||
        typeof lp !== "object" ||
        typeof lp.currentLevel !== "string" ||
        typeof lp.targetLevel !== "string" ||
        !["High", "Medium", "Low"].includes(lp.priority) ||
        !Number.isFinite(Number(lp.estimatedHours)) ||
        !Number.isFinite(Number(lp.timelineWeeks)) ||
        !Array.isArray(lp.focusAreas) ||
        !Array.isArray(lp.adjacentSkills) ||
        !Array.isArray(lp.resources) ||
        !Array.isArray(lp.weeklyMilestones)
      ) {
        throw new Error("Invalid learningPlan from LLM.");
      }
      completedSkill = true;
      skillScore = ss;
      conclusion = c;
      learningPlan = {
        currentLevel: String(lp.currentLevel),
        targetLevel: String(lp.targetLevel),
        priority: lp.priority,
        estimatedHours: Number(lp.estimatedHours),
        timelineWeeks: Number(lp.timelineWeeks),
        focusAreas: lp.focusAreas.map((x: any) => String(x)),
        adjacentSkills: lp.adjacentSkills.map((x: any) => String(x)),
        resources: sanitizeResources(lp.resources),
        weeklyMilestones: lp.weeklyMilestones.map((x: any) => String(x))
      };
    }

    const result = await ctx.runMutation(api.assessments._commitAnswer, {
      skillAssessmentId: row._id,
      applicationIdRef: args.applicationIdRef,
      candidateIdRef: user._id,
      jobIdRef: job._id,
      questions: nextQuestions,
      nextIndex,
      completedSkill,
      skillScore,
      conclusion,
      learningPlan,
      requiredSkills: Array.isArray(job.requiredSkills) ? job.requiredSkills : []
    });

    await ctx.runMutation(api.assessments._deleteSkillAnswerDraft, {
      skillAssessmentIdRef: row._id,
      questionIndex: idx
    });

    return { status: result.status, skillAssessmentId: row._id };
  }
});
