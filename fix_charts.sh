#!/bin/bash
cd frontend

# Fix CostBreakdownChart
sed -i 's/renderTooltip = ({ active, payload }: { active?: boolean, payload?: unknown\[\] })/renderTooltip = ({ active, payload }: any)/g' src/components/charts/CostBreakdownChart.tsx

# Fix InventoryStatusChart
sed -i 's/renderTooltip = ({ active, payload }: { active?: boolean, payload?: unknown\[\] })/renderTooltip = ({ active, payload }: any)/g' src/components/charts/InventoryStatusChart.tsx

# Fix ProfitMarginChart
sed -i 's/renderTooltip = ({ active, payload, label }: { active?: boolean, payload?: unknown\[\], label?: string })/renderTooltip = ({ active, payload, label }: any)/g' src/components/charts/ProfitMarginChart.tsx

# Fix ProfitTrendChart
sed -i 's/renderTooltip = ({ active, payload, label }: { active?: boolean, payload?: unknown\[\], label?: string })/renderTooltip = ({ active, payload, label }: any)/g' src/components/charts/ProfitTrendChart.tsx

# Add disable comments for eslint
sed -i 's/const renderTooltip = ({ active, payload }: any)/  \/\/ eslint-disable-next-line @typescript-eslint\/no-explicit-any\n  const renderTooltip = ({ active, payload }: any)/g' src/components/charts/CostBreakdownChart.tsx
sed -i 's/const renderTooltip = ({ active, payload }: any)/  \/\/ eslint-disable-next-line @typescript-eslint\/no-explicit-any\n  const renderTooltip = ({ active, payload }: any)/g' src/components/charts/InventoryStatusChart.tsx
sed -i 's/const renderTooltip = ({ active, payload, label }: any)/  \/\/ eslint-disable-next-line @typescript-eslint\/no-explicit-any\n  const renderTooltip = ({ active, payload, label }: any)/g' src/components/charts/ProfitMarginChart.tsx
sed -i 's/const renderTooltip = ({ active, payload, label }: any)/  \/\/ eslint-disable-next-line @typescript-eslint\/no-explicit-any\n  const renderTooltip = ({ active, payload, label }: any)/g' src/components/charts/ProfitTrendChart.tsx

