#!/bin/bash
cd frontend

sed -i 's/} catch (err: any) {/} catch (err: unknown) {/g' src/app/\(dashboard\)/staff-targets/StaffTargetsClient.tsx

