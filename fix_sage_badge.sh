#!/bin/bash
cd frontend

sed -i 's/Record<string, "success" | "danger" | "warning" | "secondary">/Record<string, "success" | "danger" | "warning" | "secondary" | "info" | "default">/g' src/app/\(dashboard\)/sage/SageIntegrationClient.tsx
sed -i 's/in_progress: "default"/in_progress: "info"/g' src/app/\(dashboard\)/sage/SageIntegrationClient.tsx

