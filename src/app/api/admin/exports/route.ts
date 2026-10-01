import { NextResponse } from "next/server";

import { parseAdminAnalyticsRange } from "@/lib/admin/analytics-range";
import { AdminApiError, requireAdminApi } from "@/lib/auth/require-admin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;
const MAX_EXPORT_ROWS = 100_000;

const DATASETS = {
  users: { table: "profiles", columns: "id,email,first_name,last_name,plan,institution,department,country,created_at,last_active", timestamp: "created_at" },
  user_activity: { table: "events", columns: "id,user_id,event_type,created_at", timestamp: "created_at" },
  messages: { table: "study_messages", columns: "id,user_id,session_id,role,created_at", timestamp: "created_at" },
  study_sessions: { table: "study_sessions", columns: "id,user_id,status,topic_category,duration_seconds,created_at,updated_at", timestamp: "created_at" },
  uploads: { table: "uploaded_materials", columns: "id,user_id,session_id,course_id,file_type,file_size,ocr_status,embedding_status,created_at,deleted_at", timestamp: "created_at" },
  ai_usage: { table: "ai_requests", columns: "id,user_id,model_used,request_type,status,prompt_tokens,completion_tokens,total_tokens,estimated_cost,input_rate_per_million,output_rate_per_million,pricing_currency,pricing_version,latency_ms,created_at", timestamp: "created_at" },
  marketing: { table: "user_attribution", columns: "user_id,utm_source,utm_medium,utm_campaign,created_at", timestamp: "created_at" },
  quiz_analytics: { table: "quizzes", columns: "id,user_id,type,score,accuracy,difficulty,topic,time_spent,created_at", timestamp: "created_at" },
  subscriptions: { table: "subscription_history", columns: "id,user_id,old_plan,new_plan,reason,changed_by,created_at", timestamp: "created_at" },
  payments: { table: "billing_transactions", columns: "id,user_id,provider,reference,amount,currency,status,payment_method,created_at,updated_at", timestamp: "created_at" },
} as const;

type DatasetKey = keyof typeof DATASETS | "summary";

function isDataset(value: string | null): value is DatasetKey {
  return value === "summary" || Boolean(value && value in DATASETS);
}

function safeCsvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  let text = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return [
    headers.map(safeCsvCell).join(","),
    ...rows.map((row) => headers.map((header) => safeCsvCell(row[header])).join(",")),
  ].join("\r\n");
}

async function fetchDataset(dataset: Exclude<DatasetKey, "summary">, startAt: string, endAt: string) {
  const admin = createSupabaseAdminClient();
  const definition = DATASETS[dataset];
  const rows: Record<string, unknown>[] = [];

  for (let offset = 0; offset < MAX_EXPORT_ROWS; offset += PAGE_SIZE) {
    const { data, error } = await admin
      .from(definition.table)
      .select(definition.columns)
      .gte(definition.timestamp, startAt)
      .lt(definition.timestamp, endAt)
      .order(definition.timestamp, { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return { rows, truncated: false };
  }

  return { rows, truncated: true };
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdminApi();
    const url = new URL(request.url);
    const datasetParam = url.searchParams.get("dataset") ?? "summary";
    const format = url.searchParams.get("format") ?? "csv";
    if (!isDataset(datasetParam)) {
      return NextResponse.json({ success: false, error: "Unsupported export dataset." }, { status: 400 });
    }
    if (format !== "csv" && format !== "json") {
      return NextResponse.json({ success: false, error: "format must be csv or json." }, { status: 400 });
    }

    const range = parseAdminAnalyticsRange(url.searchParams);
    let rows: Record<string, unknown>[];
    let truncated = false;

    if (datasetParam === "summary") {
      const { data, error } = await supabase.rpc("get_admin_business_intelligence", {
        p_start_at: range.startAt,
        p_end_at: range.endAt,
        p_timezone: range.timezone,
        p_bucket: range.bucket,
        p_compare: range.preset !== "all",
      });
      if (error) throw error;
      rows = [{
        report: "Lerna AI Growth Report",
        start_at: range.startAt,
        end_at: range.endAt,
        timezone: range.timezone,
        ...(data?.metrics ?? {}),
        revenue_by_currency: data?.breakdowns?.revenue_by_currency ?? [],
      }];
    } else {
      ({ rows, truncated } = await fetchDataset(datasetParam, range.startAt, range.endAt));
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `lerna-${datasetParam}-${stamp}.${format}`;
    const commonHeaders = {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Lerna-Range-Start": range.startAt,
      "X-Lerna-Range-End": range.endAt,
      "X-Lerna-Timezone": range.timezone,
      "X-Lerna-Export-Truncated": String(truncated),
    };

    if (format === "json") {
      return NextResponse.json({
        report: "Lerna AI Growth Report",
        dataset: datasetParam,
        generated_at: new Date().toISOString(),
        range,
        truncated,
        rows,
      }, { headers: commonHeaders });
    }

    return new NextResponse(`\uFEFF${toCsv(rows)}`, {
      headers: { ...commonHeaders, "Content-Type": "text/csv; charset=utf-8" },
    });
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    if (error instanceof Error && /range|timezone|start_at|end_at/i.test(error.message)) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error("[api:admin:exports] export failed", error);
    return NextResponse.json({ success: false, error: "Unable to generate export." }, { status: 500 });
  }
}
