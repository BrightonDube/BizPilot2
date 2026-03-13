"use client";

/**
 * Smart Collections Management Client.
 *
 * Manages rule-based product groupings with CRUD operations,
 * product membership management, and collection refresh triggers.
 *
 * Why smart collections need their own page?
 * Collections involve complex rule configuration (AND/OR logic,
 * multiple criteria), product membership management, and refresh
 * scheduling. This is too much UI surface for a tab in the tags page.
 */

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import {
  Badge,
  Button,
  Input,
  Card,
  CardContent,
  PageHeader,
  LoadingSpinner,
} from "@/components/ui";
import {
  FolderOpen,
  Plus,
  RefreshCw,
  Trash2,
  Package,
  Edit2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Rule {
  id: string;
  type: "tag" | "category" | "price" | "inventory";
  operator: "is" | "is_not" | "greater_than" | "less_than" | "contains";
  value: string | number | string[];
}

interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  rules: Rule[] | null;
  rule_logic: "and" | "or";
  is_active: boolean;
  auto_update: boolean;
  product_count: number;
  last_refresh_at: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CollectionsClient() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    rule_logic: "and" as "and" | "or",
    auto_update: true,
  });

  // ------------------------------------------------------------------
  // Data fetching
  // ------------------------------------------------------------------

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/api/collections", {
        params: { active_only: false },
      });
      setCollections(res.data.items ?? res.data);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error?.message ?? "Failed to load collections");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  const handleCreate = async () => {
    try {
      await apiClient.post("/api/collections", form);
      setShowCreate(false);
      setForm({
        name: "",
        slug: "",
        description: "",
        rule_logic: "and",
        auto_update: true,
      });
      load();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error?.message ?? "Failed to create collection");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/api/collections/${id}`);
      load();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error?.message ?? "Failed to delete");
    }
  };

  const handleRefresh = async (id: string) => {
    try {
      await apiClient.post(`/api/collections/${id}/refresh`);
      load();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error?.message ?? "Failed to refresh");
    }
  };

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setForm({ ...form, name, slug });
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader title="Smart Collections" />

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 p-3 rounded">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <p className="text-gray-400">
          Rule-based product groupings that auto-refresh.
        </p>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4 mr-1" /> New Collection
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-400">Name</label>
                <Input
                  placeholder="e.g. Summer Specials"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-gray-400">Slug (auto)</label>
                <Input value={form.slug} readOnly className="opacity-60" />
              </div>
              <div className="col-span-2">
                <label className="text-sm text-gray-400">Description</label>
                <Input
                  placeholder="Optional description"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm text-gray-400">Rule Logic</label>
                <select
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded p-2"
                  value={form.rule_logic}
                  onChange={(e) =>
                    setForm({ ...form, rule_logic: e.target.value as "and" | "or" })
                  }
                >
                  <option value="and">AND (all rules must match)</option>
                  <option value="or">OR (any rule can match)</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-gray-400">
                  <input
                    type="checkbox"
                    checked={form.auto_update}
                    onChange={(e) =>
                      setForm({ ...form, auto_update: e.target.checked })
                    }
                  />
                  Auto-update products
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate}>Create</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Collection list */}
      {loading ? (
        <LoadingSpinner />
      ) : collections.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FolderOpen className="h-12 w-12 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400">
              No collections yet. Create one to group products automatically.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {collections.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-white">{c.name}</h3>
                    <p className="text-xs text-gray-500">/{c.slug}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={c.is_active ? "success" : "secondary"}>
                      {c.is_active ? "Active" : "Inactive"}
                    </Badge>
                    {c.auto_update && (
                      <Badge variant="info">Auto</Badge>
                    )}
                  </div>
                </div>

                {c.description && (
                  <p className="text-sm text-gray-400">{c.description}</p>
                )}

                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {c.product_count} products
                  </span>
                  <span>Logic: {c.rule_logic.toUpperCase()}</span>
                  {c.last_refresh_at && (
                    <span>
                      Last refresh:{" "}
                      {new Date(c.last_refresh_at).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <div className="flex gap-2 pt-2 border-t border-gray-700">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRefresh(c.id)}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" /> Refresh
                  </Button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="text-gray-500 hover:text-red-400 ml-auto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
