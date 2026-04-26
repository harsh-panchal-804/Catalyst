import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { requireAdmin, requireUser } from "./auth";
import { callHfJson, embedText } from "./llm";

function buildResumeStructureSystemPrompt() {
  return `
You parse a candidate's resume into structured JSON.
Return STRICT JSON only. Do not include markdown.

Output shape:
{
  "skills": ["string"],
  "experiences": [
    {
      "title": "string",
      "company": "string",
      "startDate": "string (free-form, e.g. 'Jan 2022' or '2022')",
      "endDate": "string ('Present' allowed)",
      "durationMonths": number,
      "description": "string (1-2 sentences max)"
    }
  ],
  "education": [
    {
      "degree": "string",
      "institution": "string",
      "field": "string",
      "year": "string"
    }
  ],
  "yearsOfExperience": number,
  "summary": "string (2-3 sentences professional summary)"
}

Rules:
- Use only information present in the resume. Do not invent.
- Skills MUST be canonical short tokens (e.g. "React", "TypeScript", "AWS", "PostgreSQL").
  Avoid full sentences. Cap at 30 skills, deduplicate case-insensitively.
- experiences ordered most recent first, cap at 8 entries.
- education cap at 4 entries.
- yearsOfExperience: total professional experience in years, rounded to one decimal.
  If unclear, return your best conservative estimate (>= 0).
- If a field is genuinely unknown, omit it. Never use "N/A" or "unknown".
`.trim();
}

function buildSemanticFitSystemPrompt() {
  return `
You evaluate how well a candidate's resume matches a job description.
Return STRICT JSON only. No markdown.

Output shape:
{
  "semanticScore": number,           // 0-100 holistic match
  "matchedSkills": ["string"],       // skills strongly evidenced for this role
  "missingSkills": ["string"],       // required skills not evidenced
  "explanation": "string"            // 1-2 sentence rationale
}

Rules:
- Consider both explicit skill keyword overlap and semantic relevance
  (e.g. "Next.js" experience implies "React", "TF" implies "TensorFlow").
- Be calibrated: 90+ only when the resume is a near-perfect match.
- Strict JSON only.
`.trim();
}

function safeStringArray(value: any, max = 30): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of value) {
    const s = String(v || "").trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function sanitizeStructured(raw: any) {
  const skills = safeStringArray(raw?.skills, 30);
  const experiences = Array.isArray(raw?.experiences)
    ? raw.experiences.slice(0, 8).map((e: any) => {
        const exp: any = { title: String(e?.title || "Role").slice(0, 200) };
        if (e?.company) exp.company = String(e.company).slice(0, 200);
        if (e?.startDate) exp.startDate = String(e.startDate).slice(0, 50);
        if (e?.endDate) exp.endDate = String(e.endDate).slice(0, 50);
        if (Number.isFinite(Number(e?.durationMonths))) {
          exp.durationMonths = Math.max(0, Math.round(Number(e.durationMonths)));
        }
        if (e?.description) exp.description = String(e.description).slice(0, 600);
        return exp;
      })
    : [];
  const education = Array.isArray(raw?.education)
    ? raw.education.slice(0, 4).map((ed: any) => {
        const edu: any = { degree: String(ed?.degree || "Degree").slice(0, 200) };
        if (ed?.institution) edu.institution = String(ed.institution).slice(0, 200);
        if (ed?.field) edu.field = String(ed.field).slice(0, 200);
        if (ed?.year) edu.year = String(ed.year).slice(0, 50);
        return edu;
      })
    : [];
  const yoe = Number(raw?.yearsOfExperience);
  const yearsOfExperience = Number.isFinite(yoe) && yoe >= 0 ? Math.min(50, yoe) : 0;
  const result: any = { skills, experiences, education, yearsOfExperience };
  if (raw?.summary && typeof raw.summary === "string") {
    result.summary = raw.summary.trim().slice(0, 800);
  }
  return result;
}

function keywordOverlapPct(resumeSkills: string[], requiredSkills: string[]) {
  if (!requiredSkills?.length) return 0;
  const set = new Set((resumeSkills || []).map((s) => s.toLowerCase()));
  let hits = 0;
  for (const req of requiredSkills) {
    if (set.has(String(req || "").toLowerCase())) hits++;
  }
  return Math.round((hits / requiredSkills.length) * 100);
}

export const _getApplicationForProcess = query({
  args: { applicationIdRef: v.id("applications") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const application: any = await ctx.db.get(args.applicationIdRef);
    if (!application) return null;
    const job: any = await ctx.db.get(application.jobIdRef);
    return { application, job };
  }
});

export const _storeProcessedResume = mutation({
  args: {
    applicationIdRef: v.id("applications"),
    resumeStructured: v.object({
      skills: v.array(v.string()),
      experiences: v.array(
        v.object({
          title: v.string(),
          company: v.optional(v.string()),
          startDate: v.optional(v.string()),
          endDate: v.optional(v.string()),
          durationMonths: v.optional(v.number()),
          description: v.optional(v.string())
        })
      ),
      education: v.array(
        v.object({
          degree: v.string(),
          institution: v.optional(v.string()),
          field: v.optional(v.string()),
          year: v.optional(v.string())
        })
      ),
      yearsOfExperience: v.number(),
      summary: v.optional(v.string())
    }),
    fitScore: v.number(),
    fitBreakdown: v.object({
      keywordOverlapPct: v.number(),
      semanticScore: v.number(),
      matchedSkills: v.array(v.string()),
      missingSkills: v.array(v.string()),
      explanation: v.optional(v.string())
    }),
    resumeEmbedding: v.array(v.float64())
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    await ctx.db.patch(args.applicationIdRef, {
      resumeStructured: args.resumeStructured,
      fitScore: args.fitScore,
      fitBreakdown: args.fitBreakdown,
      resumeEmbedding: args.resumeEmbedding,
      parsedAt: Date.now()
    });
    return args.applicationIdRef;
  }
});

export const processApplication = action({
  args: { applicationIdRef: v.id("applications") },
  handler: async (ctx, args): Promise<any> => {
    const ctxData: any = await ctx.runQuery(api.resume._getApplicationForProcess, {
      applicationIdRef: args.applicationIdRef
    });
    if (!ctxData?.application) throw new Error("Application not found");
    if (!ctxData.job) throw new Error("Job not found");
    if (ctxData.application.parsedAt) {
      return { ok: true, alreadyProcessed: true };
    }

    const resumeText: string = String(ctxData.application.resumeTextSnapshot || "").trim();
    if (!resumeText) throw new Error("Resume text is empty");
    const requiredSkills: string[] = Array.isArray(ctxData.job.requiredSkills)
      ? ctxData.job.requiredSkills
      : [];

    const structuredRaw: any = await callHfJson({
      systemPrompt: buildResumeStructureSystemPrompt(),
      userPrompt: { task: "Parse this resume.", resumeText: resumeText.slice(0, 12000) },
      temperature: 0.1,
      maxTokens: 1800
    });
    const structured = sanitizeStructured(structuredRaw);

    const semanticRaw: any = await callHfJson({
      systemPrompt: buildSemanticFitSystemPrompt(),
      userPrompt: {
        jobTitle: ctxData.job.title,
        jobDescription: String(ctxData.job.description || "").slice(0, 6000),
        requiredSkills,
        candidateSkills: structured.skills,
        candidateSummary: structured.summary || "",
        candidateExperiences: structured.experiences
      },
      temperature: 0.2,
      maxTokens: 600
    });
    const semanticScore = Math.max(
      0,
      Math.min(100, Math.round(Number(semanticRaw?.semanticScore) || 0))
    );
    const matchedSkills = safeStringArray(semanticRaw?.matchedSkills, 20);
    const missingSkills = safeStringArray(semanticRaw?.missingSkills, 20);
    const explanation =
      typeof semanticRaw?.explanation === "string"
        ? semanticRaw.explanation.trim().slice(0, 400)
        : "";

    const overlap = keywordOverlapPct(structured.skills, requiredSkills);
    const fitScore = Math.round(0.45 * overlap + 0.55 * semanticScore);

    const embeddingInput = [
      `Title: ${ctxData.job.title}`,
      `Skills: ${structured.skills.join(", ")}`,
      structured.summary || "",
      resumeText.slice(0, 4000)
    ]
      .filter(Boolean)
      .join("\n");

    let embedding: number[] = [];
    try {
      embedding = await embedText(embeddingInput);
    } catch (e: any) {
      console.warn("embedText failed:", e?.message || e);
    }

    await ctx.runMutation(api.resume._storeProcessedResume, {
      applicationIdRef: args.applicationIdRef,
      resumeStructured: structured,
      fitScore,
      fitBreakdown: {
        keywordOverlapPct: overlap,
        semanticScore,
        matchedSkills,
        missingSkills,
        explanation: explanation || undefined
      },
      resumeEmbedding: embedding
    });

    return { ok: true, fitScore, semanticScore, keywordOverlapPct: overlap };
  }
});

export const previewFit = action({
  args: {
    resumeText: v.string(),
    jobIdRef: v.id("jobs")
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    fitScore: number;
    keywordOverlapPct: number;
    semanticScore: number;
    matchedSkills: string[];
    missingSkills: string[];
    explanation: string;
    skills: string[];
    yearsOfExperience: number;
  }> => {
    await requireUser(ctx);
    const job: any = await ctx.runQuery(api.jobs._getJob, { jobIdRef: args.jobIdRef });
    if (!job) throw new Error("Job not found");
    const resumeText = String(args.resumeText || "").trim();
    if (!resumeText) throw new Error("Resume text is empty");
    const requiredSkills: string[] = Array.isArray(job.requiredSkills) ? job.requiredSkills : [];

    const structuredRaw: any = await callHfJson({
      systemPrompt: buildResumeStructureSystemPrompt(),
      userPrompt: { task: "Parse this resume.", resumeText: resumeText.slice(0, 10000) },
      temperature: 0.1,
      maxTokens: 1500
    });
    const structured = sanitizeStructured(structuredRaw);

    const semanticRaw: any = await callHfJson({
      systemPrompt: buildSemanticFitSystemPrompt(),
      userPrompt: {
        jobTitle: job.title,
        jobDescription: String(job.description || "").slice(0, 6000),
        requiredSkills,
        candidateSkills: structured.skills,
        candidateSummary: structured.summary || ""
      },
      temperature: 0.2,
      maxTokens: 500
    });
    const semanticScore = Math.max(
      0,
      Math.min(100, Math.round(Number(semanticRaw?.semanticScore) || 0))
    );
    const matchedSkills = safeStringArray(semanticRaw?.matchedSkills, 20);
    const missingSkills = safeStringArray(semanticRaw?.missingSkills, 20);
    const overlap = keywordOverlapPct(structured.skills, requiredSkills);
    const fitScore = Math.round(0.45 * overlap + 0.55 * semanticScore);

    return {
      fitScore,
      keywordOverlapPct: overlap,
      semanticScore,
      matchedSkills,
      missingSkills,
      explanation:
        typeof semanticRaw?.explanation === "string" ? semanticRaw.explanation.trim() : "",
      skills: structured.skills,
      yearsOfExperience: structured.yearsOfExperience
    };
  }
});

export const _hydrateApplications = query({
  args: {
    applicationIds: v.array(v.id("applications"))
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = await Promise.all(
      args.applicationIds.map(async (id) => {
        const app: any = await ctx.db.get(id);
        if (!app) return null;
        const candidate: any = await ctx.db.get(app.candidateIdRef);
        const job: any = await ctx.db.get(app.jobIdRef);
        return {
          _id: app._id,
          jobIdRef: app.jobIdRef,
          jobTitle: job?.title || "",
          jobIdString: job?.jobId || "",
          candidateEmail: candidate?.email || "",
          candidateName: candidate?.name || "",
          fitScore: app.fitScore ?? null,
          fitBreakdown: app.fitBreakdown || null,
          appliedAt: app.appliedAt,
          assessmentStatus: app.assessmentStatus,
          structured: app.resumeStructured || null
        };
      })
    );
    return rows.filter(Boolean);
  }
});

export const searchByQuery = action({
  args: {
    queryText: v.string(),
    jobIdRef: v.optional(v.id("jobs")),
    limit: v.optional(v.number())
  },
  handler: async (
    ctx,
    args
  ): Promise<
    Array<{
      _id: any;
      _score: number;
      jobIdRef: any;
      jobTitle: string;
      jobIdString: string;
      candidateEmail: string;
      candidateName: string;
      fitScore: number | null;
      fitBreakdown: any;
      appliedAt: number;
      assessmentStatus: string;
      structured: any;
    }>
  > => {
    await requireAdmin(ctx);
    const queryText = String(args.queryText || "").trim();
    if (!queryText) throw new Error("Search query is empty");
    const limit = Math.max(1, Math.min(25, Number(args.limit) || 10));

    const queryEmbedding = await embedText(queryText);

    const results = args.jobIdRef
      ? await ctx.vectorSearch("applications", "by_resume_embedding", {
          vector: queryEmbedding,
          limit,
          filter: (q) => q.eq("jobIdRef", args.jobIdRef!)
        })
      : await ctx.vectorSearch("applications", "by_resume_embedding", {
          vector: queryEmbedding,
          limit
        });

    if (!results.length) return [];

    const hydrated: any[] = await ctx.runQuery(api.resume._hydrateApplications, {
      applicationIds: results.map((r) => r._id)
    });
    const byId = new Map(hydrated.map((row: any) => [String(row._id), row]));
    return results
      .map((r) => {
        const row: any = byId.get(String(r._id));
        if (!row) return null;
        return { ...row, _score: r._score };
      })
      .filter(Boolean) as any[];
  }
});

export const _clearParsed = mutation({
  args: { applicationIdRef: v.id("applications") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.applicationIdRef, {
      parsedAt: undefined,
      resumeStructured: undefined,
      fitScore: undefined,
      fitBreakdown: undefined,
      resumeEmbedding: undefined
    });
  }
});

export const reprocessApplication = action({
  args: { applicationIdRef: v.id("applications") },
  handler: async (ctx, args): Promise<any> => {
    await requireAdmin(ctx);
    await ctx.runMutation(api.resume._clearParsed, {
      applicationIdRef: args.applicationIdRef
    });
    return ctx.runAction(api.resume.processApplication, {
      applicationIdRef: args.applicationIdRef
    });
  }
});
