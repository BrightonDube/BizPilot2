/**
 * CostBreakdownView — shows the full cost breakdown for a recipe.
 * (recipe-management task 3.4)
 *
 * Layout: A card-based view showing:
 *   1. Summary header: total cost, cost/portion, food-cost %
 *   2. Pie/stacked bar of cost composition (ingredient lines)
 *   3. Line-by-line ingredient costs in a mini table
 *   4. Waste factor contribution
 *
 * Why a standalone component rather than embedding in the form?
 * Cost breakdown is shown in multiple contexts: recipe detail page, menu
 * engineering screen, POS item info popup. Keeping it standalone maximises
 * reuse.
 *
 * Why no charting library?
 * A simple horizontal stacked bar rendered with View + flex is 0 KB extra
 * bundle size and renders in <1ms. A charting lib would add 50+ KB for a
 * single bar chart. The cost bar is purely decorative — screen reader users
 * get the same info from the text table.
 */

import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  calculateRecipeCost,
  calculateFoodCostPercentage,
} from "@/services/recipe/RecipeService";
import type { Recipe, RecipeCostBreakdown } from "@/services/recipe/RecipeService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CostBreakdownViewProps {
  /** The recipe to analyse. */
  recipe: Recipe;
  /** Selling price of the linked menu item (for food-cost % calc). Optional. */
  sellingPrice?: number;
}

// ---------------------------------------------------------------------------
// Colour palette for ingredient bars (10 colours, cycles if > 10 ingredients)
// ---------------------------------------------------------------------------

const BAR_COLORS = [
  "#3b82f6", "#22c55e", "#fbbf24", "#ef4444", "#a855f7",
  "#14b8a6", "#f97316", "#ec4899", "#6366f1", "#84cc16",
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  label: string;
  value: string;
  icon: string;
  iconColor: string;
}

const SummaryCard = React.memo(function SummaryCard({
  label,
  value,
  icon,
  iconColor,
}: SummaryCardProps) {
  return (
    <View style={styles.summaryCard}>
      <Ionicons name={icon as any} size={22} color={iconColor} />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const CostBreakdownView: React.FC<CostBreakdownViewProps> = React.memo(
  function CostBreakdownView({ recipe, sellingPrice }) {
    const breakdown: RecipeCostBreakdown = useMemo(
      () => calculateRecipeCost(recipe),
      [recipe]
    );

    const foodCostPct = useMemo(
      () =>
        sellingPrice && sellingPrice > 0
          ? calculateFoodCostPercentage(recipe, sellingPrice)
          : null,
      [recipe, sellingPrice]
    );

    // Colour code food cost: green ≤30%, amber 30-35%, red >35%
    const foodCostColor = useMemo(() => {
      if (foodCostPct === null) return "#9ca3af";
      if (foodCostPct > 35) return "#ef4444";
      if (foodCostPct > 30) return "#fbbf24";
      return "#22c55e";
    }, [foodCostPct]);

    // Gross profit
    const grossProfit = useMemo(() => {
      if (!sellingPrice || sellingPrice <= 0) return null;
      return Math.round((sellingPrice - breakdown.costPerPortion) * 100) / 100;
    }, [sellingPrice, breakdown]);

    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Cost Breakdown</Text>

        {/* Summary cards row */}
        <View style={styles.summaryRow}>
          <SummaryCard
            label="Total Cost"
            value={`R ${breakdown.totalCost.toFixed(2)}`}
            icon="wallet-outline"
            iconColor="#3b82f6"
          />
          <SummaryCard
            label="Per Portion"
            value={`R ${breakdown.costPerPortion.toFixed(2)}`}
            icon="restaurant-outline"
            iconColor="#22c55e"
          />
          {foodCostPct !== null && (
            <SummaryCard
              label="Food Cost %"
              value={`${foodCostPct.toFixed(1)}%`}
              icon="pie-chart-outline"
              iconColor={foodCostColor}
            />
          )}
          {grossProfit !== null && (
            <SummaryCard
              label="Gross Profit"
              value={`R ${grossProfit.toFixed(2)}`}
              icon="trending-up-outline"
              iconColor={grossProfit >= 0 ? "#22c55e" : "#ef4444"}
            />
          )}
        </View>

        {/* Cost composition bar */}
        {breakdown.lines.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cost Composition</Text>
            <View style={styles.barContainer}>
              {breakdown.lines.map((line, i) => {
                const pct =
                  breakdown.rawIngredientCost > 0
                    ? (line.lineCost / breakdown.rawIngredientCost) * 100
                    : 0;
                if (pct < 0.5) return null; // skip tiny slivers
                return (
                  <View
                    key={line.ingredientId}
                    style={[
                      styles.barSegment,
                      {
                        flex: pct,
                        backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                      },
                    ]}
                    accessibilityLabel={`${line.name}: ${pct.toFixed(0)}%`}
                  />
                );
              })}
            </View>
            {/* Legend */}
            <View style={styles.legendRow}>
              {breakdown.lines.map((line, i) => (
                <View key={line.ingredientId} style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: BAR_COLORS[i % BAR_COLORS.length] },
                    ]}
                  />
                  <Text style={styles.legendText} numberOfLines={1}>
                    {line.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Ingredient cost table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ingredient Costs</Text>

          {/* Table header */}
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableHeader, { flex: 3 }]}>
              Ingredient
            </Text>
            <Text style={[styles.tableCell, styles.tableHeader, { flex: 1 }]}>
              Qty
            </Text>
            <Text style={[styles.tableCell, styles.tableHeader, { flex: 1 }]}>
              Unit Cost
            </Text>
            <Text style={[styles.tableCell, styles.tableHeader, { flex: 1 }]}>
              Line Cost
            </Text>
          </View>

          {/* Table rows */}
          {breakdown.lines.map((line) => (
            <View key={line.ingredientId} style={styles.tableRow}>
              <Text
                style={[styles.tableCell, { flex: 3 }]}
                numberOfLines={1}
              >
                {line.name}
              </Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>
                {line.quantity}
              </Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>
                R {line.unitCost.toFixed(2)}
              </Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>
                R {line.lineCost.toFixed(2)}
              </Text>
            </View>
          ))}

          {/* Waste row */}
          <View style={[styles.tableRow, styles.wasteRow]}>
            <Text style={[styles.tableCell, styles.wasteLabel, { flex: 5 }]}>
              Waste ({(recipe.wasteFactor * 100).toFixed(0)}%)
            </Text>
            <Text style={[styles.tableCell, styles.wasteValue, { flex: 1 }]}>
              R {breakdown.wasteAmount.toFixed(2)}
            </Text>
          </View>

          {/* Total row */}
          <View style={[styles.tableRow, styles.totalRow]}>
            <Text style={[styles.tableCell, styles.totalLabel, { flex: 5 }]}>
              Total
            </Text>
            <Text style={[styles.tableCell, styles.totalValue, { flex: 1 }]}>
              R {breakdown.totalCost.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { backgroundColor: "#0f172a", padding: 16 },
  heading: { fontSize: 20, fontWeight: "700", color: "#f3f4f6", marginBottom: 16 },

  // Summary cards
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  summaryCard: {
    flex: 1,
    minWidth: 120,
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  summaryValue: { fontSize: 18, fontWeight: "700", color: "#f3f4f6", marginTop: 6 },
  summaryLabel: { fontSize: 12, color: "#9ca3af", marginTop: 2 },

  // Sections
  section: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },

  // Cost bar
  barContainer: {
    flexDirection: "row",
    height: 20,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 10,
  },
  barSegment: { height: "100%" },

  // Legend
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  legendItem: { flexDirection: "row", alignItems: "center" },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 4 },
  legendText: { fontSize: 12, color: "#d1d5db", maxWidth: 100 },

  // Table
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  tableCell: { fontSize: 14, color: "#d1d5db" },
  tableHeader: { fontWeight: "700", color: "#9ca3af" },
  wasteRow: { borderBottomColor: "#4b5563" },
  wasteLabel: { fontStyle: "italic", color: "#fbbf24" },
  wasteValue: { color: "#fbbf24", fontWeight: "600" },
  totalRow: { borderBottomWidth: 0, marginTop: 4 },
  totalLabel: { fontWeight: "700", color: "#f3f4f6", fontSize: 15 },
  totalValue: { fontWeight: "700", color: "#f3f4f6", fontSize: 15 },
});

export default CostBreakdownView;
