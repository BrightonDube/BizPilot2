#!/bin/bash
cd frontend

sed -i 's/} catch (err: any) {/} catch (err: unknown) {/g' src/app/\(dashboard\)/sage/SageIntegrationClient.tsx
sed -i 's/in_progress: "info" as any,/in_progress: "default",/g' src/app/\(dashboard\)/sage/SageIntegrationClient.tsx

