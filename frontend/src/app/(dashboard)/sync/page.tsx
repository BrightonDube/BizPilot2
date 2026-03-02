import SyncDashboardClient from "./SyncDashboardClient";

export const metadata = {
  title: "Sync Dashboard | BizPilot",
  description: "Monitor offline sync queue status and metadata watermarks.",
};

export default function SyncPage() {
  return <SyncDashboardClient />;
}
