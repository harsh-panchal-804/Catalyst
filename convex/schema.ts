import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const resumeStructuredValidator = v.object({
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
});

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    role: v.union(v.literal("admin"), v.literal("user")),
    createdAt: v.number()
  })
    .index("by_clerk_user_id", ["clerkUserId"])
    .index("by_email", ["email"]),

  jobs: defineTable({
    jobId: v.string(),
    title: v.string(),
    description: v.string(),
    requiredSkills: v.array(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    status: v.union(v.literal("draft"), v.literal("open"), v.literal("closed"))
  })
    .index("by_job_id", ["jobId"])
    .index("by_status", ["status"]),

  applications: defineTable({
    jobIdRef: v.id("jobs"),
    candidateIdRef: v.id("users"),
    resumeFileName: v.string(),
    resumeTextSnapshot: v.string(),
    appliedAt: v.number(),
    assessmentStatus: v.union(
      v.literal("not_started"),
      v.literal("in_progress"),
      v.literal("completed")
    ),
    resumeStructured: v.optional(resumeStructuredValidator),
    fitScore: v.optional(v.number()),
    fitBreakdown: v.optional(
      v.object({
        keywordOverlapPct: v.number(),
        semanticScore: v.number(),
        matchedSkills: v.array(v.string()),
        missingSkills: v.array(v.string()),
        explanation: v.optional(v.string())
      })
    ),
    resumeEmbedding: v.optional(v.array(v.float64())),
    parsedAt: v.optional(v.number())
  })
    .index("by_job", ["jobIdRef"])
    .index("by_candidate", ["candidateIdRef"])
    .vectorIndex("by_resume_embedding", {
      vectorField: "resumeEmbedding",
      dimensions: 384,
      filterFields: ["jobIdRef"]
    }),

  assessmentSessions: defineTable({
    applicationIdRef: v.id("applications"),
    startedAt: v.number(),
    lastQuestionAt: v.number(),
    status: v.union(v.literal("in_progress"), v.literal("completed"))
  }).index("by_application", ["applicationIdRef"]),

  assessmentMessages: defineTable({
    sessionIdRef: v.id("assessmentSessions"),
    skill: v.string(),
    role: v.union(v.literal("assistant"), v.literal("user")),
    text: v.string(),
    createdAt: v.number()
  })
    .index("by_session", ["sessionIdRef"])
    .index("by_session_skill", ["sessionIdRef", "skill"]),

  skillAssessments: defineTable({
    applicationIdRef: v.id("applications"),
    jobIdRef: v.id("jobs"),
    candidateIdRef: v.id("users"),
    skill: v.string(),
    status: v.union(v.literal("not_started"), v.literal("in_progress"), v.literal("completed")),
    questionIndex: v.number(),
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
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_application", ["applicationIdRef"])
    .index("by_application_skill", ["applicationIdRef", "skill"])
    .index("by_candidate_job", ["candidateIdRef", "jobIdRef"])
    .index("by_candidate", ["candidateIdRef"])
    .index("by_job_skill_score", ["jobIdRef", "skill", "skillScore"]),

  assessmentResults: defineTable({
    applicationIdRef: v.id("applications"),
    jobIdRef: v.id("jobs"),
    candidateIdRef: v.id("users"),
    baseScore: v.number(),
    finalScore: v.number(),
    companySignal: v.optional(v.string()),
    recommendation: v.string(),
    rankSnapshot: v.optional(v.number()),
    completedAt: v.number()
  })
    .index("by_application", ["applicationIdRef"])
    .index("by_job_score", ["jobIdRef", "finalScore"]),

  skillAnswerDrafts: defineTable({
    skillAssessmentIdRef: v.id("skillAssessments"),
    questionIndex: v.number(),
    kind: v.union(v.literal("mcq"), v.literal("descriptive"), v.literal("coding")),
    answerText: v.optional(v.string()),
    selectedOptionIndex: v.optional(v.number()),
    updatedAt: v.number()
  })
    .index("by_skill_assessment", ["skillAssessmentIdRef"])
    .index("by_skill_assessment_question", ["skillAssessmentIdRef", "questionIndex"]),

  learningProgress: defineTable({
    skillAssessmentIdRef: v.id("skillAssessments"),
    candidateIdRef: v.id("users"),
    milestoneIndex: v.number(),
    completed: v.boolean(),
    completedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    updatedAt: v.number()
  })
    .index("by_skill_assessment", ["skillAssessmentIdRef"])
    .index("by_candidate", ["candidateIdRef"])
    .index("by_skill_assessment_milestone", ["skillAssessmentIdRef", "milestoneIndex"]),

  refresherQuizzes: defineTable({
    skillAssessmentIdRef: v.id("skillAssessments"),
    candidateIdRef: v.id("users"),
    skill: v.string(),
    questions: v.array(
      v.object({
        prompt: v.string(),
        options: v.array(v.string()),
        correctOptionIndex: v.number(),
        explanation: v.optional(v.string()),
        selectedOptionIndex: v.optional(v.number()),
        isCorrect: v.optional(v.boolean())
      })
    ),
    status: v.union(v.literal("in_progress"), v.literal("completed")),
    score: v.optional(v.number()),
    createdAt: v.number(),
    completedAt: v.optional(v.number())
  })
    .index("by_skill_assessment", ["skillAssessmentIdRef"])
    .index("by_candidate", ["candidateIdRef"]),

  resourceHealth: defineTable({
    url: v.string(),
    status: v.union(v.literal("ok"), v.literal("broken"), v.literal("unknown")),
    httpStatus: v.optional(v.number()),
    lastCheckedAt: v.number(),
    failureCount: v.number()
  }).index("by_url", ["url"])
});
