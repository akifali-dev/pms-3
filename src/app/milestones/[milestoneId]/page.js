import MilestoneDetailView from "@/components/milestones/MilestoneDetailView";

export default function MilestoneDetailPage({ params }) {
  return <MilestoneDetailView milestoneId={params.milestoneId} />;
}
