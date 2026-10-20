import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminAnalyticsRange } from "@/lib/admin/analytics-range";
type Report = { metrics: Record<string, number | null>; series: Array<Record<string,string|number|null>>; breakdowns: { ai_models: Array<{ model: string; requests: number }>; study_categories: Array<{ category: string; sessions: number }>; traffic_sources: Array<{ source: string; users: number }> }; range: Record<string, unknown> };
export async function getAdminReport(db: SupabaseClient, range: AdminAnalyticsRange) {
  const { data, error } = await db.rpc("get_admin_business_intelligence", { p_start_at: range.startAt, p_end_at: range.endAt, p_timezone: range.timezone, p_bucket: range.bucket, p_compare: range.preset !== "all" });
  if (error || !data?.metrics || !Array.isArray(data.series)) throw new Error("The historical report is unavailable.");
  const report = data as Report;
  const metrics = report.metrics;
  return { ...report, range: { ...report.range, label: range.label },
    modelCounts: Object.fromEntries(report.breakdowns.ai_models.map(row => [row.model,row.requests])),
    categoryDistribution: Object.fromEntries(report.breakdowns.study_categories.map(row => [row.category,row.sessions])),
    trafficSources: Object.fromEntries(report.breakdowns.traffic_sources.map(row => [row.source,row.users])),
    costTrends: report.series.map(row => ({ date: row.bucket_start, cost: row.ai_cost })),
    avgDurationMinutes: metrics.study_sessions ? Number(metrics.study_time_seconds)/Number(metrics.study_sessions)/60 : null,
    totalQuizQuestions: metrics.total_quiz_questions,
    // Historical and submitted answer keys establish practice activity, not grading.
    quizAccuracy: null, correctAnswers: null, resultSource: "client_reported_practice",
  };
}
