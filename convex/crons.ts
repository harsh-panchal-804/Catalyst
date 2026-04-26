import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.weekly(
  "validate-learning-resources",
  { dayOfWeek: "monday", hourUTC: 4, minuteUTC: 0 },
  internal.learning.validateResourceLinksInternal
);

export default crons;
