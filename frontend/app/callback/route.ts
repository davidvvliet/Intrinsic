import { NextRequest } from "next/server";
import { handleAuth } from "@workos-inc/authkit-nextjs";

const defaultHandler = handleAuth({ returnPathname: "/dashboard" });
const pricingHandler = handleAuth({ returnPathname: "/pricing" });

export async function GET(request: NextRequest) {
  const hasCheckoutIntent = request.cookies.has("checkout_intent");
  const hasOnboarding = request.cookies.has("onboarding_data");
  if (hasCheckoutIntent || hasOnboarding) return pricingHandler(request);
  return defaultHandler(request);
}

