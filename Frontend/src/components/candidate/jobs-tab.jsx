import { useState } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { FileUpload } from "../ui/file-upload";

function fitTone(score) {
  if (typeof score !== "number") return "text-muted-foreground";
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-amber-500";
  return "text-rose-500";
}

function FitPanel({ jobId, fit, busy, onPreview, hasResume }) {
  if (!hasResume) {
    return (
      <p className="text-xs text-muted-foreground">
        Upload your resume to preview your fit for this role.
      </p>
    );
  }
  return (
    <div className="space-y-2 rounded-md border p-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={onPreview} disabled={busy}>
          <Sparkles className="mr-2 h-4 w-4" />
          {busy ? "Analyzing…" : fit ? "Re-check fit" : "Check my fit"}
        </Button>
        {fit ? (
          <span className={`font-mono text-sm font-semibold ${fitTone(fit.fitScore)}`}>
            {fit.fitScore}% fit
          </span>
        ) : null}
        {fit ? (
          <span className="text-xs text-muted-foreground">
            ({fit.keywordOverlapPct}% keyword · {fit.semanticScore}% semantic)
          </span>
        ) : null}
      </div>
      {fit ? (
        <div className="space-y-1 text-xs">
          {fit.matchedSkills?.length ? (
            <div>
              <p className="font-medium">Matches</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {fit.matchedSkills.map((s) => (
                  <Badge key={`m-${jobId}-${s}`} variant="default" className="text-[10px]">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
          {fit.missingSkills?.length ? (
            <div>
              <p className="font-medium">Gaps</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {fit.missingSkills.map((s) => (
                  <Badge key={`g-${jobId}-${s}`} variant="outline" className="text-[10px]">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
          {fit.explanation ? (
            <p className="italic text-muted-foreground">{fit.explanation}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function JobsTab({
  jobs,
  selectedJobId,
  setSelectedJobId,
  handleResumeChange,
  resumeStatus,
  resumeText,
  resumeDetectedSkills,
  applyToJob
}) {
  const previewFit = useAction(api.resume.previewFit);
  const [fitsByJobId, setFitsByJobId] = useState({});
  const [busyByJobId, setBusyByJobId] = useState({});
  const detected = new Set((resumeDetectedSkills || []).map((s) => String(s).toLowerCase()));

  async function checkFit(job) {
    if (!resumeText.trim()) {
      toast.error("Upload your resume first.");
      return;
    }
    try {
      setBusyByJobId((p) => ({ ...p, [job._id]: true }));
      const result = await previewFit({ resumeText, jobIdRef: job._id });
      setFitsByJobId((p) => ({ ...p, [job._id]: result }));
    } catch (e) {
      toast.error(e.message || "Could not check fit");
    } finally {
      setBusyByJobId((p) => ({ ...p, [job._id]: false }));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Open Jobs</CardTitle>
        <CardDescription>Click a job to view details and apply with your resume.</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible>
          {jobs.map((job) => (
            <AccordionItem key={job._id} value={job._id}>
              <AccordionTrigger>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{job.title}</p>
                    <p className="text-xs text-muted-foreground">{job.jobId}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:divide-x md:divide-border">
                  <div className="md:pr-4">
                    <p className="mb-1 text-sm font-semibold">Job description</p>
                    <p className="whitespace-pre-line text-sm text-muted-foreground">{job.description}</p>
                    {Array.isArray(job.requiredSkills) && job.requiredSkills.length ? (
                      <div className="mt-3">
                        <p className="text-sm font-semibold">Assessment skills (prefilled)</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {job.requiredSkills.map((skill) => (
                            <Badge
                              key={`${job._id}-${skill}`}
                              variant={detected.has(String(skill).toLowerCase()) ? "default" : "outline"}
                              title={
                                detected.has(String(skill).toLowerCase())
                                  ? "Detected in your resume"
                                  : "Not clearly detected in your resume"
                              }
                            >
                              {skill}
                            </Badge>
                          ))}
                        </div>
                        {!!resumeText.trim() ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Highlighted skills were auto-detected in your resume.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-3 md:pl-4">
                    <p className="text-sm font-semibold">Upload resume (PDF)</p>
                    <FileUpload
                      onChange={(files) => {
                        setSelectedJobId(job._id);
                        const file = files?.[0];
                        if (file) handleResumeChange({ target: { files: [file] } });
                      }}
                    />
                    <p className="text-sm text-muted-foreground">
                      {selectedJobId === job._id ? resumeStatus : "Upload a PDF to begin."}
                    </p>
                    {selectedJobId === job._id && resumeDetectedSkills?.length ? (
                      <div className="rounded border border-dashed p-2">
                        <p className="text-xs font-medium">Detected from resume</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {resumeDetectedSkills.slice(0, 10).map((skill) => (
                            <Badge key={`${job._id}-det-${skill}`} variant="secondary">
                              {skill}
                            </Badge>
                          ))}
                          {resumeDetectedSkills.length > 10 ? (
                            <Badge variant="outline">+{resumeDetectedSkills.length - 10}</Badge>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    <FitPanel
                      jobId={job._id}
                      fit={fitsByJobId[job._id]}
                      busy={!!busyByJobId[job._id]}
                      hasResume={selectedJobId === job._id && !!resumeText.trim()}
                      onPreview={() => checkFit(job)}
                    />
                    <Button
                      disabled={selectedJobId !== job._id || !resumeText.trim()}
                      onClick={() => applyToJob(job._id, { startNow: true })}
                    >
                      Take assessment
                    </Button>
                    {selectedJobId === job._id && !resumeText.trim() ? (
                      <p className="text-xs text-muted-foreground">
                        "Take assessment" enables after parsing completes.
                      </p>
                    ) : null}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
          {!jobs.length ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">No open jobs available right now.</div>
          ) : null}
        </Accordion>
      </CardContent>
    </Card>
  );
}
