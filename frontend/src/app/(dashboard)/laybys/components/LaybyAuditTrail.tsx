import { FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';
import type { LaybyAuditEntry } from '../types';

interface LaybyAuditTrailProps {
  auditTrail: LaybyAuditEntry[];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function LaybyAuditTrail({ auditTrail }: LaybyAuditTrailProps) {
  if (!auditTrail || auditTrail.length === 0) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            <FileText className="w-5 h-5 inline-block mr-2" />
            Audit Trail
          </h2>
          <p className="text-gray-400 text-center py-8">No audit records found</p>
        </CardContent>
      </Card>
    );
  }

  const sortedAudit = [...auditTrail].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          <FileText className="w-5 h-5 inline-block mr-2" />
          Audit Trail
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-400 pb-3 font-medium">Date</th>
                <th className="text-left text-gray-400 pb-3 font-medium">Action</th>
                <th className="text-left text-gray-400 pb-3 font-medium">Performed By</th>
                <th className="text-left text-gray-400 pb-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {sortedAudit.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-700/50">
                  <td className="py-3 text-white">{formatDate(entry.created_at)}</td>
                  <td className="py-3 text-gray-300">{formatAction(entry.action)}</td>
                  <td className="py-3 text-gray-300">{entry.performed_by || 'System'}</td>
                  <td className="py-3 text-gray-400">{entry.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
