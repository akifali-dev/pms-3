export async function ensureTaskUpdatedAt(prisma, where = {}) {
  await prisma.task.updateMany({
    where: {
      ...where,
      updatedAt: null,
    },
    data: {
      updatedAt: new Date(),
    },
  });
}
