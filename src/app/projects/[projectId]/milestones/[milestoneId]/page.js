import { notFound, redirect } from "next/navigation";
import MilestoneDetailView from "@/components/milestones/MilestoneDetailView";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const isValidObjectId = (value) =>
  typeof value === "string" && /^[0-9a-fA-F]{24}$/.test(value);

export default async function MilestoneDetailPage({ params }) {
  const { projectId, milestoneId } = await params;
  if (!isValidObjectId(milestoneId)) {
    notFound();
  }
  const session = await getSession();
  const hasDatabase = Boolean(process.env.DATABASE_URL);
  const currentUser =
    hasDatabase && session?.email
      ? await prisma.user.findUnique({
          where: { email: session.email },
          select: { id: true },
        })
      : null;

  if (hasDatabase) {
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      select: { projectId: true },
    });
    if (milestone && milestone.projectId !== projectId) {
      redirect(`/projects/${milestone.projectId}/milestones/${milestoneId}`);
    }
  }

  return (
    <MilestoneDetailView
      milestoneId={milestoneId}
      role={session?.role}
      currentUserId={currentUser?.id ?? null}
    />
  );
}
