import { Hono } from "npm:hono";
import { getServiceClient } from "../middleware/auth.ts";
import { computeHealthScore } from "../lib/healthScore.ts";
import { emitDomainEvent } from "../lib/domainEvents.ts";

const cron = new Hono();

// POST /cron/generate-snapshots
// Generates daily project progress snapshots and calculates health scores
cron.post("/generate-snapshots", async (c) => {
  const supabase = getServiceClient();

  // 1. Fetch all active projects
  const { data: projects, error: pError } = await supabase
    .from("projects")
    .select("id, organization_id, status")
    .neq("status", "Completed"); // Only active projects

  if (pError || !projects) {
    return c.json({ error: "Failed to fetch projects" }, 500);
  }

  const today = new Date().toISOString().split('T')[0];

  for (const project of projects) {
    // 2. Fetch all milestones for the project
    const { data: milestones } = await supabase
      .from("milestones")
      .select("status, percent_done, due_date, current_weight, is_archived, last_update")
      .eq("project_id", project.id)
      .eq("is_archived", false);

    if (!milestones || milestones.length === 0) continue;

    let operationalProgress = 0;
    let approvedProgress = 0;
    let totalWeight = 0;

    let delayedCount = 0;
    let completedCount = 0;
    let blockedCount = 0;
    let staleCount = 0;

    const now = new Date();

    for (const m of milestones) {
      totalWeight += Number(m.current_weight) || 0;

      // Progress computation
      operationalProgress += (Number(m.current_weight) * (m.percent_done / 100)) || 0;
      if (m.status === 'Completed') {
        approvedProgress += Number(m.current_weight) || 0;
        completedCount++;
      }

      if (m.status === 'Blocked') {
        blockedCount++;
      }

      // Check delays
      if (m.due_date && !['Completed', 'Archived', 'Cancelled'].includes(m.status)) {
        if (new Date(m.due_date) < now) {
          delayedCount++;
        }
      }

      // Check stale (no update in 5 days, and not completed)
      if (m.last_update && !['Completed', 'Archived'].includes(m.status)) {
        const diffDays = (now.getTime() - new Date(m.last_update).getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 5) {
          staleCount++;
        }
      }
    }

    const opPercent = totalWeight > 0 ? (operationalProgress / totalWeight) * 100 : 0;
    const appPercent = totalWeight > 0 ? (approvedProgress / totalWeight) * 100 : 0;

    // 3. Compute Health Score
    // Simplified for snapshot: we assume overdueReviewSlaCount and unresolvedRejectedCount are 0 here unless we query them.
    const { score, tier } = computeHealthScore({
      delayedMilestonesCount: delayedCount,
      criticalBlockersCount: blockedCount,
      staleMilestoneCount: staleCount,
      overdueReviewSlaCount: 0, 
      unresolvedRejectedCount: 0
    });

    // 4. Save Snapshot
    await supabase.from("project_progress_snapshots").insert({
      organization_id: project.organization_id,
      project_id: project.id,
      snapshot_date: today,
      operational_progress_percent: opPercent,
      approved_progress_percent: appPercent,
      health_score: score,
      health_tier: tier,
      delayed_milestone_count: delayedCount,
      completed_milestone_count: completedCount,
      active_blockers_count: blockedCount
    });
  }

  return c.json({ success: true, message: `Processed ${projects.length} projects` });
});

export default cron;
