import MilestonesOverview from "@/components/milestones/MilestonesOverview";
import { getSession } from "@/lib/session";

export default async function MilestonesPage() {
  const session = await getSession();

  return <MilestonesOverview role={session?.role} />;
}
