import { useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Circle,
  ExternalLink,
  GraduationCap,
  RefreshCw,
  Search,
  Sparkles
} from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { getSafeResourceLink } from "../../lib/resource-links";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

function priorityTone(p) {
  if (p === "High") return "bg-rose-500/15 text-rose-500 border-rose-500/40";
  if (p === "Medium") return "bg-amber-500/15 text-amber-500 border-amber-500/40";
  return "bg-emerald-500/15 text-emerald-500 border-emerald-500/40";
}

function MilestoneRow({ index, text, milestone, busy, onToggle }) {
  const completed = !!milestone?.completed;
  return (
    <li className="flex items-start gap-2 rounded-md border p-2">
      <button
        type="button"
        className="mt-0.5 shrink-0"
        disabled={busy}
        onClick={() => onToggle(!completed)}
        title={completed ? "Mark as not done" : "Mark as done"}
      >
        {completed ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      <span className={`text-sm ${completed ? "text-muted-foreground line-through" : ""}`}>
        {text}
      </span>
    </li>
  );
}

function ResourceRow({ resource, skill }) {
  if (!resource) return null;
  const { url, source } = getSafeResourceLink(resource, skill);
  const Icon = source === "search" ? Search : BookOpen;
  return (
    <li className="flex items-start gap-2 text-xs">
      <span className="mt-0.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
      <div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 underline"
        >
          {resource.title}
          <ExternalLink className="h-3 w-3" />
        </a>
        <span className="ml-1 text-muted-foreground">({resource.type})</span>
        {source === "search" ? (
          <span className="ml-1 text-[10px] text-muted-foreground">— web search</span>
        ) : null}
      </div>
    </li>
  );
}

function RefresherQuizCard({ skillAssessmentId, refreshers }) {
  const generate = useAction(api.learning.generateRefresherQuiz);
  const submit = useMutation(api.learning.submitRefresherAnswers);
  const active = useQuery(
    api.learning.getActiveRefresher,
    skillAssessmentId ? { skillAssessmentIdRef: skillAssessmentId } : "skip"
  );
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);

  const completedHistory = (refreshers || []).filter((r) => r.status === "completed");
  const inProgress = active && active.status === "in_progress" ? active : null;

  function setAnswer(qIndex, optIndex) {
    setAnswers((p) => ({ ...p, [qIndex]: optIndex }));
  }

  async function handleGenerate() {
    try {
      setBusy(true);
      await generate({ skillAssessmentIdRef: skillAssessmentId });
      setAnswers({});
      toast.success("Refresher quiz ready.");
    } catch (e) {
      toast.error(e.message || "Could not generate refresher");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    if (!inProgress) return;
    const ordered = inProgress.questions.map((_, i) =>
      Number.isFinite(answers[i]) ? Number(answers[i]) : -1
    );
    if (ordered.some((v) => v < 0)) {
      toast.error("Answer all questions before submitting.");
      return;
    }
    try {
      setBusy(true);
      const out = await submit({
        refresherQuizIdRef: inProgress._id,
        answers: ordered
      });
      toast.success(`Refresher score: ${out.score}%`);
    } catch (e) {
      toast.error(e.message || "Could not submit refresher");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Refresher quiz</p>
          <p className="text-xs text-muted-foreground">
            5 quick MCQs targeting your learning plan focus areas.
          </p>
        </div>
        <div className="flex gap-2">
          {!inProgress ? (
            <Button size="sm" onClick={handleGenerate} disabled={busy}>
              <Sparkles className="mr-2 h-4 w-4" />
              {busy ? "Generating…" : "Take refresher"}
            </Button>
          ) : null}
        </div>
      </div>

      {inProgress ? (
        <div className="mt-3 space-y-3">
          {inProgress.questions.map((q, i) => (
            <div key={`q-${i}`} className="rounded border p-2 text-sm">
              <p className="mb-2 font-medium">
                Q{i + 1}. {q.prompt}
              </p>
              <div className="space-y-1">
                {q.options.map((opt, oi) => {
                  const selected = answers[i] === oi;
                  return (
                    <button
                      type="button"
                      key={`q-${i}-opt-${oi}`}
                      onClick={() => setAnswer(i, oi)}
                      className={`w-full rounded-md border px-3 py-1.5 text-left text-xs transition-colors ${
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSubmit} disabled={busy}>
              Submit refresher
            </Button>
          </div>
        </div>
      ) : null}

      {completedHistory.length ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium">History</p>
          {completedHistory.slice(0, 3).map((r) => (
            <div
              key={r._id}
              className="flex items-center justify-between rounded border bg-muted/30 px-2 py-1 text-xs"
            >
              <span>
                {r.completedAt
                  ? new Date(r.completedAt).toLocaleDateString()
                  : "Completed"}
              </span>
              <span className="font-mono">{r.score}%</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SkillCard({ entry }) {
  const setMilestone = useMutation(api.learning.setMilestoneStatus);
  const [busyIndex, setBusyIndex] = useState(-1);
  const lp = entry.learningPlan;
  const milestoneByIdx = useMemo(() => {
    const map = {};
    for (const m of entry.milestones || []) map[m.milestoneIndex] = m;
    return map;
  }, [entry.milestones]);
  const totalMilestones = lp?.weeklyMilestones?.length || 0;
  const doneMilestones = (entry.milestones || []).filter((m) => m.completed).length;
  const progressPct = totalMilestones
    ? Math.round((Math.min(doneMilestones, totalMilestones) / totalMilestones) * 100)
    : 0;

  async function toggleMilestone(index, completed) {
    try {
      setBusyIndex(index);
      await setMilestone({
        skillAssessmentIdRef: entry._id,
        milestoneIndex: index,
        completed
      });
    } catch (e) {
      toast.error(e.message || "Could not update milestone");
    } finally {
      setBusyIndex(-1);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="capitalize">{entry.skill}</CardTitle>
          {typeof entry.skillScore === "number" ? (
            <Badge variant="secondary">Score {entry.skillScore}</Badge>
          ) : null}
          {lp?.priority ? (
            <span className={`rounded-md border px-2 py-0.5 text-xs ${priorityTone(lp.priority)}`}>
              {lp.priority} priority
            </span>
          ) : null}
          {lp?.currentLevel && lp?.targetLevel ? (
            <Badge variant="outline" className="text-[11px]">
              {lp.currentLevel} → {lp.targetLevel}
            </Badge>
          ) : null}
        </div>
        <CardDescription>{entry.conclusion}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Milestones: {doneMilestones}/{totalMilestones}
            </span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {totalMilestones ? (
          <ul className="space-y-1">
            {lp.weeklyMilestones.map((text, i) => (
              <MilestoneRow
                key={`ms-${entry._id}-${i}`}
                index={i}
                text={text}
                milestone={milestoneByIdx[i]}
                busy={busyIndex === i}
                onToggle={(next) => toggleMilestone(i, next)}
              />
            ))}
          </ul>
        ) : null}

        {Array.isArray(lp?.focusAreas) && lp.focusAreas.length ? (
          <div>
            <p className="text-xs font-medium">Focus areas</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {lp.focusAreas.map((f, i) => (
                <Badge key={`fa-${entry._id}-${i}`} variant="outline" className="text-[10px]">
                  {f}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {Array.isArray(lp?.resources) && lp.resources.length ? (
          <div>
            <p className="text-xs font-medium">Resources</p>
            <ul className="mt-1 space-y-1">
              {lp.resources.map((r, i) => (
                <ResourceRow
                  key={`rs-${entry._id}-${i}`}
                  resource={r}
                  skill={entry.skill}
                />
              ))}
            </ul>
          </div>
        ) : null}

        <RefresherQuizCard
          skillAssessmentId={entry._id}
          refreshers={entry.refreshers}
        />
      </CardContent>
    </Card>
  );
}

function RecommendedJobsList() {
  const recommended = useQuery(api.learning.getRecommendedJobs, { minScore: 70 });
  if (recommended === undefined) {
    return <p className="text-sm text-muted-foreground">Loading recommendations…</p>;
  }
  if (!recommended.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Once you complete a skill assessment with a strong score (or pass a refresher), matching open jobs will appear here.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {recommended.map((rec) => (
        <div key={rec.job._id} className="rounded border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{rec.job.title}</p>
              <p className="text-xs text-muted-foreground">{rec.job.jobId}</p>
            </div>
            <Badge variant="secondary" className="font-mono">
              {rec.matchPct}% skill match
            </Badge>
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {rec.job.description}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {rec.metSkills.map((s) => (
              <Badge key={`met-${rec.job._id}-${s}`} variant="default" className="text-[10px]">
                ✓ {s}
              </Badge>
            ))}
            {rec.gapSkills.map((s) => (
              <Badge key={`gap-${rec.job._id}-${s}`} variant="outline" className="text-[10px]">
                ✗ {s}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function LearningPage() {
  const overview = useQuery(api.learning.getCandidateLearningOverview, {});
  const [tab, setTab] = useState("plan");

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <GraduationCap className="h-6 w-6" /> Learning hub
          </h1>
          <p className="text-sm text-muted-foreground">
            Track your learning plans, take refreshers, and see internal jobs that match your growth.
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm underline-offset-4 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="plan">My learning plans</TabsTrigger>
          <TabsTrigger value="recommended">Recommended jobs</TabsTrigger>
        </TabsList>
        <TabsContent value="plan">
          {overview === undefined ? (
            <Card>
              <CardHeader>
                <CardDescription>Loading your learning plans…</CardDescription>
              </CardHeader>
            </Card>
          ) : !overview.skillAssessments?.length ? (
            <Card>
              <CardHeader>
                <CardTitle>No learning plans yet</CardTitle>
                <CardDescription>
                  Complete at least one skill assessment to receive a personalized learning plan.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {overview.skillAssessments.map((entry) => (
                <SkillCard key={entry._id} entry={entry} />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="recommended">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" /> Internal jobs that match your growth
              </CardTitle>
              <CardDescription>
                Roles whose required skills overlap with skills where you've reached your target level.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecommendedJobsList />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
