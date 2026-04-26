import { internalMutation } from "./_generated/server";

const DEMO_EMAIL_DOMAIN = "@demo.skilleval.app";
const DEMO_JOB_PREFIX = "DEMO-";
const DEMO_CLERK_PREFIX = "demo_clerk_";

function deterministicEmbedding(seed: string, biasSkills: string[] = []): number[] {
  // Cheap deterministic 384-dim vector keyed off the seed string.
  // Adds small "bumps" per biasSkill so candidates with overlapping skills
  // cluster together under cosine similarity (good enough for a demo).
  const hashStr = (s: string): number => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  const out = new Array<number>(384).fill(0);
  for (let i = 0; i < 384; i++) {
    const h = hashStr(`${seed}:${i}`);
    out[i] = ((h % 2000) - 1000) / 1000;
  }
  for (const skill of biasSkills) {
    const base = hashStr(skill.toLowerCase()) % 384;
    for (let k = 0; k < 12; k++) {
      const idx = (base + k * 7) % 384;
      out[idx] += 0.6;
    }
  }
  let mag = 0;
  for (const x of out) mag += x * x;
  mag = Math.sqrt(mag) || 1;
  for (let i = 0; i < 384; i++) out[i] /= mag;
  return out;
}

function pct(matched: number, total: number): number {
  if (!total) return 0;
  return Math.round((matched / total) * 100);
}

function fitFor(jobSkills: string[], candidateSkills: string[]) {
  const candSet = new Set(candidateSkills.map((s) => s.toLowerCase()));
  const matched = jobSkills.filter((s) => candSet.has(s.toLowerCase()));
  const missing = jobSkills.filter((s) => !candSet.has(s.toLowerCase()));
  const overlap = pct(matched.length, jobSkills.length);
  const semantic = Math.min(98, Math.max(20, overlap + (matched.length >= 3 ? 8 : -10)));
  const fit = Math.round(0.45 * overlap + 0.55 * semantic);
  return {
    fitScore: fit,
    keywordOverlapPct: overlap,
    semanticScore: semantic,
    matchedSkills: matched,
    missingSkills: missing
  };
}

const DEMO_JOBS = [
  {
    jobId: `${DEMO_JOB_PREFIX}FE-001`,
    title: "Senior Frontend Engineer",
    description:
      "Own customer-facing web surfaces in React + TypeScript. You'll partner with designers to ship pixel-perfect UIs, drive a11y standards, and contribute to the design system.",
    requiredSkills: ["React", "TypeScript", "Next.js", "TailwindCSS", "GraphQL"]
  },
  {
    jobId: `${DEMO_JOB_PREFIX}ML-002`,
    title: "Machine Learning Engineer",
    description:
      "Train, evaluate, and ship deep-learning models in production. Own end-to-end MLOps from feature stores to inference serving.",
    requiredSkills: ["Python", "PyTorch", "Machine Learning", "MLOps", "AWS"]
  },
  {
    jobId: `${DEMO_JOB_PREFIX}BE-003`,
    title: "Backend Engineer (Node.js)",
    description:
      "Design and build resilient REST/GraphQL APIs on Node.js with PostgreSQL & Redis. Own observability and SLOs for your services.",
    requiredSkills: ["Node.js", "PostgreSQL", "Redis", "Docker", "GraphQL"]
  },
  {
    jobId: `${DEMO_JOB_PREFIX}DEVOPS-004`,
    title: "DevOps / SRE Engineer",
    description:
      "Operate our multi-region Kubernetes platform, harden CI/CD pipelines, and drive cost & reliability initiatives.",
    requiredSkills: ["Kubernetes", "Terraform", "AWS", "Linux", "CI/CD"]
  },
  {
    jobId: `${DEMO_JOB_PREFIX}DATA-005`,
    title: "Data Engineer",
    description:
      "Build batch and streaming pipelines feeding the analytics warehouse. Own data quality, lineage, and SLAs for downstream consumers.",
    requiredSkills: ["Python", "Spark", "SQL", "Airflow", "AWS"]
  }
];

const DEMO_CANDIDATES: Array<{
  email: string;
  name: string;
  yearsOfExperience: number;
  skills: string[];
  summary: string;
  resume: string;
}> = [
  {
    email: `alice.kim${DEMO_EMAIL_DOMAIN}`,
    name: "Alice Kim",
    yearsOfExperience: 6,
    skills: ["React", "TypeScript", "Next.js", "TailwindCSS", "GraphQL", "Jest"],
    summary: "Senior frontend engineer with 6 years building React/Next.js apps for fintech.",
    resume:
      "Alice Kim - Senior Frontend Engineer\nLed React + Next.js migration at Stripe-clone fintech. Owned design system in TailwindCSS. Shipped GraphQL data layer with TypeScript. Mentored 4 engineers."
  },
  {
    email: `bryan.patel${DEMO_EMAIL_DOMAIN}`,
    name: "Bryan Patel",
    yearsOfExperience: 5,
    skills: ["Python", "PyTorch", "TensorFlow", "Machine Learning", "MLOps", "AWS", "Docker"],
    summary: "ML engineer focused on production deep-learning systems on AWS.",
    resume:
      "Bryan Patel - ML Engineer\nDeployed PyTorch ranking models to AWS SageMaker serving 4M req/day. Built MLOps platform with Kubeflow. Cut training cost by 38% via spot instances."
  },
  {
    email: `chen.wei${DEMO_EMAIL_DOMAIN}`,
    name: "Chen Wei",
    yearsOfExperience: 4,
    skills: ["React", "TypeScript", "Node.js", "PostgreSQL", "Docker", "AWS"],
    summary: "Full-stack engineer comfortable across React frontends and Node.js APIs.",
    resume:
      "Chen Wei - Full-Stack Engineer\nShipped React/TypeScript dashboards backed by Node.js + PostgreSQL APIs. Containerized services with Docker. AWS ECS deployment."
  },
  {
    email: `diana.rivera${DEMO_EMAIL_DOMAIN}`,
    name: "Diana Rivera",
    yearsOfExperience: 7,
    skills: ["Node.js", "PostgreSQL", "Redis", "GraphQL", "Docker", "AWS", "Kafka"],
    summary: "Backend engineer specializing in high-throughput Node.js services.",
    resume:
      "Diana Rivera - Senior Backend Engineer\nBuilt event-driven Node.js services on Kafka. Owned PostgreSQL replication and Redis caching. Authored GraphQL federation layer."
  },
  {
    email: `ezra.nakamura${DEMO_EMAIL_DOMAIN}`,
    name: "Ezra Nakamura",
    yearsOfExperience: 8,
    skills: ["Kubernetes", "Terraform", "AWS", "Linux", "CI/CD", "Bash", "Prometheus"],
    summary: "DevOps engineer running multi-region Kubernetes since 2019.",
    resume:
      "Ezra Nakamura - DevOps / SRE\nMigrated 60+ services to EKS. Authored Terraform modules used company-wide. Cut deploy time from 22m to 4m via GitHub Actions pipelines."
  },
  {
    email: `farah.ali${DEMO_EMAIL_DOMAIN}`,
    name: "Farah Ali",
    yearsOfExperience: 1,
    skills: ["HTML", "CSS", "JavaScript", "React"],
    summary: "Junior frontend developer, recent CS grad excited about React.",
    resume:
      "Farah Ali - Junior Frontend Developer\nCS grad. Built personal portfolio in React. Contributed to open-source CSS libraries. Internship at marketing agency."
  },
  {
    email: `george.brooks${DEMO_EMAIL_DOMAIN}`,
    name: "George Brooks",
    yearsOfExperience: 5,
    skills: ["Python", "SQL", "Spark", "Airflow", "dbt", "AWS", "Snowflake"],
    summary: "Data engineer building the warehouse layer at a Series-C startup.",
    resume:
      "George Brooks - Data Engineer\nOwned Airflow + dbt pipelines feeding Snowflake. Productionized PySpark batch ETLs (1B rows/day). Drove data SLA framework."
  },
  {
    email: `hina.gupta${DEMO_EMAIL_DOMAIN}`,
    name: "Hina Gupta",
    yearsOfExperience: 3,
    skills: ["React Native", "React", "TypeScript", "Node.js", "GraphQL", "AWS"],
    summary: "Mobile-leaning full-stack engineer, React Native + GraphQL focus.",
    resume:
      "Hina Gupta - Mobile / Full-Stack Engineer\nShipped a React Native consumer app to 200k MAU. Wrote Node.js GraphQL backend on AWS Lambda. TypeScript across the stack."
  }
];

// Pairings: candidate -> [jobIndex, status]
//   status: "completed" | "in_progress" | "not_started"
const APPLICATIONS: Array<{
  candidate: string;
  jobIndex: number;
  status: "completed" | "in_progress" | "not_started";
}> = [
  { candidate: "alice.kim", jobIndex: 0, status: "completed" },
  { candidate: "alice.kim", jobIndex: 2, status: "not_started" },
  { candidate: "bryan.patel", jobIndex: 1, status: "completed" },
  { candidate: "bryan.patel", jobIndex: 4, status: "in_progress" },
  { candidate: "chen.wei", jobIndex: 0, status: "completed" },
  { candidate: "chen.wei", jobIndex: 2, status: "completed" },
  { candidate: "diana.rivera", jobIndex: 2, status: "completed" },
  { candidate: "diana.rivera", jobIndex: 3, status: "in_progress" },
  { candidate: "ezra.nakamura", jobIndex: 3, status: "completed" },
  { candidate: "ezra.nakamura", jobIndex: 2, status: "not_started" },
  { candidate: "farah.ali", jobIndex: 0, status: "in_progress" },
  { candidate: "george.brooks", jobIndex: 4, status: "completed" },
  { candidate: "george.brooks", jobIndex: 1, status: "not_started" },
  { candidate: "hina.gupta", jobIndex: 0, status: "completed" },
  { candidate: "hina.gupta", jobIndex: 2, status: "in_progress" }
];

function recommendationFor(score: number): string {
  if (score >= 85) return "Strong hire";
  if (score >= 70) return "Hire";
  if (score >= 55) return "Lean hire";
  if (score >= 40) return "Borderline";
  return "No hire";
}

function generateQuestions(skill: string, baseScoreSeed: number) {
  const baseScore = Math.max(20, Math.min(100, baseScoreSeed + (Math.random() * 16 - 8)));
  const kinds: Array<"mcq" | "descriptive" | "coding"> = [
    "mcq",
    "mcq",
    "descriptive",
    "mcq",
    "coding",
    "descriptive",
    "mcq"
  ];
  const now = Date.now();
  return kinds.map((kind, i) => {
    const qScore = Math.max(0, Math.min(100, Math.round(baseScore + (Math.random() * 20 - 10))));
    const startedAt = now - 60_000 * (kinds.length - i + 2);
    const submittedAt = startedAt + 30_000 + Math.floor(Math.random() * 90_000);
    const timeTakenSeconds = Math.round((submittedAt - startedAt) / 1000);
    const base: any = {
      kind,
      prompt: `Sample ${skill} ${kind} question #${i + 1}.`,
      startedAt,
      submittedAt,
      timeTakenSeconds,
      score: qScore,
      feedback:
        qScore >= 75 ? `Solid ${skill} answer.` : `Could go deeper on ${skill}.`
    };
    if (kind === "mcq") {
      base.options = ["Option A", "Option B", "Option C", "Option D"];
      base.correctOptionIndex = 1;
      base.selectedOptionIndex = qScore >= 60 ? 1 : 0;
    } else if (kind === "coding") {
      base.language = "javascript";
      base.boilerplate = `function solve() {\n  // your code here\n}`;
      base.answerText = `function solve() {\n  // ${skill} demo solution\n  return true;\n}`;
    } else {
      base.answerText = `Demo descriptive answer for ${skill}.`;
    }
    return base;
  });
}

function makeLearningPlan(skill: string, score: number) {
  const priority: "High" | "Medium" | "Low" = score < 55 ? "High" : score < 75 ? "Medium" : "Low";
  return {
    currentLevel: score >= 80 ? "Advanced" : score >= 60 ? "Intermediate" : "Beginner",
    targetLevel: score >= 80 ? "Expert" : score >= 60 ? "Advanced" : "Intermediate",
    priority,
    estimatedHours: score >= 80 ? 12 : score >= 60 ? 24 : 40,
    timelineWeeks: score >= 80 ? 2 : score >= 60 ? 4 : 8,
    focusAreas: [`${skill} fundamentals`, `${skill} system design`, `Production ${skill}`],
    adjacentSkills: ["System Design", "Testing", "Communication"],
    resources: [
      { title: `Official ${skill} Docs`, type: "Documentation" },
      { title: `${skill} Deep Dive`, type: "Course" },
      { title: `Build a project with ${skill}`, type: "Project" }
    ],
    weeklyMilestones: [
      `Week 1: Refresh ${skill} core concepts`,
      `Week 2: Solve practice problems`,
      `Week 3: Ship a small project`,
      `Week 4: Mock interview / review`
    ]
  };
}

export const seedDemo = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const summary = {
      jobsCreated: 0,
      jobsExisting: 0,
      candidatesCreated: 0,
      candidatesExisting: 0,
      applicationsCreated: 0,
      applicationsExisting: 0,
      skillAssessmentsCreated: 0,
      assessmentResultsCreated: 0,
      learningProgressCreated: 0
    };

    // -- Users (demo candidates) --
    const userIdByEmail = new Map<string, any>();
    for (const c of DEMO_CANDIDATES) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", c.email))
        .first();
      if (existing) {
        userIdByEmail.set(c.email, existing._id);
        summary.candidatesExisting++;
      } else {
        const id = await ctx.db.insert("users", {
          clerkUserId: `${DEMO_CLERK_PREFIX}${c.email.split("@")[0]}`,
          email: c.email,
          name: c.name,
          role: "user",
          createdAt: now
        });
        userIdByEmail.set(c.email, id);
        summary.candidatesCreated++;
      }
    }

    // -- Jobs --
    const jobIdByCode = new Map<string, any>();
    for (const j of DEMO_JOBS) {
      const existing = await ctx.db
        .query("jobs")
        .withIndex("by_job_id", (q) => q.eq("jobId", j.jobId))
        .first();
      if (existing) {
        jobIdByCode.set(j.jobId, existing._id);
        summary.jobsExisting++;
      } else {
        const id = await ctx.db.insert("jobs", {
          jobId: j.jobId,
          title: j.title,
          description: j.description,
          requiredSkills: j.requiredSkills,
          createdBy: "demo_seed_admin",
          createdAt: now,
          status: "open"
        });
        jobIdByCode.set(j.jobId, id);
        summary.jobsCreated++;
      }
    }

    // -- Applications + skill assessments + results --
    for (const pair of APPLICATIONS) {
      const candidate = DEMO_CANDIDATES.find(
        (c) => c.email.startsWith(pair.candidate) && c.email.endsWith(DEMO_EMAIL_DOMAIN)
      );
      if (!candidate) continue;
      const job = DEMO_JOBS[pair.jobIndex];
      const candidateId = userIdByEmail.get(candidate.email);
      const jobIdRef = jobIdByCode.get(job.jobId);
      if (!candidateId || !jobIdRef) continue;

      // Skip if application already exists for this (candidate, job)
      const existingApps = await ctx.db
        .query("applications")
        .withIndex("by_candidate", (q) => q.eq("candidateIdRef", candidateId))
        .collect();
      const existingApp = existingApps.find(
        (a: any) => String(a.jobIdRef) === String(jobIdRef)
      );
      if (existingApp) {
        summary.applicationsExisting++;
        continue;
      }

      const fit = fitFor(job.requiredSkills, candidate.skills);
      const embedding = deterministicEmbedding(
        `${candidate.email}|${job.jobId}`,
        candidate.skills
      );

      const applicationId = await ctx.db.insert("applications", {
        jobIdRef,
        candidateIdRef: candidateId,
        resumeFileName: `${candidate.email.split("@")[0]}-resume.pdf`,
        resumeTextSnapshot: candidate.resume,
        appliedAt: now - 1000 * 60 * 60 * 24 * (1 + Math.floor(Math.random() * 14)),
        assessmentStatus: pair.status,
        resumeStructured: {
          skills: candidate.skills,
          experiences: [
            {
              title: candidate.name.split(" ")[0] + " - Senior role",
              company: "Acme Co.",
              startDate: "2022",
              endDate: "Present",
              durationMonths: candidate.yearsOfExperience * 12,
              description: candidate.summary
            }
          ],
          education: [
            {
              degree: "B.S. Computer Science",
              institution: "State University",
              year: "2018"
            }
          ],
          yearsOfExperience: candidate.yearsOfExperience,
          summary: candidate.summary
        },
        fitScore: fit.fitScore,
        fitBreakdown: {
          keywordOverlapPct: fit.keywordOverlapPct,
          semanticScore: fit.semanticScore,
          matchedSkills: fit.matchedSkills,
          missingSkills: fit.missingSkills,
          explanation: `Auto-generated demo fit score for ${candidate.name} on ${job.title}.`
        },
        resumeEmbedding: embedding,
        parsedAt: now
      });
      summary.applicationsCreated++;

      // Skill assessments per required skill
      const skillScores: number[] = [];
      const candidateSkillSet = new Set(candidate.skills.map((s) => s.toLowerCase()));
      for (const skill of job.requiredSkills) {
        const hasSkill = candidateSkillSet.has(skill.toLowerCase());
        const baseScore = hasSkill
          ? 65 + Math.floor(Math.random() * 30)
          : 25 + Math.floor(Math.random() * 30);

        let status: "not_started" | "in_progress" | "completed";
        if (pair.status === "completed") {
          status = "completed";
        } else if (pair.status === "in_progress") {
          status = Math.random() > 0.5 ? "completed" : "in_progress";
        } else {
          status = "not_started";
        }

        const questions = status === "not_started" ? [] : generateQuestions(skill, baseScore);
        const skillScore = questions.length
          ? Math.round(
              questions.reduce((acc, q) => acc + (q.score ?? 0), 0) / questions.length
            )
          : undefined;

        const learningPlan =
          status === "completed" && typeof skillScore === "number"
            ? makeLearningPlan(skill, skillScore)
            : undefined;

        const skillAssessmentId = await ctx.db.insert("skillAssessments", {
          applicationIdRef: applicationId,
          jobIdRef,
          candidateIdRef: candidateId,
          skill,
          status,
          questionIndex: status === "completed" ? questions.length : 0,
          questions,
          skillScore,
          conclusion:
            status === "completed"
              ? `${candidate.name.split(" ")[0]} shows ${
                  skillScore && skillScore >= 75 ? "strong" : "moderate"
                } ${skill} ability.`
              : undefined,
          learningPlan,
          completedAt: status === "completed" ? now : undefined,
          createdAt: now,
          updatedAt: now
        });
        summary.skillAssessmentsCreated++;
        if (typeof skillScore === "number") skillScores.push(skillScore);

        // Pre-tick a couple of milestones for completed plans so the
        // Learning hub progress bars show a partial state out of the box.
        if (learningPlan && learningPlan.weeklyMilestones?.length) {
          const numToComplete = Math.floor(Math.random() * 2) + 1; // 1 or 2
          for (let i = 0; i < Math.min(numToComplete, learningPlan.weeklyMilestones.length); i++) {
            await ctx.db.insert("learningProgress", {
              skillAssessmentIdRef: skillAssessmentId,
              candidateIdRef: candidateId,
              milestoneIndex: i,
              completed: true,
              completedAt: now - 1000 * 60 * 60 * 24 * (1 + Math.floor(Math.random() * 5)),
              updatedAt: now
            });
            summary.learningProgressCreated++;
          }
        }
      }

      if (pair.status === "completed" && skillScores.length) {
        const baseScore = Math.round(
          skillScores.reduce((a, b) => a + b, 0) / skillScores.length
        );
        const finalScore = Math.round(baseScore * 0.7 + fit.fitScore * 0.3);
        await ctx.db.insert("assessmentResults", {
          applicationIdRef: applicationId,
          jobIdRef,
          candidateIdRef: candidateId,
          baseScore,
          finalScore,
          companySignal: "DemoCo",
          recommendation: recommendationFor(finalScore),
          completedAt: now
        });
        summary.assessmentResultsCreated++;
      }
    }

    return { ok: true, ...summary };
  }
});

export const wipeDemo = internalMutation({
  args: {},
  handler: async (ctx) => {
    const summary = {
      jobsDeleted: 0,
      candidatesDeleted: 0,
      applicationsDeleted: 0,
      skillAssessmentsDeleted: 0,
      assessmentResultsDeleted: 0,
      drafts: 0,
      learningProgress: 0,
      refresherQuizzes: 0
    };

    // Find demo jobs
    const allJobs = await ctx.db.query("jobs").collect();
    const demoJobs = allJobs.filter((j: any) =>
      String(j.jobId).startsWith(DEMO_JOB_PREFIX)
    );
    const demoJobIds = new Set(demoJobs.map((j: any) => String(j._id)));

    // Find demo users
    const allUsers = await ctx.db.query("users").collect();
    const demoUsers = allUsers.filter((u: any) =>
      String(u.email || "").endsWith(DEMO_EMAIL_DOMAIN)
    );
    const demoUserIds = new Set(demoUsers.map((u: any) => String(u._id)));

    // Applications belonging to demo jobs OR demo candidates
    const allApps = await ctx.db.query("applications").collect();
    const demoApps = allApps.filter(
      (a: any) =>
        demoJobIds.has(String(a.jobIdRef)) || demoUserIds.has(String(a.candidateIdRef))
    );
    const demoAppIds = new Set(demoApps.map((a: any) => String(a._id)));

    // Cascade clean child rows
    const allSkillAssessments = await ctx.db.query("skillAssessments").collect();
    for (const s of allSkillAssessments) {
      if (demoAppIds.has(String((s as any).applicationIdRef))) {
        const drafts = await ctx.db
          .query("skillAnswerDrafts")
          .withIndex("by_skill_assessment", (q) =>
            q.eq("skillAssessmentIdRef", (s as any)._id)
          )
          .collect();
        for (const d of drafts) {
          await ctx.db.delete(d._id);
          summary.drafts++;
        }
        const progress = await ctx.db
          .query("learningProgress")
          .withIndex("by_skill_assessment", (q) =>
            q.eq("skillAssessmentIdRef", (s as any)._id)
          )
          .collect();
        for (const p of progress) {
          await ctx.db.delete(p._id);
          summary.learningProgress++;
        }
        const quizzes = await ctx.db
          .query("refresherQuizzes")
          .withIndex("by_skill_assessment", (q) =>
            q.eq("skillAssessmentIdRef", (s as any)._id)
          )
          .collect();
        for (const r of quizzes) {
          await ctx.db.delete(r._id);
          summary.refresherQuizzes++;
        }
        await ctx.db.delete(s._id);
        summary.skillAssessmentsDeleted++;
      }
    }

    const allResults = await ctx.db.query("assessmentResults").collect();
    for (const r of allResults) {
      if (demoAppIds.has(String((r as any).applicationIdRef))) {
        await ctx.db.delete(r._id);
        summary.assessmentResultsDeleted++;
      }
    }

    for (const a of demoApps) {
      await ctx.db.delete(a._id);
      summary.applicationsDeleted++;
    }
    for (const j of demoJobs) {
      await ctx.db.delete(j._id);
      summary.jobsDeleted++;
    }
    for (const u of demoUsers) {
      await ctx.db.delete(u._id);
      summary.candidatesDeleted++;
    }

    return { ok: true, ...summary };
  }
});
