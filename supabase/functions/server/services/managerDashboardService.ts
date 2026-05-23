import { SupabaseClient } from "npm:@supabase/supabase-js";
import { DashboardResponse, ManagerDashboardProject } from "../dto/dashboard.ts";

export class ManagerDashboardService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Retrieves the manager dashboard summary paginated.
   * Enforces isolation by explicitly filtering on managerId.
   */
  async getDashboard(
    managerId: string,
    limit: number = 20,
    cursor?: string
  ): Promise<DashboardResponse> {
    const startTime = performance.now();
    
    try {
      let query = this.supabase
        .from('mv_manager_dashboard_summary')
        .select('*', { count: 'exact' })
        .eq('manager_id', managerId)
        .order('latest_activity_at', { ascending: false, nullsFirst: false })
        .limit(limit);

      if (cursor) {
        query = query.lt('latest_activity_at', cursor);
      }

      const { data, error, count } = await query;

      if (error) {
        throw new Error(error.message);
      }

      const items: ManagerDashboardProject[] = (data || []).map((row: any) => ({
        id: row.project_id,
        title: row.project_name,
        completionPercent: row.completion_percent,
        overdueMilestones: row.overdue_milestones,
        pendingApprovals: row.pending_approvals,
        latestActivityAt: row.latest_activity_at,
        endDate: row.end_date || new Date().toISOString()
      }));

      const nextCursor = items.length === limit && items.length > 0 ? items[items.length - 1].latestActivityAt : undefined;

      const duration = performance.now() - startTime;
      
      // Structured Logging with SLO tags
      console.log(JSON.stringify({
        event: 'dashboard_fetched',
        manager_id: managerId,
        item_count: items.length,
        duration_ms: Math.round(duration),
        slo_met: duration < 500
      }));

      return {
        items,
        nextCursor: nextCursor || undefined,
        totalCount: count || 0
      };
    } catch (err: any) {
      const duration = performance.now() - startTime;
      console.error(JSON.stringify({
        event: 'dashboard_fetch_failed',
        manager_id: managerId,
        error: err.message,
        duration_ms: Math.round(duration)
      }));
      throw err;
    }
  }
}
