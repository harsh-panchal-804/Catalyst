import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";
const convexUrl = import.meta.env.VITE_CONVEX_URL || "";
const useConvexWithClerk = import.meta.env.VITE_USE_CONVEX_WITH_CLERK === "true";

function isAbsoluteUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_error) {
    return false;
  }
}

let convexClient = null;
if (convexUrl && isAbsoluteUrl(convexUrl)) {
  try {
    convexClient = new ConvexReactClient(convexUrl);
  } catch (error) {
    console.warn("Invalid VITE_CONVEX_URL; Convex disabled.", error);
  }
} else if (convexUrl) {
  console.warn("VITE_CONVEX_URL is not an absolute URL; Convex disabled.");
}

function AppProviders() {
  if (convexClient && useConvexWithClerk) {
    return (
      <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConvexProviderWithClerk>
    );
  }
  if (convexClient && !useConvexWithClerk) {
    console.warn(
      "Convex client available, but Clerk-Convex auth bridge is disabled. Set VITE_USE_CONVEX_WITH_CLERK=true to enable."
    );
  }
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {clerkPublishableKey ? (
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <AppProviders />
      </ClerkProvider>
    ) : (
      <div style={{ padding: "1rem", fontFamily: "sans-serif" }}>
        Missing `VITE_CLERK_PUBLISHABLE_KEY`. Set it in client `.env`.
      </div>
    )}
  </StrictMode>
);
