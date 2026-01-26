import MilestoneDetailView from "@/components/milestones/MilestoneDetailView";

export default async function MilestoneDetailPage({ params }) {
  console.log("params",params)
    const {milestoneId}= await params;
    console.log("milestoneId",milestoneId)
  return <MilestoneDetailView milestoneId={milestoneId} />;
}
