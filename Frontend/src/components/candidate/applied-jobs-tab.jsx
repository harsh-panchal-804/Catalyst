import { useMemo } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

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
          {applications.map((app) => (
            <div key={app._id} className="rounded border p-2">
              <p className="text-sm font-medium">
                {jobTitleById[app.jobIdRef] || app.jobTitle || "Application"}
              </p>
              <p className="text-xs text-muted-foreground">Status: {app.assessmentStatus}</p>
              <Button
                size="sm"
                className="mt-2"
                onClick={() => navigate(`/assessment/${app._id}`)}
              >
                {app.assessmentStatus === "not_started" ? "Start Assessment" : "Continue / View"}
              </Button>
            </div>
          ))}
          {!applications.length ? (
            <p className="text-sm text-muted-foreground">No applications yet.</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
