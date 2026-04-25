import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { FileUpload } from "../ui/file-upload";

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
  const detected = new Set((resumeDetectedSkills || []).map((s) => String(s).toLowerCase()));
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
