'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import {
  Badge,
  Button,
  Input,
  Card,
  CardContent,
  PageHeader,
  LoadingSpinner,
} from '@/components/ui';
import {
  Plus,
  Search,
  Tags,
  FolderOpen,
  Trash2,
  ChevronRight,
} from 'lucide-react';

/* ------------------------------------------------------------------
 * Types
 * ----------------------------------------------------------------*/

interface TagCategory {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

interface Tag {
  id: string;
  business_id: string;
  category_id: string | null;
  parent_tag_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  hierarchy_level: number;
  hierarchy_path: string | null;
  usage_count: number;
  is_system_tag: boolean;
  is_active: boolean;
  created_at: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

/* ------------------------------------------------------------------
 * Component
 * ----------------------------------------------------------------*/

export default function TagsPageClient() {
  // State
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [tagPage, setTagPage] = useState(1);
  const [tagPages, setTagPages] = useState(0);
  const [tagTotal, setTagTotal] = useState(0);

  // Create form state
  const [newCatName, setNewCatName] = useState('');
  const [newCatSlug, setNewCatSlug] = useState('');
  const [newCatColor, setNewCatColor] = useState('#3b82f6');
  const [newTagName, setNewTagName] = useState('');
  const [newTagSlug, setNewTagSlug] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const res = await apiClient.get<PaginatedResponse<TagCategory>>(
        '/api/v1/tags/categories'
      );
      setCategories(res.data.items);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  }, []);

  // Fetch tags
  const fetchTags = useCallback(async () => {
    try {
      const params: Record<string, string> = {
        page: tagPage.toString(),
        per_page: '30',
      };
      if (selectedCategory) params.category_id = selectedCategory;
      if (search) params.search = search;

      const res = await apiClient.get<PaginatedResponse<Tag>>('/api/v1/tags', {
        params,
      });
      setTags(res.data.items);
      setTagPages(res.data.pages);
      setTagTotal(res.data.total);
    } catch (err) {
      console.error('Failed to fetch tags:', err);
    }
  }, [tagPage, selectedCategory, search]);

  useEffect(() => {
    Promise.resolve().then(() => {
      Promise.all([fetchCategories(), fetchTags()]).finally(() =>
        setLoading(false)
      );
    });
  }, [fetchCategories, fetchTags]);

  // Create category
  const handleCreateCategory = async () => {
    if (!newCatName || !newCatSlug) return;
    try {
      await apiClient.post('/api/v1/tags/categories', {
        name: newCatName,
        slug: newCatSlug,
        color: newCatColor,
      });
      setNewCatName('');
      setNewCatSlug('');
      setShowCreateCategory(false);
      fetchCategories();
    } catch (err) {
      console.error('Failed to create category:', err);
    }
  };

  // Create tag
  const handleCreateTag = async () => {
    if (!newTagName || !newTagSlug) return;
    try {
      await apiClient.post('/api/v1/tags', {
        name: newTagName,
        slug: newTagSlug,
        color: newTagColor,
        category_id: selectedCategory || undefined,
      });
      setNewTagName('');
      setNewTagSlug('');
      setShowCreateTag(false);
      fetchTags();
    } catch (err) {
      console.error('Failed to create tag:', err);
    }
  };

  // Delete tag
  const handleDeleteTag = async (tagId: string) => {
    if (!confirm('Delete this tag?')) return;
    try {
      await apiClient.delete(`/api/v1/tags/${tagId}`);
      fetchTags();
    } catch (err) {
      console.error('Failed to delete tag:', err);
    }
  };

  // Auto-generate slug from name
  const slugify = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tags & Categorization"
        description="Organize products with tags, categories, and hierarchies"
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar: Categories */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Categories
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowCreateCategory(!showCreateCategory)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {showCreateCategory && (
                <div className="space-y-2 mb-4 p-3 bg-gray-700/50 rounded-lg">
                  <Input
                    placeholder="Category name"
                    value={newCatName}
                    onChange={(e) => {
                      setNewCatName(e.target.value);
                      setNewCatSlug(slugify(e.target.value));
                    }}
                  />
                  <Input
                    placeholder="Slug"
                    value={newCatSlug}
                    onChange={(e) => setNewCatSlug(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={newCatColor}
                      onChange={(e) => setNewCatColor(e.target.value)}
                      className="h-9 w-9 rounded cursor-pointer"
                    />
                    <Button size="sm" onClick={handleCreateCategory} className="flex-1">
                      Create
                    </Button>
                  </div>
                </div>
              )}

              {/* All tags option */}
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setTagPage(1);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition-colors ${
                  selectedCategory === null
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-gray-400 hover:bg-gray-700/50'
                }`}
              >
                All Tags
              </button>

              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setTagPage(1);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 flex items-center gap-2 transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-blue-600/20 text-blue-400'
                      : 'text-gray-400 hover:bg-gray-700/50'
                  }`}
                >
                  {cat.color && (
                    <span
                      className="h-3 w-3 rounded-full inline-block flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                  )}
                  <span className="truncate">{cat.name}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Main: Tags */}
        <div className="lg:col-span-3 space-y-4">
          {/* Toolbar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                className="pl-10"
                placeholder="Search tags..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setTagPage(1);
                }}
              />
            </div>
            <Button onClick={() => setShowCreateTag(!showCreateTag)}>
              <Plus className="h-4 w-4 mr-2" />
              New Tag
            </Button>
          </div>

          {/* Create tag form */}
          {showCreateTag && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h4 className="text-sm font-semibold text-gray-300">Create Tag</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input
                    placeholder="Tag name"
                    value={newTagName}
                    onChange={(e) => {
                      setNewTagName(e.target.value);
                      setNewTagSlug(slugify(e.target.value));
                    }}
                  />
                  <Input
                    placeholder="Slug"
                    value={newTagSlug}
                    onChange={(e) => setNewTagSlug(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="h-9 w-9 rounded cursor-pointer"
                    />
                    <Button onClick={handleCreateTag} className="flex-1">
                      Create
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tag count */}
          <p className="text-sm text-gray-500">
            {tagTotal} tag{tagTotal !== 1 ? 's' : ''}
            {selectedCategory && ' in selected category'}
          </p>

          {/* Tags grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {tags.map((tag) => (
              <Card key={tag.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {tag.color && (
                        <span
                          className="h-3 w-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-200 truncate">
                          {tag.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{tag.slug}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {tag.usage_count} uses
                      </Badge>
                      <button
                        onClick={() => handleDeleteTag(tag.id)}
                        className="p-1 text-gray-500 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {tag.hierarchy_path && tag.hierarchy_path !== '/' && (
                    <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                      <ChevronRight className="h-3 w-3" />
                      {tag.hierarchy_path}
                    </p>
                  )}
                  {tag.is_system_tag && (
                    <Badge variant="info" className="mt-2 text-xs">
                      System
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {tags.length === 0 && (
            <div className="text-center py-12">
              <Tags className="h-12 w-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500">No tags found</p>
              <p className="text-sm text-gray-600">
                Create tags to organise your products
              </p>
            </div>
          )}

          {/* Pagination */}
          {tagPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={tagPage <= 1}
                onClick={() => setTagPage(tagPage - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-500">
                Page {tagPage} of {tagPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={tagPage >= tagPages}
                onClick={() => setTagPage(tagPage + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
