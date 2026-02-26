import { NextRequest } from "next/server";
import { handleAuth } from "@workos-inc/authkit-nextjs";

// Default: redirect to /dashboard after sign in
const defaultHandler = handleAuth({ returnPathname: "/dashboard" });
// Onboarding: redirect to /pricing after sign in
const onboardingHandler = handleAuth({ returnPathname: "/pricing" });

export async function GET(request: NextRequest) {
  const hasOnboarding = request.cookies.has("onboarding_data");
  return hasOnboarding ? onboardingHandler(request) : defaultHandler(request);
}
