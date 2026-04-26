/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as applications from "../applications.js";
import type * as assessments from "../assessments.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as jobs from "../jobs.js";
import type * as learning from "../learning.js";
import type * as llm from "../llm.js";
import type * as resume from "../resume.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  applications: typeof applications;
  assessments: typeof assessments;
  auth: typeof auth;
  crons: typeof crons;
  jobs: typeof jobs;
  learning: typeof learning;
  llm: typeof llm;
  resume: typeof resume;
  seed: typeof seed;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
