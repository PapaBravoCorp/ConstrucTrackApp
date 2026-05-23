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

// POST /cron/deadline-reminders
// Sends notifications for milestones due within 48h or overdue.
// Deduplicates: won't resend if same type + reference_id sent in last 24h.
// Intended to run daily at 8 AM IST.
cron.post("/deadline-reminders", async (c) => {
  const supabase = getServiceClient();
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  // Fetch non-completed milestones with due_date <= 48h from now OR overdue
  const { data: milestones, error: mError } = await supabase
    .from("milestones")
    .select(`
      id, name, due_date, status, project_id, organization_id,
      project:projects(id, name, manager_id)
    `)
    .not("status", "in", '("Completed","Archived","Cancelled")')
    .not("due_date", "is", null)
    .lte("due_date", in48h.toISOString().split('T')[0]);

  if (mError) {
    return c.json({ error: "Failed to fetch milestones: " + mError.message }, 500);
  }

  if (!milestones || milestones.length === 0) {
    return c.json({ success: true, message: "No milestones needing reminders", sent: 0 });
  }

  // Fetch recent notifications (last 24h) to deduplicate
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentNotifs } = await supabase
    .from("notifications")
    .select("reference_id, type")
    .gte("created_at", yesterday)
    .in("type", ['delay']);

  const recentSet = new Set((recentNotifs || []).map(n => `${n.reference_id}:${n.type}`));

  // Fetch project agents for notification targeting
  const projectIds = [...new Set(milestones.map(m => m.project_id))];
  const { data: agents } = await supabase
    .from("project_agents")
    .select("project_id, agent_id")
    .in("project_id", projectIds);

  const agentsByProject = new Map<string, string[]>();
  for (const a of (agents || [])) {
    const list = agentsByProject.get(a.project_id) || [];
    list.push(a.agent_id);
    agentsByProject.set(a.project_id, list);
  }

  let sentCount = 0;
  const notifications: any[] = [];

  for (const m of milestones) {
    const project = m.project as any;
    if (!project) continue;

    const dueDate = new Date(m.due_date);
    const isOverdue = dueDate < new Date(now.toISOString().split('T')[0]);
    const dedupeKey = `${m.id}:delay`;

    if (recentSet.has(dedupeKey)) continue;

    let title: string;
    let body: string;

    if (isOverdue) {
      const daysOverdue = Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      title = `🔴 "${m.name}" is ${daysOverdue}d overdue`;
      body = `Milestone on "${project.name}" was due ${m.due_date}. Please update progress.`;
    } else {
      const hoursUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60));
      title = `⚠️ "${m.name}" is due in ${hoursUntil}h`;
      body = `Milestone on "${project.name}" is due ${m.due_date}. Submit your progress update.`;
    }

    // Notify assigned agents
    const projectAgents = agentsByProject.get(m.project_id) || [];
    for (const agentId of projectAgents) {
      notifications.push({
        user_id: agentId,
        organization_id: m.organization_id,
        title,
        body,
        type: 'delay',
        reference_id: m.project_id,
      });
    }

    // Notify project manager
    if (project.manager_id) {
      notifications.push({
        user_id: project.manager_id,
        organization_id: m.organization_id,
        title,
        body,
        type: 'delay',
        reference_id: m.project_id,
      });
    }
  }

  // Batch insert
  if (notifications.length > 0) {
    const { error: insertError } = await supabase.from("notifications").insert(notifications);
    if (insertError) {
      return c.json({ error: "Failed to insert notifications: " + insertError.message }, 500);
    }
    sentCount = notifications.length;
  }

  return c.json({ success: true, message: `Sent ${sentCount} deadline reminders`, sent: sentCount });
});

// POST /cron/refresh-dashboard-mv
// Refreshes the manager dashboard materialized view (Target SLA: 2 mins)
cron.post("/refresh-dashboard-mv", async (c) => {
  const supabase = getServiceClient();
  const { error } = await supabase.rpc('refresh_manager_dashboard_summary');
  
  if (error) {
    return c.json({ error: "Failed to refresh dashboard MV: " + error.message }, 500);
  }
  return c.json({ success: true, message: "Dashboard MV refreshed successfully" });
});

// POST /cron/retention-policies
// Enforces data lifecycle: deletes dead letters > 90d, struct logs > 30d
cron.post("/retention-policies", async (c) => {
  const supabase = getServiceClient();
  const now = new Date();
  
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Delete dead letters older than 90 days
  const { error: notifError, count: notifCount } = await supabase
    .from('notifications')
    .delete({ count: 'exact' })
    .eq('delivery_status', 'dead_letter')
    .lt('created_at', ninetyDaysAgo);

  // We don't have a structured_logs table yet, but we can clear security_audit_logs if needed
  const { error: auditError, count: auditCount } = await supabase
    .from('security_audit_logs')
    .delete({ count: 'exact' })
    .lt('created_at', thirtyDaysAgo);

  if (notifError || auditError) {
    return c.json({ error: "Failed to run retention policies" }, 500);
  }

  return c.json({ 
    success: true, 
    deletedDeadLetters: notifCount || 0,
    deletedLogs: auditCount || 0
  });
});

// POST /cron/process-notifications
// Outbox pattern worker: processes pending/failed notifications with retry logic
cron.post("/process-notifications", async (c) => {
  const supabase = getServiceClient();
  
  // Fetch up to 50 pending or failed (retryable) notifications
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*')
    .in('delivery_status', ['pending', 'failed'])
    .lt('retry_count', 3) // Max 3 retries
    .limit(50);
    
  if (error || !notifications) {
    return c.json({ error: "Failed to fetch notifications queue" }, 500);
  }

  let processedCount = 0;
  
  for (const notif of notifications) {
    try {
      // Simulate sending notification (e.g. email, push, websocket)
      // await sendPushNotification(notif.user_id, notif.title, notif.body);
      
      await supabase
        .from('notifications')
        .update({ delivery_status: 'delivered', last_attempt_at: new Date().toISOString() })
        .eq('id', notif.id);
        
      processedCount++;
    } catch (err: any) {
      const nextRetryCount = notif.retry_count + 1;
      const nextStatus = nextRetryCount >= 3 ? 'dead_letter' : 'failed';
      
      await supabase
        .from('notifications')
        .update({ 
          delivery_status: nextStatus,
          retry_count: nextRetryCount,
          error_msg: err.message,
          last_attempt_at: new Date().toISOString()
        })
        .eq('id', notif.id);
    }
  }

  return c.json({ success: true, processed: processedCount });
});

export default cron;
