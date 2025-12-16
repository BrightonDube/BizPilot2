'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  FolderTree,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Palette,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Input,
  Card,
  CardContent,
  Badge,
} from '@/components/ui';
import { apiClient } from '@/lib/api';

interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  parent_id: string | null;
  sort_order: number;
  product_count: number;
}

interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}

interface CategoryListResponse {
  items: Category[];
  total: number;
}

interface CategoryTreeResponse {
  items: CategoryTreeNode[];
  total: number;
}

const colorOptions = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e',
];

function CategoryTreeItem({
  category,
  level = 0,
  onEdit,
  onDelete,
  deletingId,
}: {
  category: CategoryTreeNode;
  level?: number;
  onEdit: (category: Category) => void;
  onDelete: (id: string, name: string) => void;
  deletingId: string | null;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = category.children && category.children.length > 0;

  return (
    <div>
      <motion.div
        className={`flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800/50 transition-colors ${
          level > 0 ? 'ml-6' : ''
        }`}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
      >
        {hasChildren ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-gray-700 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </button>
        ) : (
          <div className="w-6" />
        )}

        <div
          className="w-4 h-4 rounded-full flex-shrink-0"
          style={{ backgroundColor: category.color || '#6b7280' }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-100">{category.name}</span>
            <Badge variant="default" className="text-xs">
              {category.product_count} products
            </Badge>
          </div>
          {category.description && (
            <p className="text-sm text-gray-400 truncate">{category.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(category)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-400 hover:text-red-300"
            onClick={() => onDelete(category.id, category.name)}
            disabled={deletingId === category.id}
          >
            {deletingId === category.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </motion.div>

      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-l-2 border-gray-700 ml-4"
          >
            {category.children.map((child) => (
              <CategoryTreeItem
                key={child.id}
                category={child}
                level={level + 1}
                onEdit={onEdit}
                onDelete={onDelete}
                deletingId={deletingId}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryTreeNode[]>([]);
  const [flatCategories, setFlatCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
    parent_id: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      setIsLoading(true);
      setError(null);

      const [treeResponse, listResponse] = await Promise.all([
        apiClient.get<CategoryTreeResponse>('/categories/tree'),
        apiClient.get<CategoryListResponse>('/categories'),
      ]);

      setCategories(treeResponse.data.items);
      setFlatCategories(listResponse.data.items);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      setError('Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color || '#3b82f6',
      parent_id: category.parent_id || '',
    });
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      color: '#3b82f6',
      parent_id: '',
    });
    setShowModal(true);
  };

  const handleDelete = async (categoryId: string, categoryName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${categoryName}"? Products in this category will be moved to the parent category.`)) {
      return;
    }

    try {
      setDeletingId(categoryId);
      await apiClient.delete(`/categories/${categoryId}`);
      await fetchCategories();
    } catch (err) {
      console.error('Failed to delete category:', err);
      setError('Failed to delete category');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const data = {
        name: formData.name,
        description: formData.description || null,
        color: formData.color,
        parent_id: formData.parent_id || null,
      };

      if (editingCategory) {
        await apiClient.put(`/categories/${editingCategory.id}`, data);
      } else {
        await apiClient.post('/categories', data);
      }

      setShowModal(false);
      await fetchCategories();
    } catch (err) {
      console.error('Failed to save category:', err);
      setError('Failed to save category');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
          <p className="mt-2 text-gray-400">Loading categories...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <PageHeader
        title="Categories"
        description="Organize your products into categories"
        actions={
          <Button
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            onClick={handleCreate}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        }
      />

      {error && (
        <motion.div
          className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        </motion.div>
      )}

      {categories.length === 0 ? (
        <motion.div
          className="text-center py-12"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <FolderTree className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-100 mb-2">No categories yet</h3>
          <p className="text-gray-400 mb-6">Create categories to organize your products</p>
          <Button
            className="bg-gradient-to-r from-blue-600 to-purple-600"
            onClick={handleCreate}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Category
          </Button>
        </motion.div>
      ) : (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            {categories.map((category) => (
              <CategoryTreeItem
                key={category.id}
                category={category}
                onEdit={handleEdit}
                onDelete={handleDelete}
                deletingId={deletingId}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Category Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-semibold text-white mb-4">
                {editingCategory ? 'Edit Category' : 'New Category'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Name *
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Category name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description"
                    rows={2}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Parent Category
                  </label>
                  <select
                    value={formData.parent_id}
                    onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">None (Top Level)</option>
                    {flatCategories
                      .filter((c) => c.id !== editingCategory?.id)
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Palette className="h-4 w-4 inline mr-1" />
                    Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, color })}
                        className={`w-8 h-8 rounded-full border-2 transition-transform ${
                          formData.color === color
                            ? 'border-white scale-110'
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="gradient"
                    className="flex-1"
                    disabled={isSaving || !formData.name}
                  >
                    {isSaving ? 'Saving...' : editingCategory ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
