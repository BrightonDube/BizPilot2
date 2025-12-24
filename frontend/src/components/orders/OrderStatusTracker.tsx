import { CheckCircle2, CircleDot, Clock, Truck, Package, XCircle } from 'lucide-react';

const STATUS_STEPS: { key: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'draft', label: 'Draft', icon: Clock },
  { key: 'pending', label: 'Pending', icon: CircleDot },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
  { key: 'processing', label: 'Processing', icon: Package },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
  { key: 'cancelled', label: 'Cancelled', icon: XCircle },
];

interface OrderStatusTrackerProps {
  status: string;
}

export function OrderStatusTracker({ status }: OrderStatusTrackerProps) {
  const currentIndex = STATUS_STEPS.findIndex((step) => step.key === status);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        {STATUS_STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index <= currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div key={step.key} className="flex items-center gap-2">
              <div
                className={`h-9 px-3 rounded-full border text-sm flex items-center gap-2 ${
                  isActive
                    ? 'border-green-500/60 bg-green-500/10 text-green-200'
                    : 'border-gray-700 bg-gray-800 text-gray-400'
                } ${isCurrent ? 'ring-2 ring-blue-500/40' : ''}`}
              >
                <Icon className="w-4 h-4" />
                <span className="capitalize">{step.label}</span>
              </div>
              {index < STATUS_STEPS.length - 1 && (
                <div className="w-10 h-px bg-gray-700" aria-hidden />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
