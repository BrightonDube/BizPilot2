'use client';

/**
 * BulkTemplatesManager — CRUD interface for bulk operation templates.
 *
 * Templates let merchants save frequently-used bulk operation configurations
 * (e.g. "10% price increase on seasonal items") and re-apply them with a
 * single click.  System-wide templates (is_system=true) are read-only for
 * regular users.
 *
 * Why a separate component?  Template management is conceptually independent
 * from running operations — it's a configuration concern, not a workflow one.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  FileText,
  Lock,
} from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────────────────── */

interface BulkTemplate {
  id: string;
  name: string;
  description: string | null;
  operation_type: string;
  template_data: Record<string, unknown>;
  is_system: boolean;
  created_at: string;
}

interface TemplateForm {
  name: string;
  description: string;
  operation_type: string;
  template_data: string; // JSON string for editing
}

const OPERATION_TYPES = [
  { value: 'price_update', label: 'Price Update' },
  { value: 'stock_adjustment', label: 'Stock Adjustment' },
  { value: 'category_assign', label: 'Category Assignment' },
  { value: 'supplier_assign', label: 'Supplier Assignment' },
  { value: 'product_import', label: 'Product Import' },
  { value: 'product_export', label: 'Product Export' },
  { value: 'product_activate', label: 'Product Activate' },
  { value: 'product_delete', label: 'Product Delete' },
];

const EMPTY_FORM: TemplateForm = {
  name: '',
  description: '',
  operation_type: 'price_update',
  template_data: '{}',
};

/* ── Component ──────────────────────────────────────────────────────────── */

export default function BulkTemplatesManager() {
  const [templates, setTemplates] = useState<BulkTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // template id or "new"
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  /* Fetch templates. */
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await apiClient.get('/bulk/templates');
      setTemplates(res.data.items ?? res.data ?? []);
      setError(null);
    } catch {
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  /* Open the create form. */
  const startCreate = () => {
    setForm(EMPTY_FORM);
    setEditing('new');
  };

  /* Open the edit form for an existing template. */
  const startEdit = (tpl: BulkTemplate) => {
    setForm({
      name: tpl.name,
      description: tpl.description ?? '',
      operation_type: tpl.operation_type,
      template_data: JSON.stringify(tpl.template_data, null, 2),
    });
    setEditing(tpl.id);
  };

  /* Cancel editing. */
  const cancelEdit = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  /* Save (create or update). */
  const handleSave = async () => {
    setSaving(true);
    try {
      let parsedData: Record<string, unknown>;
      try {
        parsedData = JSON.parse(form.template_data);
      } catch {
        setError('Invalid JSON in template data');
        setSaving(false);
        return;
      }

      const payload = {
        name: form.name,
        description: form.description || null,
        operation_type: form.operation_type,
        template_data: parsedData,
      };

      if (editing === 'new') {
        await apiClient.post('/bulk/templates', payload);
      } else {
        await apiClient.put(`/bulk/templates/${editing}`, payload);
      }

      cancelEdit();
      fetchTemplates();
    } catch {
      setError('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  /* Delete a template. */
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await apiClient.delete(`/bulk/templates/${id}`);
      fetchTemplates();
    } catch {
      setError('Failed to delete template');
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading templates…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Operation Templates</h2>
        <button
          onClick={startCreate}
          className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-100 text-red-800 text-sm">{error}</div>
      )}

      {/* Create / Edit form */}
      {editing && (
        <div className="bg-white border rounded-lg shadow-sm p-4 space-y-3">
          <h3 className="font-medium text-sm">
            {editing === 'new' ? 'Create Template' : 'Edit Template'}
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded-lg p-2 text-sm"
                placeholder="e.g. Seasonal 10% Increase"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Operation Type</label>
              <select
                value={form.operation_type}
                onChange={(e) => setForm({ ...form, operation_type: e.target.value })}
                className="w-full border rounded-lg p-2 text-sm"
              >
                {OPERATION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border rounded-lg p-2 text-sm"
              placeholder="Optional description"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Template Data (JSON)
            </label>
            <textarea
              value={form.template_data}
              onChange={(e) => setForm({ ...form, template_data: e.target.value })}
              className="w-full border rounded-lg p-2 text-sm font-mono"
              rows={4}
              placeholder='{"adjustment_type": "percentage", "adjustment_value": 10}'
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !form.name}
              className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
            <button
              onClick={cancelEdit}
              className="flex items-center gap-1 text-gray-600 hover:text-gray-800 px-4 py-2 text-sm"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Templates list */}
      {templates.length === 0 ? (
        <p className="text-gray-500 text-sm">No templates yet. Create one to get started.</p>
      ) : (
        <div className="grid gap-3">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white border rounded-lg shadow-sm p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{tpl.name}</span>
                    {tpl.is_system && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        <Lock className="w-3 h-3" /> System
                      </span>
                    )}
                    <span className="text-xs text-gray-400 capitalize">
                      {tpl.operation_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {tpl.description && (
                    <p className="text-xs text-gray-500 truncate">{tpl.description}</p>
                  )}
                </div>
              </div>

              {/* Actions — system templates are read-only */}
              {!tpl.is_system && (
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => startEdit(tpl)}
                    className="text-blue-500 hover:text-blue-700 p-1"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(tpl.id)}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
