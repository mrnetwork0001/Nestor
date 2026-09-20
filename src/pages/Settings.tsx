import { useEffect } from "react";
import { PageHeader } from "@/components/ui";
import { AccountCard } from "@/components/settings/AccountCard";
import { AutopilotCard } from "@/components/settings/AutopilotCard";
import { IntegrationStatus } from "@/components/settings/IntegrationStatus";

export function Settings() {
  useEffect(() => {
    document.title = "Settings · Nestor";
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 lg:py-10">
      <PageHeader
        eyebrow="Settings"
        title="How Nestor works for you"
        lede="Decide how much Nestor does on its own, see which of its agents are live, and manage your account."
      />

      <div className="mt-8 space-y-6">
        <AutopilotCard />
        <IntegrationStatus />
        <AccountCard />
      </div>
    </div>
  );
}
