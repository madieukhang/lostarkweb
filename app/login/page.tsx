import { Suspense } from "react";
import { LoginView } from "@/components/LoginView";

// useSearchParams needs a Suspense boundary in a static export.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  );
}
