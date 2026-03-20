#!/bin/bash
cd frontend

# Fix CostBreakdownChart
sed -i 's/renderTooltip = ({ active, payload }: { active?: boolean, payload?: any\[\] })/renderTooltip = ({ active, payload }: { active?: boolean, payload?: unknown\[\] })/g' src/components/charts/CostBreakdownChart.tsx

# Fix InventoryStatusChart
sed -i 's/renderTooltip = ({ active, payload }: { active?: boolean, payload?: any\[\] })/renderTooltip = ({ active, payload }: { active?: boolean, payload?: unknown\[\] })/g' src/components/charts/InventoryStatusChart.tsx

# Fix ProfitMarginChart
sed -i 's/renderTooltip = ({ active, payload, label }: { active?: boolean, payload?: any\[\], label?: string })/renderTooltip = ({ active, payload, label }: { active?: boolean, payload?: unknown\[\], label?: string })/g' src/components/charts/ProfitMarginChart.tsx

# Fix ProfitTrendChart
sed -i 's/renderTooltip = ({ active, payload, label }: { active?: boolean, payload?: any\[\], label?: string })/renderTooltip = ({ active, payload, label }: { active?: boolean, payload?: unknown\[\], label?: string })/g' src/components/charts/ProfitTrendChart.tsx

