import { useMemo } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

function fitTone(score) {
  if (typeof score !== "number") return "text-muted-foreground";
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-amber-500";
  return "text-rose-500";
}

export function AppliedJobsTab({ applications, jobs, navigate }) {
  const jobTitleById = useMemo(
    () =>
      Object.fromEntries(
        (jobs || []).map((job) => [job._id, job.title || job.jobId || "Untitled Job"])
      ),
    [jobs]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Applications</CardTitle>
        <CardDescription>Continue or review your assessments.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {applications.map((app) => {
            const fit = typeof app.fitScore === "number" ? app.fitScore : null;
            const yoe =
              typeof app.resumeStructured?.yearsOfExperience === "number"
                ? app.resumeStructured.yearsOfExperience
                : null;
            return (
              <div key={app._id} className="rounded border p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {jobTitleById[app.jobIdRef] || app.jobTitle || "Application"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {fit !== null ? (
                      <span className={`font-mono text-xs font-semibold ${fitTone(fit)}`}>
                        {fit}% fit
                      </span>
                    ) : app.parsedAt ? null : (
                      <span className="text-[11px] italic text-muted-foreground">
                        Parsing resume…
                      </span>
                    )}
                    {yoe !== null ? (
                      <Badge variant="outline" className="text-[10px]">
                        {yoe}y
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Status: {app.assessmentStatus}</p>
                {app.fitBreakdown?.matchedSkills?.length ||
                app.fitBreakdown?.missingSkills?.length ? (
                  <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                    {(app.fitBreakdown.matchedSkills || []).slice(0, 6).map((s) => (
                      <Badge key={`m-${app._id}-${s}`} variant="default">
                        ✓ {s}
                      </Badge>
                    ))}
                    {(app.fitBreakdown.missingSkills || []).slice(0, 4).map((s) => (
                      <Badge key={`g-${app._id}-${s}`} variant="outline">
                        ✗ {s}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => navigate(`/assessment/${app._id}`)}
                >
                  {app.assessmentStatus === "not_started" ? "Start Assessment" : "Continue / View"}
                </Button>
              </div>
            );
          })}
          {!applications.length ? (
            <p className="text-sm text-muted-foreground">No applications yet.</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
