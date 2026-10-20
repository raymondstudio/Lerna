import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_DATA_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  ELASTICSEARCH_URL: z.string().url().optional(),
  ELASTICSEARCH_API_KEY: z.string().min(1).optional(),
  ELASTIC_SEARCH_API_KEY: z.string().min(1).optional(),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_DATA_API_URL: process.env.NEXT_PUBLIC_SUPABASE_DATA_API_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  ELASTICSEARCH_URL: process.env.ELASTICSEARCH_URL,
  ELASTICSEARCH_API_KEY: process.env.ELASTICSEARCH_API_KEY ?? process.env.ELASTIC_SEARCH_API_KEY,
  ELASTIC_SEARCH_API_KEY: process.env.ELASTIC_SEARCH_API_KEY,
});
