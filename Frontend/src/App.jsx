import { useEffect, useMemo, useState } from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useUser
} from "@clerk/clerk-react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Toaster, toast } from "sonner";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AnimatedThemeToggler } from "./components/ui/animated-theme-toggler";
import { AnimatedShinyText } from "./components/ui/animated-shiny-text";
import { JobsTab } from "./components/candidate/jobs-tab";
import { AppliedJobsTab } from "./components/candidate/applied-jobs-tab";
import { AdminDashboard } from "./components/admin/admin-dashboard";
import { ChatContainer } from "./components/prompt-kit/chat-container";
import { Message } from "./components/prompt-kit/message";
import { PromptInput } from "./components/prompt-kit/prompt-input";
import { ThinkingBar } from "./components/prompt-kit/thinking-bar";
import Editor from "@monaco-editor/react";
import { PixelImage } from "@/components/ui/pixel-image";

const MONACO_LANGUAGE_MAP = {
  javascript: "javascript",
  typescript: "typescript",
  python: "python",
  java: "java",
  cpp: "cpp",
  go: "go"
};

const DEFAULT_SKILL_CATALOG = [
  "React",
  "JavaScript",
  "TypeScript",
  "Node.js",
  "Python",
  "SQL",
  "AWS",
  "Docker",
  "Machine Learning",
  "System Design",
  "Communication",
  "Problem Solving",
  "Testing",
  "CI/CD"
];

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSkillsFromResume(resumeText, jobs) {
  const text = (resumeText || "").toLowerCase();
  if (!text) return [];
  const dynamicSkills = (jobs || []).flatMap((j) => j?.requiredSkills || []);
  const catalog = Array.from(new Set([...dynamicSkills, ...DEFAULT_SKILL_CATALOG])).filter(Boolean);
  const matches = [];
  for (const skill of catalog) {
    const re = new RegExp(`\\b${escapeRegExp(skill.toLowerCase())}\\b`, "i");
    if (re.test(text)) matches.push(skill);
  }
  return matches;
}

function buildSkillSnippetMap(resumeText, skills) {
  const out = {};
  if (!resumeText || !Array.isArray(skills)) return out;
  const rawLines = resumeText
    .split(/\r?\n|[.!?]\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const skill of skills) {
    const re = new RegExp(`\\b${escapeRegExp(skill)}\\b`, "i");
    const found = rawLines.find((line) => re.test(line)) || "";
    if (!found) continue;
    const snippet = found.length > 180 ? `${found.slice(0, 177)}...` : found;
    out[skill] = snippet;
  }
  return out;
}

function formatDuration(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function CandidateLayout({
  jobs,
  applications,
  resumeText,
  resumeStatus,
  resumeDetectedSkills,
  selectedJobId,
  setSelectedJobId,
  handleResumeChange,
  applyToJob,
  navigate
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end p-3">
        <div className="flex items-center gap-2">
          <AnimatedThemeToggler />
          <UserButton />
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 lg:grid-cols-2">
        <JobsTab
          jobs={jobs}
          selectedJobId={selectedJobId}
          setSelectedJobId={setSelectedJobId}
          handleResumeChange={handleResumeChange}
          resumeStatus={resumeStatus}
          resumeText={resumeText}
          resumeDetectedSkills={resumeDetectedSkills}
          applyToJob={applyToJob}
        />
        <AppliedJobsTab applications={applications} jobs={jobs} navigate={navigate} />
      </div>
    </div>
  );
}

function DashboardPage({
  email,
  fullName,
  isAdmin,
  jobs,
  applications,
  resumeStatus,
  resumeText,
  resumeDetectedSkills,
  adminJobForm,
  selectedJobId,
  setSelectedJobId,
  setAdminJobForm,
  handleResumeChange,
  createJob,
  applyToJob
}) {
  const navigate = useNavigate();
  return (
    <div className={isAdmin ? "mx-auto max-w-7xl space-y-4" : "space-y-4"}>
      {isAdmin ? (
        <div className="flex items-center justify-end p-3">
          <div className="flex items-center gap-2">
            <AnimatedThemeToggler />
            <UserButton />
          </div>
        </div>
      ) : null}

      {isAdmin ? (
        <AdminDashboard
          jobs={jobs}
          adminJobForm={adminJobForm}
          setAdminJobForm={setAdminJobForm}
          createJob={createJob}
        />
      ) : (
        <CandidateLayout
          jobs={jobs}
          applications={applications}
          resumeText={resumeText}
          resumeStatus={resumeStatus}
          resumeDetectedSkills={resumeDetectedSkills}
          selectedJobId={selectedJobId}
          setSelectedJobId={setSelectedJobId}
          handleResumeChange={handleResumeChange}
          applyToJob={applyToJob}
          navigate={navigate}
        />
      )}
    </div>
  );
}

function AssessmentPage({ email, fullName, authHeaders, refreshApplications }) {
  const { applicationId } = useParams();
  const [selectedSkill, setSelectedSkill] = useState("");
  const [descriptiveAnswer, setDescriptiveAnswer] = useState("");
  const [selectedMcqOption, setSelectedMcqOption] = useState(null);
  const [codeAnswer, setCodeAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [timerNow, setTimerNow] = useState(Date.now());
  const { isLoading: convexAuthLoading, isAuthenticated: convexAuthed } = useConvexAuth();

  const upsertMe = useMutation(api.users.upsertMe);
  const startAssessment = useMutation(api.assessments.startAssessment);
  const startSkillAssessment = useMutation(api.assessments.startSkillAssessment);
  const markQuestionStarted = useMutation(api.assessments.markQuestionStarted);
  const upsertSkillAnswerDraft = useMutation(api.assessments.upsertSkillAnswerDraft);
  const initializeSkillQuestions = useAction(api.assessments.initializeSkillQuestions);
  const submitSkillAnswer = useAction(api.assessments.submitSkillAnswer);

  const detail = useQuery(
    api.applications.getMyApplicationDetail,
    convexAuthed && applicationId ? { applicationIdRef: applicationId } : "skip"
  );
  const job = detail?.job || null;
  const application = detail?.application || null;
  const session = detail?.session || null;
  const result = detail?.result || null;

  const skillRow = useQuery(
    api.assessments.getSkillAssessment,
    convexAuthed && applicationId && selectedSkill
      ? { applicationIdRef: applicationId, skill: selectedSkill }
      : "skip"
  );
  const allSkillRows = useQuery(
    api.assessments.listSkillAssessmentsForApplication,
    convexAuthed && applicationId ? { applicationIdRef: applicationId } : "skip"
  );

  async function parseResponse(response) {
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch (_error) {
      return { error: text || `Request failed with status ${response.status}` };
    }
  }

  useEffect(() => {
    if (!applicationId || !email) return;
    if (applicationId.startsWith("app_")) {
      toast.error("This assessment link is from the old local-store format. Please reopen the assessment from the Dashboard list.");
      return;
    }
    if (!convexAuthed) return;
    upsertMe().catch(() => {});
    startAssessment({ applicationIdRef: applicationId }).catch((e) =>
      toast.error(e.message || "Failed to start assessment")
    );
  }, [applicationId, email, convexAuthed]);

  useEffect(() => {
    if (!applicationId || !selectedSkill || !job || result) return;
    if (skillRow && Array.isArray(skillRow.questions) && skillRow.questions.length === 7) return;
    if (busy) return;
    setBusy(true);
    startSkillAssessment({ applicationIdRef: applicationId, skill: selectedSkill })
      .then((id) => initializeSkillQuestions({ skillAssessmentId: id }))
      .catch((e) => toast.error(e.message || "Failed to initialize skill questions"))
      .finally(() => setBusy(false));
  }, [applicationId, selectedSkill, job, result, skillRow]);

  const skills = job?.requiredSkills || [];
  const activeQuestionIndex = skillRow ? Number(skillRow.questionIndex || 0) : 0;
  const activeQuestion = skillRow?.questions?.[activeQuestionIndex] || null;
  const currentDraft = useQuery(
    api.assessments.getSkillAnswerDraft,
    convexAuthed && skillRow && activeQuestion
      ? {
          skillAssessmentIdRef: skillRow._id,
          questionIndex: activeQuestionIndex
        }
      : "skip"
  );
  const skillSnippetMap = useMemo(
    () => buildSkillSnippetMap(application?.resumeTextSnapshot || "", skills),
    [application?.resumeTextSnapshot, skills.join("|")]
  );
  const bySkill = useMemo(() => {
    const rows = Array.isArray(allSkillRows) ? allSkillRows : [];
    return Object.fromEntries(rows.map((row) => [row.skill, row]));
  }, [allSkillRows]);
  const totalSkills = skills.length;
  const completedSkills = skills.filter((skill) => bySkill[skill]?.status === "completed").length;
  const totalQuestions = totalSkills * 7;
  const answeredQuestions = skills.reduce((acc, skill) => {
    const row = bySkill[skill];
    if (!row || !Array.isArray(row.questions)) return acc;
    const answered = row.questions.filter(
      (q) => typeof q.submittedAt === "number" || typeof q.score === "number"
    ).length;
    return acc + answered;
  }, 0);
  const overallProgressPct = totalQuestions
    ? Math.round((Math.min(answeredQuestions, totalQuestions) / totalQuestions) * 100)
    : 0;
  const elapsedSeconds = activeQuestion?.startedAt
    ? Math.max(0, Math.floor((timerNow - activeQuestion.startedAt) / 1000))
    : 0;

  useEffect(() => {
    if (!skills.length) return;
    if (!selectedSkill) setSelectedSkill(skills[0]);
  }, [skills.join(","), selectedSkill]);

  useEffect(() => {
    const timer = setInterval(() => setTimerNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!skillRow || !activeQuestion || skillRow.status === "completed") return;
    if (typeof activeQuestion.startedAt === "number") return;
    markQuestionStarted({
      skillAssessmentIdRef: skillRow._id,
      questionIndex: activeQuestionIndex
    }).catch(() => {});
  }, [skillRow?._id, skillRow?.status, activeQuestionIndex, activeQuestion?.startedAt]);

  useEffect(() => {
    if (!activeQuestion) return;
    if (activeQuestion.kind === "mcq") {
      setSelectedMcqOption(
        typeof currentDraft?.selectedOptionIndex === "number"
          ? currentDraft.selectedOptionIndex
          : typeof activeQuestion.selectedOptionIndex === "number"
            ? activeQuestion.selectedOptionIndex
            : null
      );
      setDescriptiveAnswer("");
      setCodeAnswer("");
      return;
    }
    if (activeQuestion.kind === "descriptive") {
      setDescriptiveAnswer(currentDraft?.answerText ?? activeQuestion.answerText ?? "");
      setSelectedMcqOption(null);
      setCodeAnswer("");
      return;
    }
    setCodeAnswer(
      currentDraft?.answerText ??
        activeQuestion.answerText ??
        activeQuestion.boilerplate ??
        ""
    );
    setSelectedMcqOption(null);
    setDescriptiveAnswer("");
  }, [
    selectedSkill,
    activeQuestionIndex,
    activeQuestion?.kind,
    activeQuestion?.boilerplate,
    activeQuestion?.answerText,
    activeQuestion?.selectedOptionIndex,
    currentDraft?._id,
    currentDraft?.answerText,
    currentDraft?.selectedOptionIndex
  ]);

  useEffect(() => {
    if (!skillRow || !activeQuestion || skillRow.status === "completed" || busy) return;
    const timeoutId = setTimeout(() => {
      if (activeQuestion.kind === "mcq") {
        upsertSkillAnswerDraft({
          skillAssessmentIdRef: skillRow._id,
          questionIndex: activeQuestionIndex,
          kind: "mcq",
          selectedOptionIndex:
            typeof selectedMcqOption === "number" ? selectedMcqOption : undefined
        }).catch(() => {});
        return;
      }
      if (activeQuestion.kind === "descriptive") {
        upsertSkillAnswerDraft({
          skillAssessmentIdRef: skillRow._id,
          questionIndex: activeQuestionIndex,
          kind: "descriptive",
          answerText: descriptiveAnswer
        }).catch(() => {});
        return;
      }
      upsertSkillAnswerDraft({
        skillAssessmentIdRef: skillRow._id,
        questionIndex: activeQuestionIndex,
        kind: "coding",
        answerText: codeAnswer
      }).catch(() => {});
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [
    skillRow?._id,
    skillRow?.status,
    activeQuestionIndex,
    activeQuestion?.kind,
    selectedMcqOption,
    descriptiveAnswer,
    codeAnswer,
    busy
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {convexAuthLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>Connecting to Convex…</CardTitle>
            <CardDescription>Waiting for authentication before loading skills.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}
      {!convexAuthLoading && !convexAuthed ? (
        <Card>
          <CardHeader>
            <CardTitle>Not authenticated</CardTitle>
            <CardDescription>
              Convex auth isn’t ready. This will prevent any assessment API calls.
              Try sign out/in after verifying Convex auth config.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
      <div className="space-y-2 rounded border p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">
              Assessment: {job?.title || "Job"} ({job?.jobId || ""})
            </p>
            <p className="text-sm text-muted-foreground">
              Status: {application?.assessmentStatus || "in_progress"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AnimatedThemeToggler />
            <Link to="/" className="text-sm underline">
              Back to Dashboard
            </Link>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Overall progress: {completedSkills}/{totalSkills || 0} skills · {answeredQuestions}/
              {totalQuestions || 0} questions
            </span>
            <span>{overallProgressPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.max(0, Math.min(100, overallProgressPct))}%` }}
            />
          </div>
        </div>
        {selectedSkill && skillSnippetMap[selectedSkill] ? (
          <p className="text-xs text-muted-foreground">
            Resume evidence for <span className="font-medium capitalize">{selectedSkill}</span>:{" "}
            <span className="italic">{skillSnippetMap[selectedSkill]}</span>
          </p>
        ) : null}
      </div>

      {detail === undefined && convexAuthed ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading…</CardTitle>
            <CardDescription>Fetching application and job details from Convex.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}
      {detail && !job ? (
        <Card>
          <CardHeader>
            <CardTitle>Job not found</CardTitle>
            <CardDescription>This application is not linked to a valid job.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}
      {job && skills.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No skills configured for this job</CardTitle>
            <CardDescription>
              The HR admin did not add required skills. Ask them to edit the job and add comma-separated skills.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {!job ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading assessment…</CardTitle>
            <CardDescription>Waiting for job and skills.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Tabs
        value={selectedSkill}
        onValueChange={(value) => {
          setSelectedSkill(value);
          setSelectedMcqOption(null);
          setDescriptiveAnswer("");
          setCodeAnswer("");
        }}
        className="w-full"
      >
        <Card>
          <CardHeader>
            <CardTitle>Skill Tabs</CardTitle>
            <CardDescription>Each tab runs chat only for that selected skill.</CardDescription>
          </CardHeader>
          <CardContent>
            <TabsList className="w-full flex-wrap justify-start gap-1">
              {skills.map((skill) => (
                <TabsTrigger key={skill} value={skill} className="capitalize">
                  {skill}
                </TabsTrigger>
              ))}
            </TabsList>
            {skills.some((skill) => skillSnippetMap[skill]) ? (
              <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                {skills.map((skill) =>
                  skillSnippetMap[skill] ? (
                    <p key={`${skill}-snippet`}>
                      <span className="font-medium capitalize">{skill}:</span>{" "}
                      <span className="italic">{skillSnippetMap[skill]}</span>
                    </p>
                  ) : null
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {skills.map((skill) => {
          const row = selectedSkill === skill ? skillRow : null;
          const questionIndex = row ? Number(row.questionIndex || 0) : 0;
          const currentQuestion = row?.questions?.[questionIndex] || null;
          const isCompleted = row?.status === "completed";
          return (
            <TabsContent key={skill} value={skill}>
              <Card>
                <CardHeader>
                  <CardTitle>AI Chat - {skill}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          Progress: {isCompleted ? "Completed" : `${Math.min(7, questionIndex + 1)}/7`}
                        </p>
                        {!isCompleted ? (
                          <p className="text-xs text-muted-foreground">
                            Timer (soft):{" "}
                            {activeQuestion?.startedAt ? formatDuration(elapsedSeconds) : "--:--"}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {currentDraft && !isCompleted ? (
                          <Badge variant="outline" title="Draft autosaved">
                            Draft saved
                          </Badge>
                        ) : null}
                        {isCompleted ? (
                          <Badge variant="secondary">
                            Skill score: {row?.skillScore ?? "-"}
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    {!row ? (
                      <p className="text-sm text-muted-foreground">
                        <AnimatedShinyText>Loading skill assessment…</AnimatedShinyText>
                      </p>
                    ) : row.questions?.length !== 7 ? (
                      <p className="text-sm text-muted-foreground">
                        <AnimatedShinyText>
                          {busy ? "Generating questions with AI…" : "Preparing questions…"}
                        </AnimatedShinyText>
                      </p>
                    ) : isCompleted ? (
                      <div className="space-y-3 text-sm">
                        <div className="space-y-1">
                          <p className="font-semibold">Conclusion</p>
                          <p className="text-muted-foreground">{row?.conclusion || "—"}</p>
                        </div>

                        {row?.learningPlan ? (
                          <div className="rounded border p-3 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">Plan</Badge>
                              <Badge variant="outline">Priority: {row.learningPlan.priority}</Badge>
                              <Badge variant="outline">
                                {row.learningPlan.currentLevel} → {row.learningPlan.targetLevel}
                              </Badge>
                              <Badge variant="outline">
                                ~{row.learningPlan.estimatedHours}h • {row.learningPlan.timelineWeeks}w
                              </Badge>
                            </div>

                            {row.learningPlan.focusAreas?.length ? (
                              <div>
                                <p className="font-semibold">Focus areas</p>
                                <ul className="ml-5 list-disc text-muted-foreground">
                                  {row.learningPlan.focusAreas.map((f, i) => (
                                    <li key={`fa-${i}`}>{f}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}

                            {row.learningPlan.weeklyMilestones?.length ? (
                              <div>
                                <p className="font-semibold">Timeline</p>
                                <ul className="ml-5 list-disc text-muted-foreground">
                                  {row.learningPlan.weeklyMilestones.map((m, i) => (
                                    <li key={`wm-${i}`}>{m}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}

                            {row.learningPlan.resources?.length ? (
                              <div>
                                <p className="font-semibold">Curated resources</p>
                                <ul className="ml-5 list-disc text-muted-foreground">
                                  {row.learningPlan.resources.map((r, i) => (
                                    <li key={`rs-${i}`}>
                                      {r.link ? (
                                        <a className="underline" href={r.link} target="_blank" rel="noreferrer">
                                          {r.title}
                                        </a>
                                      ) : (
                                        r.title
                                      )}
                                      {r.type ? (
                                        <span className="ml-1 text-xs">({r.type})</span>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}

                            {row.learningPlan.adjacentSkills?.length ? (
                              <div>
                                <p className="font-semibold">Adjacent skills</p>
                                <p className="text-muted-foreground">
                                  {row.learningPlan.adjacentSkills.join(", ")}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : currentQuestion ? (
                      <ChatContainer className="space-y-3">
                        <Message role="assistant">
                          <div className="space-y-1">
                            <p className="text-xs opacity-80">
                              {currentQuestion.kind === "mcq"
                                ? "MCQ"
                                : currentQuestion.kind === "coding"
                                  ? `Coding (${currentQuestion.language || "code"})`
                                  : "Descriptive"}{" "}
                              • Question {questionIndex + 1}
                            </p>
                            <p className="whitespace-pre-wrap">{currentQuestion.prompt}</p>
                          </div>
                        </Message>

                        {currentQuestion.kind === "mcq" ? (
                          <div className="space-y-2">
                            {(currentQuestion.options || []).map((opt, idx) => {
                              const selected = selectedSkill === skill && selectedMcqOption === idx;
                              return (
                                <button
                                  key={`${skill}-opt-${idx}`}
                                  type="button"
                                  onClick={() => {
                                    setSelectedSkill(skill);
                                    setSelectedMcqOption(idx);
                                  }}
                                  className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                                    selected
                                      ? "border-primary bg-primary/10 text-foreground"
                                      : "border-border bg-background hover:bg-muted"
                                  }`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                            <div className="flex justify-end">
                              <Button
                                disabled={busy || selectedMcqOption === null}
                                onClick={async () => {
                                  try {
                                    setBusy(true);
                                    await submitSkillAnswer({
                                      applicationIdRef: applicationId,
                                      skill,
                                      selectedOptionIndex: selectedMcqOption
                                    });
                                    setSelectedMcqOption(null);
                                    toast.success("Answer submitted.");
                                    refreshApplications().catch(() => {});
                                  } catch (e) {
                                    toast.error(e.message || "Failed to submit answer");
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                              >
                                Submit answer
                              </Button>
                            </div>
                          </div>
                        ) : currentQuestion.kind === "coding" ? (
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="secondary">
                                Language: {currentQuestion.language || "code"}
                              </Badge>
                              <span>Implement the function in the editor below.</span>
                            </div>
                            <div className="overflow-hidden rounded-md border">
                              <Editor
                                height="360px"
                                language={
                                  MONACO_LANGUAGE_MAP[currentQuestion.language] ||
                                  "plaintext"
                                }
                                value={
                                  selectedSkill === skill
                                    ? codeAnswer
                                    : currentQuestion.boilerplate || ""
                                }
                                theme="vs-dark"
                                onChange={(value) => setCodeAnswer(value ?? "")}
                                options={{
                                  minimap: { enabled: false },
                                  fontSize: 13,
                                  scrollBeyondLastLine: false,
                                  automaticLayout: true,
                                  tabSize: 2
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                  setCodeAnswer(currentQuestion.boilerplate || "")
                                }
                              >
                                Reset to boilerplate
                              </Button>
                              <Button
                                disabled={busy || !codeAnswer.trim()}
                                onClick={async () => {
                                  try {
                                    setBusy(true);
                                    await submitSkillAnswer({
                                      applicationIdRef: applicationId,
                                      skill,
                                      answerText: codeAnswer
                                    });
                                    toast.success("Code submitted.");
                                    refreshApplications().catch(() => {});
                                  } catch (e) {
                                    toast.error(e.message || "Failed to submit answer");
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                              >
                                Submit code
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <PromptInput
                            value={selectedSkill === skill ? descriptiveAnswer : ""}
                            onChange={(e) => setDescriptiveAnswer(e.target.value)}
                            placeholder={`Your answer for ${skill}...`}
                            disabled={busy}
                            onSubmit={async () => {
                              try {
                                setBusy(true);
                                await submitSkillAnswer({
                                  applicationIdRef: applicationId,
                                  skill,
                                  answerText: descriptiveAnswer.trim()
                                });
                                setDescriptiveAnswer("");
                                toast.success("Answer submitted.");
                                refreshApplications().catch(() => {});
                              } catch (e) {
                                toast.error(e.message || "Failed to submit answer");
                              } finally {
                                setBusy(false);
                              }
                            }}
                          />
                        )}

                        {busy && selectedSkill === skill ? (
                          <ThinkingBar text="AI is grading your answer..." />
                        ) : null}

                        {typeof currentQuestion.score === "number" ? (
                          <Message role="assistant">
                            <div>
                              <p className="font-medium">Last score: {currentQuestion.score}</p>
                              <p className="text-muted-foreground">{currentQuestion.feedback || ""}</p>
                            </div>
                          </Message>
                        ) : null}
                      </ChatContainer>
                    ) : (
                      <p className="text-sm text-muted-foreground">No question available.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle>Final Assessment Result</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>Base Score: <strong>{result.baseScore}</strong></p>
            <p>Final Score: <strong>{result.finalScore}</strong></p>
            <p>Recommendation: <strong>{result.recommendation}</strong></p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function App() {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() || "";
  const fullName = user?.fullName || "";
  const isAdmin = useMemo(() => {
    const admins = (import.meta.env.VITE_ADMIN_EMAILS || "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    return admins.includes(email);
  }, [email]);

  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [resumeStatus, setResumeStatus] = useState("Upload PDF to begin.");
  const [resumeText, setResumeText] = useState("");
  const [resumeDetectedSkills, setResumeDetectedSkills] = useState([]);
  const [adminJobForm, setAdminJobForm] = useState({
    jobId: "",
    title: "",
    description: "",
    requiredSkills: ""
  });
  const [selectedJobId, setSelectedJobId] = useState("");
  const { isAuthenticated: convexAuthed } = useConvexAuth();

  const upsertMe = useMutation(api.users.upsertMe);
  const convexJobs = useQuery(isAdmin ? api.jobs.listJobsAdmin : api.jobs.listJobs, convexAuthed ? {} : "skip");
  const convexApps = useQuery(api.applications.listMyApplications, convexAuthed ? {} : "skip");
  const createJobMutation = useMutation(api.jobs.createJob);
  const applyToJobMutation = useMutation(api.applications.applyToJob);

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      "x-user-email": email,
      "x-user-name": fullName
    };
  }

  async function parseResponse(response) {
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch (_error) {
      return { error: text || `Request failed with status ${response.status}` };
    }
  }

  async function loadJobs() {
    setJobs(Array.isArray(convexJobs) ? convexJobs : []);
  }

  async function loadMyApplications() {
    if (!email) return;
    setApplications(Array.isArray(convexApps) ? convexApps : []);
  }

  async function loadAdminJobs() {
    if (!email || !isAdmin) return;
    setJobs(Array.isArray(convexJobs) ? convexJobs : []);
  }

  useEffect(() => {
    if (!convexAuthed) return;
    if (Array.isArray(convexJobs)) setJobs(convexJobs);
  }, [convexJobs, convexAuthed]);

  useEffect(() => {
    if (!convexAuthed) return;
    if (Array.isArray(convexApps)) setApplications(convexApps);
  }, [convexApps, convexAuthed]);

  useEffect(() => {
    if (!resumeText.trim()) return;
    setResumeDetectedSkills(extractSkillsFromResume(resumeText, jobs));
  }, [resumeText, jobs]);

  async function loadCompanyConfig() {
    const response = await fetch("/api/company-config");
    await response.json();
  }

  async function loadLlmStatus() {
    const response = await fetch("/api/llm-status");
    await response.json();
  }

  async function parseResumePdf(file) {
    const body = new FormData();
    body.append("resumePdf", file);
    const response = await fetch("/api/parse-resume-pdf", { method: "POST", body });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to parse resume PDF.");
    return data.resumeText || "";
  }

  async function createJob() {
    try {
      const payload = {
        ...adminJobForm,
        requiredSkills: adminJobForm.requiredSkills
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
      };
      await createJobMutation(payload);
    } catch (e) {
      toast.error(e.message || "Failed to create job");
      return;
    }
    setAdminJobForm({ jobId: "", title: "", description: "", requiredSkills: "" });
    await loadAdminJobs();
    toast.success("Job created successfully.");
  }

  async function applyToJob(jobId, options = {}) {
    if (!resumeText.trim()) {
      toast.error("Please upload a resume PDF first.");
      return;
    }
    try {
      const applicationId = await applyToJobMutation({
        jobIdRef: jobId,
        resumeFileName: "resume.pdf",
        resumeTextSnapshot: resumeText
      });
      if (options.startNow && applicationId) {
        setSelectedJobId("");
        setResumeText("");
        setResumeDetectedSkills([]);
        setResumeStatus("Upload PDF to begin.");
        window.location.href = `/assessment/${applicationId}`;
        return;
      }
    } catch (e) {
      toast.error(e.message || "Failed to apply");
      return;
    }
    setSelectedJobId("");
    setResumeDetectedSkills([]);
    await loadMyApplications();
    toast.success("Applied successfully. You can take the assessment later.");
  }

  async function handleResumeChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setResumeStatus("Parsing PDF...");
    try {
      const extracted = await parseResumePdf(file);
      setResumeText(extracted);
      setResumeDetectedSkills(extractSkillsFromResume(extracted, jobs));
      setResumeStatus(`Parsed: ${file.name}`);
      toast.success("Resume parsed successfully.");
    } catch (error) {
      setResumeStatus("Failed to parse PDF");
      setResumeText("");
      setResumeDetectedSkills([]);
      toast.error(error.message);
    }
  }

  useEffect(() => {
    if (!email) return;
    if (!convexAuthed) return;
    upsertMe().catch(() => {});
    loadMyApplications().catch(() => {});
    if (isAdmin) {
      loadAdminJobs().catch(() => {});
    } else {
      loadJobs().catch(() => {});
    }
  }, [email, isAdmin, convexAuthed]);

  useEffect(() => {
    loadCompanyConfig().catch(() => {});
    loadLlmStatus().catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("theme");
    const initial = stored ? stored === "dark" : true;
    document.documentElement.classList.toggle("dark", initial);
    if (!stored) {
      try {
        window.localStorage.setItem("theme", "dark");
      } catch (_e) {
        // ignore storage errors
      }
    }
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground p-4">
      <Toaster richColors position="top-right" />
      <SignedOut>
        <div className="fixed inset-0 grid grid-cols-1 md:grid-cols-[60%_40%]">
          <div className="flex items-center justify-center border-b border-white bg-black p-8 md:border-b-0 md:border-r">
            <PixelImage
              src="https://foundern.com/wp-content/uploads/2026/03/fn-studio-web-1-3-1140x570.png"
              customGrid={{ rows: 4, cols: 6 }}
              grayscaleAnimation={false}
              className="aspect-[1140/570] h-auto w-full max-w-3xl md:h-auto md:w-full md:max-w-[50rem]"
              imgClassName="rounded-2xl"
            />
          </div>
          <div className="flex items-center justify-center bg-background p-8">
            <Card className="flex w-full max-w-sm border-border/80 text-center shadow-md md:h-[min(28rem,calc((60vw-4rem)/2))]">
              <CardContent className="flex w-full flex-col justify-center gap-3 p-6">
                <CardTitle>Skill Assessment Portal</CardTitle>
                <CardDescription>
                  Sign in to access jobs, applications, and assessments.
                </CardDescription>
                <div className="pt-1">
                  <SignInButton mode="modal">
                    <Button className="w-full">Sign In</Button>
                  </SignInButton>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </SignedOut>
      <SignedIn>
        <Routes>
          <Route
            path="/"
            element={
              <DashboardPage
                email={email}
                fullName={fullName}
                isAdmin={isAdmin}
                jobs={jobs}
                applications={applications}
                resumeStatus={resumeStatus}
                resumeText={resumeText}
                resumeDetectedSkills={resumeDetectedSkills}
                adminJobForm={adminJobForm}
                selectedJobId={selectedJobId}
                setSelectedJobId={setSelectedJobId}
                setAdminJobForm={setAdminJobForm}
                handleResumeChange={handleResumeChange}
                createJob={createJob}
                applyToJob={applyToJob}
              />
            }
          />
          <Route
            path="/assessment/:applicationId"
            element={
              <AssessmentPage
                email={email}
                fullName={fullName}
                authHeaders={authHeaders}
                refreshApplications={loadMyApplications}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SignedIn>
    </main>
  );
}

export default App;
