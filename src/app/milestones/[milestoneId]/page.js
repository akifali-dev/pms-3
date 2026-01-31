import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function MilestoneDetailPage({ params }) {
  const { milestoneId } = params;
  const hasDatabase = Boolean(process.env.DATABASE_URL);

  if (!hasDatabase) {
    redirect("/projects");
  }

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    select: { projectId: true },
  });

  if (!milestone) {
    notFound();
  }

  redirect(`/projects/${milestone.projectId}/milestones/${milestoneId}`);
}
