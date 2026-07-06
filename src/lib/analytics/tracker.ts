import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function logAiRequest(
  userId: string | null | undefined,
  promptTokens: number,
  completionTokens: number,
  modelUsed: string,
  requestType: string,
  status: "success" | "failed",
  errorMessage?: string
) {
  try {
    const totalTokens = promptTokens + completionTokens;

    // Calculate estimated cost
    let estimatedCost = 0;
    const model = modelUsed.toLowerCase();
    if (model.includes("flash")) {
      // Input: $0.075 / 1M tokens ($0.000000075 / token)
      // Output: $0.30 / 1M tokens ($0.0000003 / token)
      estimatedCost = promptTokens * 0.000000075 + completionTokens * 0.0000003;
    } else if (model.includes("pro")) {
      // Input: $1.25 / 1M tokens ($0.00000125 / token)
      // Output: $5.00 / 1M tokens ($0.000005 / token)
      estimatedCost = promptTokens * 0.00000125 + completionTokens * 0.000005;
    } else if (model.includes("embedding")) {
      // Input: $0.025 / 1M tokens
      estimatedCost = promptTokens * 0.000000025;
    }

    const adminClient = await createSupabaseServerClient();
    const { error } = await adminClient.from("ai_requests").insert({
      user_id: userId || null,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      estimated_cost: parseFloat(estimatedCost.toFixed(6)),
      model_used: modelUsed,
      request_type: requestType,
      status,
      error_message: errorMessage || null,
    });

    if (error) {
      console.error("[tracker] logAiRequest error inserting into db:", error);
    }
  } catch (err) {
    console.error("[tracker] logAiRequest exception:", err);
  }
}

export async function logPageView(
  userId: string | null | undefined,
  path: string,
  referrer?: string | null,
  userAgent?: string | null
) {
  try {
    const adminClient = await createSupabaseServerClient();
    const { error } = await adminClient.from("page_views").insert({
      user_id: userId || null,
      path,
      referrer: referrer || null,
      user_agent: userAgent || null,
    });
    if (error) console.error("[tracker] logPageView error:", error);

    if (userId) {
      await adminClient
        .from("profiles")
        .update({ last_active: new Date().toISOString() })
        .eq("id", userId);
    }
  } catch (err) {
    console.error("[tracker] logPageView exception:", err);
  }
}

export async function logFeatureUsage(
  userId: string,
  featureName: string,
  additionalMetadata: Record<string, any> = {}
) {
  try {
    const adminClient = await createSupabaseServerClient();
    const { error } = await adminClient.from("feature_usage").insert({
      user_id: userId,
      feature_name: featureName,
      additional_metadata: additionalMetadata,
    });
    if (error) console.error("[tracker] logFeatureUsage error:", error);
  } catch (err) {
    console.error("[tracker] logFeatureUsage exception:", err);
  }
}

export async function logAnalyticsEvent(
  userId: string | null | undefined,
  eventName: string,
  eventProperties: Record<string, any> = {}
) {
  try {
    const adminClient = await createSupabaseServerClient();
    const { error } = await adminClient.from("events").insert({
      user_id: userId || null,
      event_type: eventName,
      properties: eventProperties,
    });
    if (error) console.error("[tracker] logAnalyticsEvent error:", error);
  } catch (err) {
    console.error("[tracker] logAnalyticsEvent exception:", err);
  }
}

export async function logPerformanceMetric(
  userId: string | null | undefined,
  metricName: string,
  metricValue: number,
  additionalMetadata: Record<string, any> = {}
) {
  try {
    const adminClient = await createSupabaseServerClient();
    const { error } = await adminClient.from("performance_metrics").insert({
      user_id: userId || null,
      metric_name: metricName,
      metric_value: metricValue,
      additional_metadata: additionalMetadata,
    });
    if (error) console.error("[tracker] logPerformanceMetric error:", error);
  } catch (err) {
    console.error("[tracker] logPerformanceMetric exception:", err);
  }
}

export async function logMarketingAttribution(
  userId: string,
  attribution: {
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    referrer?: string | null;
  }
) {
  try {
    const adminClient = await createSupabaseServerClient();
    const { error } = await adminClient.from("user_attribution").insert({
      user_id: userId,
      utm_source: attribution.utm_source || null,
      utm_medium: attribution.utm_medium || null,
      utm_campaign: attribution.utm_campaign || null,
      referrer: attribution.referrer || null,
    });
    if (error) {
      // Upsert on duplicate user_id
      const { error: upsertError } = await adminClient
        .from("user_attribution")
        .upsert({
          user_id: userId,
          utm_source: attribution.utm_source || null,
          utm_medium: attribution.utm_medium || null,
          utm_campaign: attribution.utm_campaign || null,
          referrer: attribution.referrer || null,
        });
      if (upsertError) {
        console.error("[tracker] logMarketingAttribution upsert error:", upsertError);
      }
    }
  } catch (err) {
    console.error("[tracker] logMarketingAttribution exception:", err);
  }
}
