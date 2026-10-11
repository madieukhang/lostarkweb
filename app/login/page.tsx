import { Suspense } from "react";
import { LoginView } from "@/components/LoginView";

/**
 * useSearchParams needs a Suspense boundary in a static export.
 * @returns The login view inside that boundary.
 */
export default function LoginPage() {
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  );
}
