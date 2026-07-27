"use client";

import { useAuth } from "@/components/providers/session-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";

export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;

    // If not logged in, redirect to sign-in
    if (!user) {
      router.push("/sign-in");
      return;
    }

    // Check if user already has a tenant configured
    // For now, we'll just show the wizard
    // In production, you'd check if the user already has a tenant
    setChecking(false);
  }, [user, loading, router]);

  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return <OnboardingWizard />;
}
