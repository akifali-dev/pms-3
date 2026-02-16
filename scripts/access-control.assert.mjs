import { readFile } from "node:fs/promises";

const checks = [
  {
    file: "src/app/api/tasks/route.js",
    patterns: [
      /WORK_ITEM_CREATION_ROLES\.includes\(context\.role\)/,
      /buildError\("You are not allowed to create tasks\.",\s*403\)/,
    ],
  },
  {
    file: "src/app/api/milestones/route.js",
    patterns: [
      /WORK_ITEM_CREATION_ROLES\.includes\(context\.role\)/,
      /buildError\("You are not allowed to create milestones\.",\s*403\)/,
    ],
  },
  {
    file: "src/components/projects/ProjectDetailView.jsx",
    patterns: [
      /if \(!canManageMilestones\) \{[\s\S]*message: "Not allowed"/,
      /actions=\{\s*canManageMilestones \?/,
    ],
  },
  {
    file: "src/components/milestones/MilestonesOverview.jsx",
    patterns: [
      /const canCreate = useMemo\(\(\) => canCreateMilestones\(role\), \[role\]\);/,
      /if \(!canCreate\) \{[\s\S]*message: "Not allowed"/,
      /actions=\{\s*canCreate \?/,
    ],
  },
  {
    file: "src/components/milestones/MilestoneDetailView.jsx",
    patterns: [
      /const canCreateTask = useMemo\(\(\) => canCreateTasks\(normalizedRole\), \[normalizedRole\]\);/,
      /if \(!editingTaskId && !canCreateTask\) \{[\s\S]*message: "Not allowed"/,
      /actions=\{\s*canCreateTask \?/,
    ],
  },
];

for (const check of checks) {
  const content = await readFile(check.file, "utf8");
  for (const pattern of check.patterns) {
    if (!pattern.test(content)) {
      throw new Error(`Check failed for ${check.file}: ${pattern}`);
    }
  }
}

console.log("Access control checks passed.");
