#!/bin/bash
cd frontend

sed -i 's/const params: Record<string, any> = { page, per_page: perPage };/const params: Record<string, string | number> = { page, per_page: perPage };/g' src/app/\(dashboard\)/order-history/page.tsx

