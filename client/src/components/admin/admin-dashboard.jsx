import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Legend
} from "recharts";
import {
  Briefcase,
  Download,
  Edit3,
  Mail,
  RefreshCw,
  Save,
  ShieldCheck,
  Users,
  X
} from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "../ui/card";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "../ui/table";
import { Select } from "../ui/select";
import {
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ChartTooltipContent
} from "../ui/chart";

function statusBadgeVariant(status) {
  if (status === "open") return "default";
  if (status === "draft") return "secondary";
  if (status === "closed") return "outline";
  return "outline";
}

function formatDate(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString();
  } catch {
    return "—";
  }
}

function formatSeconds(seconds) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "—";
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function downloadCsv(filename, rows) {
  if (!rows.length) {
    toast.error("Nothing to export.");
    return;
  }
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function ManageTab({ jobs, adminJobForm, setAdminJobForm, createJob }) {
  const updateJobStatus = useMutation(api.jobs.updateJobStatus);
  const updateJob = useMutation(api.jobs.updateJob);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", requiredSkills: "" });

  function startEdit(job) {
    setEditing(job._id);
    setForm({
      title: job.title || "",
      description: job.description || "",
      requiredSkills: (job.requiredSkills || []).join(", ")
    });
  }

  async function saveEdit() {
    try {
      await updateJob({
        jobIdRef: editing,
        title: form.title,
        description: form.description,
        requiredSkills: form.requiredSkills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      });
      toast.success("Job updated.");
      setEditing(null);
    } catch (e) {
      toast.error(e.message || "Failed to update job");
    }
  }

  async function changeStatus(jobIdRef, status) {
    try {
      await updateJobStatus({ jobIdRef, status });
      toast.success(`Status set to ${status}.`);
    } catch (e) {
      toast.error(e.message || "Failed to update status");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.3fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" /> Create Job
          </CardTitle>
          <CardDescription>HR creates jobs with a unique job ID</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            placeholder="Job ID"
            value={adminJobForm.jobId}
            onChange={(e) => setAdminJobForm((p) => ({ ...p, jobId: e.target.value }))}
          />
          <Input
            placeholder="Title"
            value={adminJobForm.title}
            onChange={(e) => setAdminJobForm((p) => ({ ...p, title: e.target.value }))}
          />
          <Textarea
            placeholder="Description"
            value={adminJobForm.description}
            onChange={(e) =>
              setAdminJobForm((p) => ({ ...p, description: e.target.value }))
            }
          />
          <Input
            placeholder="Required skills (comma-separated)"
            value={adminJobForm.requiredSkills}
            onChange={(e) =>
              setAdminJobForm((p) => ({ ...p, requiredSkills: e.target.value }))
            }
          />
          <Button onClick={createJob}>Create Job</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Jobs
          </CardTitle>
          <CardDescription>Edit details, change status (draft / open / closed)</CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs created yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j._id}>
                    <TableCell>
                      <div className="font-medium">{j.title}</div>
                      <div className="text-xs text-muted-foreground">{j.jobId}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(j.requiredSkills || []).slice(0, 4).map((s) => (
                          <Badge key={s} variant="outline" className="capitalize">
                            {s}
                          </Badge>
                        ))}
                        {(j.requiredSkills || []).length > 4 ? (
                          <Badge variant="outline">+{j.requiredSkills.length - 4}</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(j.status)} className="capitalize">
                        {j.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Select
                          value={j.status}
                          onValueChange={(v) => changeStatus(j._id, v)}
                          className="w-28"
                        >
                          <option value="draft">draft</option>
                          <option value="open">open</option>
                          <option value="closed">closed</option>
                        </Select>
                        <Button size="sm" variant="outline" onClick={() => startEdit(j)}>
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {editing ? (
            <div className="mt-4 space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Editing job</p>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Input
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
              <Textarea
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
              <Input
                placeholder="Required skills (comma-separated)"
                value={form.requiredSkills}
                onChange={(e) =>
                  setForm((p) => ({ ...p, requiredSkills: e.target.value }))
                }
              />
              <div className="flex justify-end">
                <Button onClick={saveEdit}>
                  <Save className="mr-2 h-4 w-4" /> Save
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ApplicantsTab({ jobs, selectedJobId, setSelectedJobId }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

  const detail = useQuery(
    api.analytics.jobApplicantsDetail,
    selectedJobId ? { jobIdRef: selectedJobId } : "skip"
  );

  const rows = useMemo(() => {
    if (!detail) return [];
    let r = [...detail.rows];
    if (filter !== "all") r = r.filter((x) => x.assessmentStatus === filter);
    const q = search.trim().toLowerCase();
    if (q)
      r = r.filter((x) =>
        (x.candidateEmail + " " + (x.candidateName || "")).toLowerCase().includes(q)
      );
    r.sort((a, b) => (b.finalScore ?? -1) - (a.finalScore ?? -1));
    return r;
  }, [detail, filter, search]);

  function exportCsv() {
    if (!detail) return;
    const skills = detail.job.requiredSkills || [];
    const rowsForCsv = rows.map((r, i) => {
      const base = {
        rank: i + 1,
        email: r.candidateEmail,
        name: r.candidateName,
        appliedAt: r.appliedAt ? new Date(r.appliedAt).toISOString() : "",
        status: r.assessmentStatus,
        finalScore: r.finalScore ?? "",
        recommendation: r.recommendation ?? ""
      };
      for (const s of skills) {
        base[`skill:${s}`] = r.skillScores?.[s]?.score ?? "";
      }
      return base;
    });
    const slug = (detail.job.jobId || "job").replace(/[^a-z0-9_-]+/gi, "_");
    downloadCsv(`applicants-${slug}.csv`, rowsForCsv);
  }

  function emailCandidate(row) {
    if (!row.candidateEmail) return;
    const subject = encodeURIComponent(
      `Your assessment for ${detail?.job?.title || "the role"}`
    );
    const lines = [
      `Hi ${row.candidateName || row.candidateEmail},`,
      "",
      `Thanks for completing the assessment for ${detail?.job?.title} (${detail?.job?.jobId}).`,
      `Final score: ${row.finalScore ?? "—"}`,
      `Recommendation: ${row.recommendation ?? "—"}`,
      "",
      "We'll be in touch with next steps."
    ].join("\n");
    const body = encodeURIComponent(lines);
    window.location.href = `mailto:${row.candidateEmail}?subject=${subject}&body=${body}`;
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Applicants
          </CardTitle>
          <CardDescription>Pick a job, filter, drill in, export CSV.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              placeholder="Select a job"
              value={selectedJobId || ""}
              onValueChange={(v) => setSelectedJobId(v)}
              className="w-72"
            >
              {jobs.map((j) => (
                <option key={j._id} value={j._id}>
                  {j.jobId} — {j.title}
                </option>
              ))}
            </Select>
            <Select value={filter} onValueChange={setFilter} className="w-44">
              <option value="all">All statuses</option>
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </Select>
            <Input
              className="w-64"
              placeholder="Search email or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={exportCsv} disabled={!detail || !rows.length}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedJobId ? (
        <Card>
          <CardHeader>
            <CardDescription>Select a job above to view applicants.</CardDescription>
          </CardHeader>
        </Card>
      ) : !detail ? (
        <Card>
          <CardHeader>
            <CardDescription>Loading applicants…</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No applicants match.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Final</TableHead>
                    <TableHead>Median / Q</TableHead>
                    <TableHead>Per-skill scores</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, idx) => (
                    <ApplicantRow
                      key={r.applicationId}
                      row={r}
                      idx={idx}
                      skills={detail.job.requiredSkills || []}
                      expanded={expanded === r.applicationId}
                      onToggle={() =>
                        setExpanded(expanded === r.applicationId ? null : r.applicationId)
                      }
                      onEmail={() => emailCandidate(r)}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ApplicantRow({ row, idx, skills, expanded, onToggle, onEmail }) {
  const detail = useQuery(
    api.analytics.getApplicationDetailAdmin,
    expanded ? { applicationIdRef: row.applicationId } : "skip"
  );
  return (
    <>
      <TableRow>
        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
        <TableCell>
          <div className="font-medium">{row.candidateEmail}</div>
          {row.candidateName ? (
            <div className="text-xs text-muted-foreground">{row.candidateName}</div>
          ) : null}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {formatDate(row.appliedAt)}
        </TableCell>
        <TableCell>
          <Badge
            variant={
              row.assessmentStatus === "completed"
                ? "default"
                : row.assessmentStatus === "in_progress"
                  ? "secondary"
                  : "outline"
            }
            className="capitalize"
          >
            {row.assessmentStatus.replace("_", " ")}
          </Badge>
        </TableCell>
        <TableCell className="font-mono text-sm">
          {row.finalScore ?? "—"}
        </TableCell>
        <TableCell className="font-mono text-sm">
          {formatSeconds(row.medianTimePerQuestionSec)}
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {skills.map((s) => {
              const sc = row.skillScores?.[s];
              if (!sc) return (
                <Badge key={s} variant="outline" className="font-mono">
                  {s}: —
                </Badge>
              );
              return (
                <Badge
                  key={s}
                  variant={typeof sc.score === "number" ? "secondary" : "outline"}
                  className="font-mono"
                >
                  {s}: {typeof sc.score === "number" ? sc.score : "…"}
                </Badge>
              );
            })}
          </div>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Button variant="outline" size="sm" onClick={onEmail} title="Email candidate">
              <Mail className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={onToggle}>
              {expanded ? "Hide" : "View"}
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {expanded ? (
        <TableRow>
          <TableCell colSpan={8}>
            {!detail ? (
              <p className="text-xs text-muted-foreground">Loading details…</p>
            ) : (
              <ApplicantDetail detail={detail} />
            )}
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function ApplicantDetail({ detail }) {
  const skills = detail?.skills || [];
  return (
    <div className="space-y-3">
      {skills.length === 0 ? (
        <p className="text-xs text-muted-foreground">No skill assessments yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {skills.map((s) => (
            <div key={s._id} className="rounded-md border p-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="font-semibold capitalize">{s.skill}</p>
                <Badge
                  variant={s.status === "completed" ? "default" : "secondary"}
                  className="capitalize"
                >
                  {s.status.replace("_", " ")}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Score: <span className="font-mono">{s.skillScore ?? "—"}</span>
              </div>
              {s.conclusion ? (
                <p className="mt-1 text-xs text-muted-foreground">{s.conclusion}</p>
              ) : null}
              {Array.isArray(s.questions) && s.questions.length ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    View question breakdown ({s.questions.length})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {s.questions.map((q, i) => (
                      <div key={i} className="rounded border p-2 text-xs">
                        <p className="font-medium capitalize">
                          Q{i + 1} • {q.kind}{" "}
                          {typeof q.score === "number" ? `• score ${q.score}` : ""}
                        </p>
                        <p className="text-muted-foreground whitespace-pre-wrap">{q.prompt}</p>
                        {q.kind === "mcq" && Array.isArray(q.options) ? (
                          <p className="mt-1">
                            Selected:{" "}
                            <span className="font-mono">
                              {typeof q.selectedOptionIndex === "number"
                                ? q.options[q.selectedOptionIndex]
                                : "—"}
                            </span>
                          </p>
                        ) : q.kind === "coding" ? (
                          <pre className="mt-1 whitespace-pre-wrap rounded bg-muted/50 p-2 font-mono text-[11px]">
                            {q.answerText || "(no submission)"}
                          </pre>
                        ) : (
                          <p className="mt-1 whitespace-pre-wrap">{q.answerText || "—"}</p>
                        )}
                        {q.feedback ? (
                          <p className="mt-1 italic text-muted-foreground">{q.feedback}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CompareTab({ jobs, selectedJobId, setSelectedJobId }) {
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const detail = useQuery(
    api.analytics.jobApplicantsDetail,
    selectedJobId ? { jobIdRef: selectedJobId } : "skip"
  );

  useEffect(() => {
    setAId("");
    setBId("");
  }, [selectedJobId]);

  const completed = useMemo(
    () => (detail?.rows || []).filter((r) => r.assessmentStatus === "completed"),
    [detail]
  );
  const a = completed.find((r) => r.applicationId === aId) || null;
  const b = completed.find((r) => r.applicationId === bId) || null;

  const skills = detail?.job?.requiredSkills || [];
  const chartData = useMemo(() => {
    return skills.map((s) => ({
      skill: s,
      candidateA: a?.skillScores?.[s]?.score ?? 0,
      candidateB: b?.skillScores?.[s]?.score ?? 0
    }));
  }, [skills, a, b]);

  const config = {
    candidateA: { label: a?.candidateEmail || "Candidate A", color: "hsl(var(--chart-1))" },
    candidateB: { label: b?.candidateEmail || "Candidate B", color: "hsl(var(--chart-3))" }
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>Compare candidates</CardTitle>
          <CardDescription>Pick a job, then two completed candidates.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              placeholder="Select a job"
              value={selectedJobId || ""}
              onValueChange={setSelectedJobId}
              className="w-72"
            >
              {jobs.map((j) => (
                <option key={j._id} value={j._id}>
                  {j.jobId} — {j.title}
                </option>
              ))}
            </Select>
            <Select
              placeholder="Candidate A"
              value={aId}
              onValueChange={setAId}
              className="w-72"
              disabled={!completed.length}
            >
              {completed.map((r) => (
                <option key={r.applicationId} value={r.applicationId}>
                  {r.candidateEmail} ({r.finalScore ?? "—"})
                </option>
              ))}
            </Select>
            <Select
              placeholder="Candidate B"
              value={bId}
              onValueChange={setBId}
              className="w-72"
              disabled={!completed.length}
            >
              {completed.map((r) => (
                <option key={r.applicationId} value={r.applicationId}>
                  {r.candidateEmail} ({r.finalScore ?? "—"})
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedJobId && a && b ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Skill radar</CardTitle>
              <CardDescription>
                {a.candidateEmail} vs {b.candidateEmail}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={config}
                className="mx-auto aspect-square max-h-[420px] w-full"
              >
                <RadarChart data={chartData} outerRadius="78%">
                  <PolarGrid />
                  <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend content={<ChartLegend />} />
                  <Radar
                    name="A"
                    dataKey="candidateA"
                    stroke="var(--color-candidateA)"
                    fill="var(--color-candidateA)"
                    fillOpacity={0.25}
                  />
                  <Radar
                    name="B"
                    dataKey="candidateB"
                    stroke="var(--color-candidateB)"
                    fill="var(--color-candidateB)"
                    fillOpacity={0.25}
                  />
                </RadarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Per-skill diff</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Skill</TableHead>
                    <TableHead className="text-right">A</TableHead>
                    <TableHead className="text-right">B</TableHead>
                    <TableHead className="text-right">Δ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {skills.map((s) => {
                    const av = a?.skillScores?.[s]?.score ?? 0;
                    const bv = b?.skillScores?.[s]?.score ?? 0;
                    const d = av - bv;
                    return (
                      <TableRow key={s}>
                        <TableCell className="capitalize">{s}</TableCell>
                        <TableCell className="text-right font-mono">{av}</TableCell>
                        <TableCell className="text-right font-mono">{bv}</TableCell>
                        <TableCell
                          className={`text-right font-mono ${
                            d > 0
                              ? "text-emerald-500"
                              : d < 0
                                ? "text-rose-500"
                                : "text-muted-foreground"
                          }`}
                        >
                          {d > 0 ? `+${d}` : d}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow>
                    <TableCell className="font-semibold">Final</TableCell>
                    <TableCell className="text-right font-mono">{a.finalScore ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">{b.finalScore ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">—</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardDescription>
              Select a job and two completed candidates to see the radar comparison.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

function InsightsTab({ jobs, selectedJobId, setSelectedJobId }) {
  const aggregate = useQuery(
    api.analytics.jobSkillAggregate,
    selectedJobId ? { jobIdRef: selectedJobId } : "skip"
  );
  const stats = useQuery(
    api.analytics.jobStats,
    selectedJobId ? { jobIdRef: selectedJobId } : "skip"
  );

  const data = (aggregate?.skills || []).map((s) => ({
    skill: s.skill,
    avg: s.avg,
    max: s.max,
    min: s.min
  }));

  const config = {
    avg: { label: "Average", color: "hsl(var(--chart-1))" },
    max: { label: "Top score", color: "hsl(var(--chart-2))" },
    min: { label: "Lowest score", color: "hsl(var(--chart-5))" }
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>Insights</CardTitle>
          <CardDescription>
            Per-skill distribution across all completed candidates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              placeholder="Select a job"
              value={selectedJobId || ""}
              onValueChange={setSelectedJobId}
              className="w-72"
            >
              {jobs.map((j) => (
                <option key={j._id} value={j._id}>
                  {j.jobId} — {j.title}
                </option>
              ))}
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedJobId(selectedJobId)}
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {!selectedJobId ? null : !aggregate ? (
        <Card>
          <CardHeader>
            <CardDescription>Loading insights…</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Applicants" value={stats?.applicants ?? "—"} />
            <StatCard label="Started" value={stats?.started ?? "—"} />
            <StatCard label="Completed" value={stats?.completed ?? "—"} />
            <StatCard
              label="Avg final"
              value={
                aggregate.skills.length
                  ? Math.round(
                      aggregate.skills.reduce((a, b) => a + (b.avg || 0), 0) /
                        aggregate.skills.length
                    )
                  : "—"
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.3fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Skill performance radar</CardTitle>
                <CardDescription>Average vs top vs lowest skill score</CardDescription>
              </CardHeader>
              <CardContent>
                {data.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No required skills configured for this job.
                  </p>
                ) : (
                  <ChartContainer
                    config={config}
                    className="mx-auto aspect-square max-h-[420px] w-full"
                  >
                    <RadarChart data={data} outerRadius="78%">
                      <PolarGrid />
                      <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend content={<ChartLegend />} />
                      <Radar
                        name="max"
                        dataKey="max"
                        stroke="var(--color-max)"
                        fill="var(--color-max)"
                        fillOpacity={0.15}
                      />
                      <Radar
                        name="avg"
                        dataKey="avg"
                        stroke="var(--color-avg)"
                        fill="var(--color-avg)"
                        fillOpacity={0.35}
                      />
                      <Radar
                        name="min"
                        dataKey="min"
                        stroke="var(--color-min)"
                        fill="var(--color-min)"
                        fillOpacity={0.1}
                      />
                    </RadarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Skill heatmap</CardTitle>
                <CardDescription>
                  Mean score per skill (n = candidates with completed assessments)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Skill</TableHead>
                        <TableHead className="text-right">n</TableHead>
                        <TableHead className="text-right">Avg</TableHead>
                        <TableHead className="text-right">Median</TableHead>
                        <TableHead className="text-right">Min</TableHead>
                        <TableHead className="text-right">Max</TableHead>
                        <TableHead>Bar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aggregate.skills.map((s) => (
                        <TableRow key={s.skill}>
                          <TableCell className="capitalize">{s.skill}</TableCell>
                          <TableCell className="text-right font-mono">{s.count}</TableCell>
                          <TableCell className="text-right font-mono">{s.avg}</TableCell>
                          <TableCell className="text-right font-mono">{s.median}</TableCell>
                          <TableCell className="text-right font-mono">{s.min}</TableCell>
                          <TableCell className="text-right font-mono">{s.max}</TableCell>
                          <TableCell>
                            <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full"
                                style={{
                                  width: `${Math.max(0, Math.min(100, s.avg))}%`,
                                  background:
                                    s.avg >= 75
                                      ? "hsl(var(--chart-2))"
                                      : s.avg >= 50
                                        ? "hsl(var(--chart-3))"
                                        : "hsl(var(--chart-5))"
                                }}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

export function AdminDashboard({ jobs, adminJobForm, setAdminJobForm, createJob }) {
  const [tab, setTab] = useState("manage");
  const [selectedJobId, setSelectedJobId] = useState("");

  useEffect(() => {
    if (!selectedJobId && jobs.length) setSelectedJobId(jobs[0]._id);
  }, [jobs, selectedJobId]);

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="manage">Manage</TabsTrigger>
          <TabsTrigger value="applicants">Applicants</TabsTrigger>
          <TabsTrigger value="compare">Compare</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>
        <TabsContent value="manage">
          <ManageTab
            jobs={jobs}
            adminJobForm={adminJobForm}
            setAdminJobForm={setAdminJobForm}
            createJob={createJob}
          />
        </TabsContent>
        <TabsContent value="applicants">
          <ApplicantsTab
            jobs={jobs}
            selectedJobId={selectedJobId}
            setSelectedJobId={setSelectedJobId}
          />
        </TabsContent>
        <TabsContent value="compare">
          <CompareTab
            jobs={jobs}
            selectedJobId={selectedJobId}
            setSelectedJobId={setSelectedJobId}
          />
        </TabsContent>
        <TabsContent value="insights">
          <InsightsTab
            jobs={jobs}
            selectedJobId={selectedJobId}
            setSelectedJobId={setSelectedJobId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
