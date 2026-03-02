import CommissionsPageClient from "./CommissionsPageClient";

export const metadata = {
  title: "Commissions | BizPilot",
  description: "Manage staff commission records, approvals, and payroll exports.",
};

export default function CommissionsPage() {
  return <CommissionsPageClient />;
}
