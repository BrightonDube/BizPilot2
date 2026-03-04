/**
 * Supabase Edge Function: generate-association-rules
 *
 * Generates market-basket association rules from recent sales data
 * and stores them for offline use by the POS SmartCartAssistant.
 *
 * Why a Supabase Edge Function?
 * - Runs server-side so raw order data never leaves the database
 * - PII constraint: only product IDs are sent to the AI service
 *   (no customer names, prices, or order metadata)
 * - Scheduled once per day per location via a Supabase pg_cron job
 *   (see task 22.1) — satisfies the "max once per day" cost constraint
 * - Supabase Edge Functions run in Deno, which is our fastest available
 *   serverless runtime for this use case
 *
 * Flow:
 * 1. fetchRecentOrders    — last 90 days of completed orders (product IDs only)
 * 2. buildTransactionMatrix — convert orders to item-set format for analysis
 * 3. callGPT4oMini        — ask AI to extract association rules
 * 4. storeAssociationRules — upsert results into association_rules table
 * 5. Return summary        — { rulesGenerated, businessId, timestamp }
 *
 * Environment variables required:
 * - OPENAI_API_KEY        — for GPT-4o-mini calls
 * - SUPABASE_URL          — injected by Supabase automatically
 * - SUPABASE_SERVICE_ROLE_KEY — injected by Supabase automatically
 *
 * Validates: pos-core Requirement 11.5 — Tasks 21.1–21.6
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderRow {
  id: string;
  /** Array of product IDs in this order */
  product_ids: string[];
}

/** A single item-set transaction for market-basket analysis */
type Transaction = string[]; // product IDs

/** Association rule as returned by GPT-4o-mini */
interface RawRule {
  antecedent: string[];  // product IDs that trigger the rule
  consequent: string[];  // product IDs suggested
  confidence: number;    // 0–1: P(consequent | antecedent)
  support: number;       // 0–1: fraction of transactions containing both
  lift: number;          // > 1 means positively associated
}

/** Stored association rule (upserted to DB) */
interface AssociationRule {
  business_id: string;
  product_id: string;     // The antecedent product
  suggested_product_ids: string[]; // The consequent products
  confidence: number;
  support: number;
  lift: number;
  updated_at: string;     // ISO timestamp
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum confidence threshold — rules below this are discarded */
const MIN_CONFIDENCE = 0.25;

/** Minimum support threshold — filters out very rare item combinations */
const MIN_SUPPORT = 0.02;

/** Number of days of history to include */
const LOOKBACK_DAYS = 90;

/** Max orders to include in the AI call (to stay within token limit) */
const MAX_ORDERS_FOR_AI = 500;

// ---------------------------------------------------------------------------
// Task 21.2: fetchRecentOrders
// ---------------------------------------------------------------------------

/**
 * Fetch the last LOOKBACK_DAYS of completed orders for a business.
 *
 * PRIVACY: We only select product_ids — no customer data, prices, or
 * order metadata leave this function. The business_id is validated by
 * the subscription tier check before we even reach this function.
 *
 * @returns Array of transactions (each is a list of product IDs)
 */
async function fetchRecentOrders(
  supabase: ReturnType<typeof createClient>,
  businessId: string
): Promise<Transaction[]> {
  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);

  const { data, error } = await supabase
    .from("orders")
    .select("id, order_items(product_id)")
    .eq("business_id", businessId)
    .eq("status", "paid") // only completed sales
    .gte("created_at", since.toISOString())
    .limit(MAX_ORDERS_FOR_AI);

  if (error) {
    throw new Error(`fetchRecentOrders failed: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Transform to flat transactions: [["prod-1", "prod-2"], ["prod-1", "prod-3"], ...]
  return data
    .map((order: { order_items: { product_id: string }[] }) =>
      order.order_items.map((item) => item.product_id)
    )
    .filter((t: string[]) => t.length >= 2); // Need ≥2 items for association
}

// ---------------------------------------------------------------------------
// Task 21.3: buildTransactionMatrix
// ---------------------------------------------------------------------------

/**
 * Convert raw transactions to a frequency-based summary for the AI prompt.
 *
 * Why summarise instead of sending raw transactions?
 * 1. Token efficiency: 500 raw orders × 5 products = 2500 product IDs
 * 2. The AI doesn't need the full order structure, just co-occurrence data
 *
 * Output format: a sorted list of (productA, productB, coOccurrenceCount)
 * for all pairs that appear together at least MIN_SUPPORT * totalOrders times.
 *
 * @returns { pairFrequencies, totalTransactions, uniqueProducts }
 */
interface TransactionMatrix {
  pairFrequencies: Array<{ a: string; b: string; count: number }>;
  totalTransactions: number;
  uniqueProducts: string[];
}

function buildTransactionMatrix(transactions: Transaction[]): TransactionMatrix {
  const total = transactions.length;
  if (total === 0) {
    return { pairFrequencies: [], totalTransactions: 0, uniqueProducts: [] };
  }

  // Count co-occurrences using a Map with sorted pair keys
  const pairCounts = new Map<string, number>();
  const productSet = new Set<string>();

  for (const transaction of transactions) {
    // Deduplicate products within the same order
    const uniqueInOrder = [...new Set(transaction)];

    for (const productId of uniqueInOrder) {
      productSet.add(productId);
    }

    // Count all pairs in this transaction
    for (let i = 0; i < uniqueInOrder.length; i++) {
      for (let j = i + 1; j < uniqueInOrder.length; j++) {
        // Sort pair alphabetically so "A,B" and "B,A" are the same key
        const pair = [uniqueInOrder[i], uniqueInOrder[j]].sort().join("|||");
        pairCounts.set(pair, (pairCounts.get(pair) ?? 0) + 1);
      }
    }
  }

  // Filter pairs below minimum support and sort by frequency descending
  const minCount = Math.floor(MIN_SUPPORT * total);
  const pairFrequencies: TransactionMatrix["pairFrequencies"] = [];

  for (const [pairKey, count] of pairCounts) {
    if (count >= minCount) {
      const [a, b] = pairKey.split("|||");
      pairFrequencies.push({ a, b, count });
    }
  }

  pairFrequencies.sort((x, y) => y.count - x.count);

  return {
    pairFrequencies,
    totalTransactions: total,
    uniqueProducts: [...productSet].sort(),
  };
}

// ---------------------------------------------------------------------------
// Task 21.4: callGPT4oMini
// ---------------------------------------------------------------------------

/**
 * Call GPT-4o-mini to extract association rules from the transaction matrix.
 *
 * Why GPT-4o-mini instead of Apriori algorithm?
 * 1. Apriori on 500 orders in Deno is fine, but GPT can also infer
 *    *semantic* relationships ("coffee → muffin" makes sense; pure Apriori
 *    might miss low-frequency but high-value pairs)
 * 2. GPT-4o-mini is cheap (~$0.15/1M tokens) — 500 pairs ≈ 2000 tokens ≈ $0.0003
 * 3. The output is structured JSON — easy to parse and store
 *
 * Privacy constraint: Only product IDs are sent, not names/prices.
 * The AI returns rules referencing those same IDs.
 *
 * @returns Array of raw association rules
 */
async function callGPT4oMini(
  matrix: TransactionMatrix,
  openaiApiKey: string
): Promise<RawRule[]> {
  if (matrix.pairFrequencies.length === 0) {
    return [];
  }

  // Build a compact, privacy-safe prompt
  const pairLines = matrix.pairFrequencies
    .slice(0, 100) // Top 100 pairs to stay within token limits
    .map((p) => `${p.a} + ${p.b}: ${p.count}/${matrix.totalTransactions}`)
    .join("\n");

  const prompt = `You are a market-basket analysis engine.

Given these product co-occurrence frequencies from ${matrix.totalTransactions} sales transactions:

${pairLines}

Extract the top 20 most actionable association rules. For each rule:
- antecedent: the product IDs that trigger the suggestion (1-2 products)
- consequent: the suggested product ID(s) (1-2 products)
- confidence: estimated P(consequent | antecedent) as a decimal 0-1
- support: fraction of total transactions containing this combination
- lift: how much more likely consequent is given antecedent (> 1 = positive)

Return ONLY a JSON array of rules matching this schema:
[{"antecedent":["prod-id"],"consequent":["prod-id"],"confidence":0.0,"support":0.0,"lift":0.0}]

Rules MUST:
- Have confidence > ${MIN_CONFIDENCE}
- Have support > ${MIN_SUPPORT}
- Only reference product IDs from the input data
- Not include duplicate rules`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,           // Deterministic output for rules
      max_tokens: 2000,
      response_format: { type: "json_object" }, // Ensures valid JSON
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }

  const body = await response.json();
  const content: string = body.choices?.[0]?.message?.content ?? "[]";

  // Parse and validate the response
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Failed to parse OpenAI response as JSON: ${content}`);
  }

  // Handle both {rules: [...]} and [...] response shapes
  const rulesArray = Array.isArray(parsed)
    ? parsed
    : (parsed as Record<string, unknown>).rules ?? [];

  if (!Array.isArray(rulesArray)) {
    throw new Error("OpenAI did not return an array of rules");
  }

  // Validate and filter rules
  return (rulesArray as RawRule[]).filter(
    (r) =>
      r.confidence >= MIN_CONFIDENCE &&
      r.support >= MIN_SUPPORT &&
      r.lift > 1.0 &&
      Array.isArray(r.antecedent) &&
      Array.isArray(r.consequent) &&
      r.antecedent.length > 0 &&
      r.consequent.length > 0
  );
}

// ---------------------------------------------------------------------------
// Task 21.5: storeAssociationRules
// ---------------------------------------------------------------------------

/**
 * Upsert association rules into the database.
 *
 * Why upsert instead of delete + insert?
 * The mobile sync engine reads from this table. A delete would cause
 * a momentary gap where the POS has no rules (bad UX during peak hours).
 * Upsert updates existing rules atomically.
 *
 * One row per (business_id, product_id) — the mobile client reads
 * "what should I suggest when product X is in the cart?"
 *
 * @returns Number of rules upserted
 */
async function storeAssociationRules(
  supabase: ReturnType<typeof createClient>,
  businessId: string,
  rules: RawRule[]
): Promise<number> {
  if (rules.length === 0) {
    return 0;
  }

  const now = new Date().toISOString();

  // Flatten: for each antecedent product, create one row with all suggestions
  const rowsByProduct = new Map<string, AssociationRule>();

  for (const rule of rules) {
    for (const antecedentId of rule.antecedent) {
      const existing = rowsByProduct.get(antecedentId);
      if (existing) {
        // Merge consequent products into existing row
        const allSuggested = new Set([
          ...existing.suggested_product_ids,
          ...rule.consequent,
        ]);
        // Keep highest confidence rule for this antecedent
        if (rule.confidence > existing.confidence) {
          rowsByProduct.set(antecedentId, {
            ...existing,
            suggested_product_ids: [...allSuggested],
            confidence: rule.confidence,
            support: rule.support,
            lift: rule.lift,
          });
        } else {
          rowsByProduct.set(antecedentId, {
            ...existing,
            suggested_product_ids: [...allSuggested],
          });
        }
      } else {
        rowsByProduct.set(antecedentId, {
          business_id: businessId,
          product_id: antecedentId,
          suggested_product_ids: rule.consequent,
          confidence: rule.confidence,
          support: rule.support,
          lift: rule.lift,
          updated_at: now,
        });
      }
    }
  }

  const rows = [...rowsByProduct.values()];

  const { error } = await supabase
    .from("association_rules")
    .upsert(rows, { onConflict: "business_id,product_id" });

  if (error) {
    throw new Error(`storeAssociationRules failed: ${error.message}`);
  }

  return rows.length;
}

// ---------------------------------------------------------------------------
// Task 21.3 (helper): Subscription tier check
// ---------------------------------------------------------------------------

/**
 * Verify the business has an active paid subscription.
 * Returns false for "Basic" tier — AI features are disabled.
 *
 * Validates: pos-core Requirement 11.10
 */
async function isAiFeatureEnabled(
  supabase: ReturnType<typeof createClient>,
  businessId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("businesses")
    .select("subscription_tier")
    .eq("id", businessId)
    .single();

  if (error || !data) {
    // Default to disabled on error to avoid unexpected AI charges
    return false;
  }

  // Only "Professional" and "Enterprise" tiers get AI features
  return data.subscription_tier !== "basic";
}

// ---------------------------------------------------------------------------
// Task 21.6: Main handler + error handling and logging
// ---------------------------------------------------------------------------

/**
 * Main Edge Function handler.
 *
 * Expected request body:
 * { "businessId": "uuid" }
 *
 * Returns:
 * { "rulesGenerated": N, "businessId": "...", "timestamp": "ISO" }
 *
 * Error responses:
 * 400 — missing/invalid businessId
 * 402 — subscription tier does not include AI features
 * 500 — internal error (logged, sanitised message returned)
 */
serve(async (req: Request) => {
  // CORS headers for Supabase dashboard testing
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  const requestId = crypto.randomUUID();
  const startMs = Date.now();

  console.log(`[${requestId}] generate-association-rules started`);

  try {
    // --- Parse and validate request body ---
    let body: { businessId?: string };
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "Invalid JSON body", requestId);
    }

    const { businessId } = body;
    if (!businessId || typeof businessId !== "string") {
      return jsonError(400, "businessId is required (string)", requestId);
    }

    // --- Initialize Supabase client ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    if (!openaiKey) {
      throw new Error("Missing OPENAI_API_KEY");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- Subscription tier check (Req 11.10) ---
    const aiEnabled = await isAiFeatureEnabled(supabase, businessId);
    if (!aiEnabled) {
      console.log(`[${requestId}] AI disabled for business ${businessId} (Basic tier)`);
      return jsonError(402, "AI features require Professional or Enterprise tier", requestId);
    }

    // --- Task 21.2: Fetch recent orders ---
    console.log(`[${requestId}] Fetching recent orders for business ${businessId}...`);
    const transactions = await fetchRecentOrders(supabase, businessId);
    console.log(`[${requestId}] Fetched ${transactions.length} transactions`);

    if (transactions.length < 10) {
      // Not enough data for meaningful rules
      console.log(`[${requestId}] Insufficient data (< 10 transactions), skipping AI call`);
      return jsonSuccess(0, businessId, requestId, startMs);
    }

    // --- Task 21.3: Build transaction matrix ---
    const matrix = buildTransactionMatrix(transactions);
    console.log(
      `[${requestId}] Matrix built: ${matrix.pairFrequencies.length} pairs from ${matrix.totalTransactions} transactions`
    );

    if (matrix.pairFrequencies.length === 0) {
      console.log(`[${requestId}] No frequent pairs found, skipping AI call`);
      return jsonSuccess(0, businessId, requestId, startMs);
    }

    // --- Task 21.4: Call GPT-4o-mini ---
    console.log(`[${requestId}] Calling GPT-4o-mini for rule extraction...`);
    const rawRules = await callGPT4oMini(matrix, openaiKey);
    console.log(`[${requestId}] GPT returned ${rawRules.length} valid rules`);

    // --- Task 21.5: Store rules ---
    const stored = await storeAssociationRules(supabase, businessId, rawRules);
    console.log(`[${requestId}] Stored ${stored} rule rows in ${Date.now() - startMs}ms`);

    return jsonSuccess(stored, businessId, requestId, startMs);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[${requestId}] FATAL ERROR: ${message}`);
    // Return sanitised error — don't leak internal details
    return jsonError(500, "Rule generation failed. Check function logs.", requestId);
  }
});

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function jsonSuccess(
  rulesGenerated: number,
  businessId: string,
  requestId: string,
  startMs: number
): Response {
  return new Response(
    JSON.stringify({
      ok: true,
      rulesGenerated,
      businessId,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startMs,
      requestId,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

function jsonError(
  status: number,
  message: string,
  requestId: string
): Response {
  return new Response(
    JSON.stringify({ ok: false, error: message, requestId }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}
