const express = require("express");
const path = require("path");
const multer = require("multer");
const pdfParse = require("pdf-parse");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const {
  assessCandidate,
  extractRequiredSkillsFromJD,
  getCompanyConfig
} = require("./assessmentEngine");
const { getLlmConfig, llmTurn, llmAssess } = require("./llmEngine");
const { readStore, writeStore, newId, getRoleFromEmail, upsertUser } = require("./store");

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 }
});

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

function getActor(req) {
  const email = (req.headers["x-user-email"] || "").toString().toLowerCase();
  const name = (req.headers["x-user-name"] || "").toString();
  if (!email) return null;
  const user = upsertUser(email, name);
  return user;
}

function requireActor(req, res) {
  const actor = getActor(req);
  if (!actor) {
    res.status(401).json({ error: "Missing authenticated user context." });
    return null;
  }
  return actor;
}

function requireAdminActor(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return null;
  if (actor.role !== "admin") {
    res.status(403).json({ error: "Admin access required." });
    return null;
  }
  return actor;
}

app.post("/api/parse-jd", (req, res) => {
  const jdText = req.body?.jdText || "";
  const requiredSkills = extractRequiredSkillsFromJD(jdText);
  res.json({ requiredSkills });
});

app.post("/api/users/upsert", (req, res) => {
  const { email, name } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }
  const user = upsertUser(email, name || "");
  return res.json(user);
});

app.get("/api/jobs", (_req, res) => {
  const store = readStore();
  const jobs = store.jobs.filter((j) => j.status === "open").sort((a, b) => b.createdAt - a.createdAt);
  return res.json({ jobs });
});

app.post("/api/admin/jobs", (req, res) => {
  const actor = requireAdminActor(req, res);
  if (!actor) return;

  const { jobId, title, description, requiredSkills } = req.body || {};
  if (!jobId || !title || !description) {
    return res.status(400).json({ error: "jobId, title, description required" });
  }

  const store = readStore();
  const exists = store.jobs.find((j) => j.jobId === jobId);
  if (exists) {
    return res.status(400).json({ error: "Job ID already exists" });
  }

  const job = {
    id: newId("job"),
    jobId,
    title,
    description,
    requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : [],
    createdBy: actor.email,
    createdAt: Date.now(),
    status: "open"
  };
  store.jobs.push(job);
  writeStore(store);
  return res.json(job);
});

app.get("/api/admin/jobs", (req, res) => {
  const actor = requireAdminActor(req, res);
  if (!actor) return;
  const store = readStore();
  const jobs = store.jobs.sort((a, b) => b.createdAt - a.createdAt);
  return res.json({ jobs });
});

app.get("/api/admin/jobs/:jobId/summary", (req, res) => {
  const actor = requireAdminActor(req, res);
  if (!actor) return;
  const { jobId } = req.params;
  const store = readStore();
  const job = store.jobs.find((j) => j.id === jobId || j.jobId === jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });

  const applications = store.applications.filter((a) => a.jobId === job.id);
  const started = applications.filter((a) => a.assessmentStatus !== "not_started").length;
  const completed = applications.filter((a) => a.assessmentStatus === "completed").length;
  const resultRows = store.assessmentResults
    .filter((r) => r.jobId === job.id)
    .sort((a, b) => b.finalScore - a.finalScore)
    .map((r, index) => {
      const user = store.users.find((u) => u.id === r.userId);
      return {
        rank: index + 1,
        candidateEmail: user?.email || "unknown",
        finalScore: r.finalScore,
        recommendation: r.recommendation
      };
    });

  return res.json({
    job,
    stats: {
      applicants: applications.length,
      started,
      completed
    },
    rankings: resultRows
  });
});

app.post("/api/applications", (req, res) => {
  const actor = requireActor(req, res);
  if (!actor) return;

  const { jobId, resumeFileName, resumeTextSnapshot } = req.body || {};
  if (!jobId || !resumeTextSnapshot) {
    return res.status(400).json({ error: "jobId and resumeTextSnapshot required" });
  }

  const store = readStore();
  const job = store.jobs.find((j) => j.id === jobId || j.jobId === jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  const duplicate = store.applications.find((a) => a.jobId === job.id && a.userId === actor.id);
  if (duplicate) {
    return res.status(400).json({ error: "Already applied for this job" });
  }

  const appRecord = {
    id: newId("app"),
    jobId: job.id,
    userId: actor.id,
    resumeFileName: resumeFileName || "resume.pdf",
    resumeTextSnapshot,
    appliedAt: Date.now(),
    assessmentStatus: "not_started"
  };
  store.applications.push(appRecord);
  writeStore(store);
  return res.json(appRecord);
});

app.get("/api/my/applications", (req, res) => {
  const actor = requireActor(req, res);
  if (!actor) return;
  const store = readStore();
  const rows = store.applications
    .filter((a) => a.userId === actor.id)
    .map((a) => ({
      ...a,
      job: store.jobs.find((j) => j.id === a.jobId) || null
    }))
    .sort((a, b) => b.appliedAt - a.appliedAt);
  return res.json({ applications: rows });
});

app.post("/api/applications/:applicationId/start-assessment", (req, res) => {
  const actor = requireActor(req, res);
  if (!actor) return;
  const { applicationId } = req.params;
  const store = readStore();
  const appRecord = store.applications.find((a) => a.id === applicationId && a.userId === actor.id);
  if (!appRecord) return res.status(404).json({ error: "Application not found" });

  let session = store.assessmentSessions.find((s) => s.applicationId === appRecord.id);
  if (!session) {
    session = {
      id: newId("ses"),
      applicationId: appRecord.id,
      startedAt: Date.now(),
      lastQuestionAt: Date.now(),
      status: "in_progress",
      structuredAnswers: {}
    };
    store.assessmentSessions.push(session);
  }
  appRecord.assessmentStatus = session.status === "completed" ? "completed" : "in_progress";
  writeStore(store);
  return res.json({ session });
});

app.get("/api/applications/:applicationId/assessment", (req, res) => {
  try {
    const actor = requireActor(req, res);
    if (!actor) return;
    const { applicationId } = req.params;
    const store = readStore();
    const appRecord = store.applications.find((a) => a.id === applicationId && a.userId === actor.id);
    if (!appRecord) return res.status(404).json({ error: "Application not found" });
    const job = store.jobs.find((j) => j.id === appRecord.jobId) || null;
    const session = store.assessmentSessions.find((s) => s.applicationId === applicationId) || null;
    const messages = session
      ? store.assessmentMessages.filter((m) => m.sessionId === session.id).sort((a, b) => a.createdAt - b.createdAt)
      : [];
    const result = store.assessmentResults.find((r) => r.applicationId === applicationId) || null;
    return res.json({ application: appRecord, job, session, messages, result });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Failed to load assessment state" });
  }
});

app.post("/api/applications/:applicationId/assessment-turn", async (req, res) => {
  try {
    const actor = requireActor(req, res);
    if (!actor) return;
    const { applicationId } = req.params;
    const { userText, skill } = req.body || {};
    if (!skill || typeof skill !== "string" || !skill.trim()) {
      return res.status(400).json({ error: "skill is required for skill-scoped assessment chat." });
    }
    const scopedSkill = skill.trim();
    const store = readStore();
    const appRecord = store.applications.find((a) => a.id === applicationId && a.userId === actor.id);
    if (!appRecord) return res.status(404).json({ error: "Application not found" });
    const session = store.assessmentSessions.find((s) => s.applicationId === applicationId);
    if (!session) return res.status(400).json({ error: "Assessment not started" });

    const job = store.jobs.find((j) => j.id === appRecord.jobId);
    if (!job) return res.status(404).json({ error: "Job not found for this application" });
    const history = store.assessmentMessages
      .filter((m) => m.sessionId === session.id && m.skill === scopedSkill)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((m) => ({ role: m.role, text: m.text }));

    if (userText) {
      store.assessmentMessages.push({
        id: newId("msg"),
        sessionId: session.id,
        skill: scopedSkill,
        role: "user",
        text: userText,
        createdAt: Date.now()
      });
      history.push({ role: "user", text: userText });
    }

    const scopedSkills = [{ skill: scopedSkill, weight: 1 }];
    const normalizedSkillKey = scopedSkill.toLowerCase();
    const existingStructuredAnswers = session.structuredAnswers || {};
    const scopedStructuredAnswers = existingStructuredAnswers[normalizedSkillKey]
      ? { [normalizedSkillKey]: existingStructuredAnswers[normalizedSkillKey] }
      : {};

    let turn;
    try {
      turn = await llmTurn({
        jdText: job?.description || "",
        resumeText: appRecord.resumeTextSnapshot,
        requiredSkills: scopedSkills,
        messages: history,
        structuredAnswers: scopedStructuredAnswers
      });
    } catch (llmError) {
      console.error("assessment-turn llm error:", llmError);
      const fallbackMessage =
        "I am temporarily unable to generate the next question. Please retry in a few seconds.";
      store.assessmentMessages.push({
        id: newId("msg"),
        sessionId: session.id,
        skill: scopedSkill,
        role: "assistant",
        text: fallbackMessage,
        createdAt: Date.now()
      });
      session.lastQuestionAt = Date.now();
      writeStore(store);
      return res.json({
        status: "in_progress",
        assistantMessage: fallbackMessage,
        structuredAnswers: session.structuredAnswers || {},
        result: null,
        warning: llmError?.message || "Transient LLM error"
      });
    }

    const assistantMessage = turn.assistantMessage || "Continue.";
    store.assessmentMessages.push({
      id: newId("msg"),
      sessionId: session.id,
      skill: scopedSkill,
      role: "assistant",
      text: assistantMessage,
      createdAt: Date.now()
    });
    session.structuredAnswers = {
      ...existingStructuredAnswers,
      ...(turn.structuredAnswers || {})
    };
    session.lastQuestionAt = Date.now();

    if (turn.status === "ready_for_report") {
      const report = await llmAssess({
        jdText: job?.description || "",
        resumeText: appRecord.resumeTextSnapshot,
        requiredSkills: (job?.requiredSkills || []).map((skill) => ({ skill, weight: 1 })),
        structuredAnswers: session.structuredAnswers || {},
        companyConfig: getCompanyConfig()
      });

      store.assessmentResults = store.assessmentResults.filter((r) => r.applicationId !== appRecord.id);
      store.assessmentResults.push({
        id: newId("res"),
        applicationId: appRecord.id,
        jobId: job?.id,
        userId: actor.id,
        ...report,
        completedAt: Date.now()
      });
      appRecord.assessmentStatus = "completed";
      session.status = "completed";
    }

    writeStore(store);
    return res.json({
      status: turn.status,
      assistantMessage,
      structuredAnswers: session.structuredAnswers,
      result:
        turn.status === "ready_for_report"
          ? store.assessmentResults.find((r) => r.applicationId === appRecord.id) || null
          : null
    });
  } catch (error) {
    console.error("assessment-turn error:", error);
    return res.status(500).json({ error: error?.message || "Assessment turn failed" });
  }
});

app.get("/api/company-config", (_req, res) => {
  res.json(getCompanyConfig());
});

app.get("/api/llm-status", (_req, res) => {
  const { apiKey, model } = getLlmConfig();
  res.json({ enabled: Boolean(apiKey), model });
});

app.post("/api/parse-resume-pdf", upload.single("resumePdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please upload a PDF file." });
    }

    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ error: "Only PDF files are supported." });
    }

    const parsed = await pdfParse(req.file.buffer);
    const resumeText = (parsed.text || "").trim();

    if (!resumeText) {
      return res.status(400).json({
        error: "Could not extract text from this PDF. Try another resume file."
      });
    }

    return res.json({ resumeText });
  } catch (_error) {
    return res.status(500).json({
      error: "Failed to parse PDF resume. Please try a different file."
    });
  }
});

app.post("/api/llm-turn", async (req, res) => {
  try {
    const { jdText, resumeText, requiredSkills, messages, structuredAnswers } = req.body || {};
    if (!jdText || !resumeText || !Array.isArray(requiredSkills) || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing required fields for llm turn." });
    }

    const turn = await llmTurn({
      jdText,
      resumeText,
      requiredSkills,
      messages,
      structuredAnswers: structuredAnswers || {}
    });
    return res.json(turn);
  } catch (error) {
    return res.status(500).json({ error: error.message || "LLM turn failed." });
  }
});

app.post("/api/llm-assess", async (req, res) => {
  try {
    const { jdText, resumeText, requiredSkills, structuredAnswers } = req.body || {};
    if (!jdText || !resumeText || !Array.isArray(requiredSkills)) {
      return res.status(400).json({ error: "Missing required fields for llm assess." });
    }

    const report = await llmAssess({
      jdText,
      resumeText,
      requiredSkills,
      structuredAnswers: structuredAnswers || {},
      companyConfig: getCompanyConfig()
    });
    return res.json(report);
  } catch (error) {
    return res.status(500).json({ error: error.message || "LLM assessment failed." });
  }
});

app.post("/api/assess", (req, res) => {
  const { jd, resumeText, answers } = req.body || {};
  if (!jd || !resumeText || !answers) {
    return res.status(400).json({
      error: "Missing required fields: jd, resumeText, answers"
    });
  }

  const result = assessCandidate({ jd, resumeText, answers });
  return res.json(result);
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Skill Assessment Agent running on http://localhost:${PORT}`);
});
