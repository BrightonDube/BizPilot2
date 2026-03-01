'use client';

/**
 * Menu Engineering page - Manage menu items, modifier groups, recipes, and view the engineering matrix.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  UtensilsCrossed,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Save,
  Star,
  HelpCircle,
  TrendingDown,
  AlertCircle,
  ChefHat,
  Layers,
  Grid3X3,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
} from '@/components/ui';
import { PageHeader } from '@/components/ui/bizpilot';
import { apiClient } from '@/lib/api';

// --- Interfaces ---

interface MenuItem {
  id: string;
  name: string;
  price: number;
  cost: number;
  category: string;
  course?: string;
  available: boolean;
  popularity?: number;
  profit_margin?: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  min_selections: number;
  max_selections: number;
  modifiers: Modifier[];
}

interface Modifier {
  id: string;
  name: string;
  price_adjustment: number;
  available: boolean;
}

interface Recipe {
  id: string;
  name: string;
  menu_item_id?: string;
  ingredients: RecipeIngredient[];
  total_cost: number;
  yield_qty: number;
  cost_per_serving: number;
}

interface RecipeIngredient {
  id: string;
  product_name: string;
  quantity: number;
  unit: string;
  cost: number;
}

interface MatrixItem {
  id: string;
  name: string;
  category: string;
  popularity: number;
  profit_margin: number;
  quadrant: 'star' | 'puzzle' | 'plowhorse' | 'dog';
}

type TabKey = 'items' | 'modifiers' | 'recipes' | 'matrix';

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabDef[] = [
  { key: 'items', label: 'Menu Items', icon: <UtensilsCrossed className="h-4 w-4" /> },
  { key: 'modifiers', label: 'Modifier Groups', icon: <Layers className="h-4 w-4" /> },
  { key: 'recipes', label: 'Recipes', icon: <ChefHat className="h-4 w-4" /> },
  { key: 'matrix', label: 'Engineering Matrix', icon: <Grid3X3 className="h-4 w-4" /> },
];

const QUADRANT_STYLES: Record<string, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
  star: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Star', icon: <Star className="h-3.5 w-3.5" /> },
  puzzle: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Puzzle', icon: <HelpCircle className="h-3.5 w-3.5" /> },
  plowhorse: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Plowhorse', icon: <TrendingDown className="h-3.5 w-3.5" /> },
  dog: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Dog', icon: <AlertCircle className="h-3.5 w-3.5" /> },
};

// --- Helpers ---

const formatCurrency = (value: number) =>
  `R ${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// --- Main Page ---

export default function MenuEngineeringPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('items');
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Menu Items
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState({ name: '', price: '', cost: '', category: '', course: '', available: true });

  // Modifier Groups
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', required: false, min_selections: '0', max_selections: '1' });
  const [newModifier, setNewModifier] = useState({ group_id: '', name: '', price_adjustment: '0' });

  // Recipes
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);

  // Matrix
  const [matrixItems, setMatrixItems] = useState<MatrixItem[]>([]);

  // --- Data Fetching ---

  const fetchMenuItems = useCallback(async () => {
    try {
      const res = await apiClient.get('/menu-engineering/items');
      setMenuItems(res.data.items || res.data);
    } catch {
      // silent
    }
  }, []);

  const fetchModifierGroups = useCallback(async () => {
    try {
      const res = await apiClient.get('/menu-engineering/modifier-groups');
      setModifierGroups(res.data.items || res.data);
    } catch {
      // silent
    }
  }, []);

  const fetchRecipes = useCallback(async () => {
    try {
      const res = await apiClient.get('/menu-engineering/recipes');
      setRecipes(res.data.items || res.data);
    } catch {
      // silent
    }
  }, []);

  const fetchMatrix = useCallback(async () => {
    try {
      const res = await apiClient.get('/menu-engineering/matrix');
      setMatrixItems(res.data.items || res.data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.allSettled([fetchMenuItems(), fetchModifierGroups(), fetchRecipes(), fetchMatrix()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchMenuItems, fetchModifierGroups, fetchRecipes, fetchMatrix]);

  // --- Menu Item Handlers ---

  const openAddItem = () => {
    setEditingItem(null);
    setItemForm({ name: '', price: '', cost: '', category: '', course: '', available: true });
    setItemModalOpen(true);
  };

  const openEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      price: String(item.price),
      cost: String(item.cost),
      category: item.category,
      course: item.course || '',
      available: item.available,
    });
    setItemModalOpen(true);
  };

  const handleSaveItem = async () => {
    try {
      setActionLoading('save-item');
      const payload = {
        name: itemForm.name,
        price: parseFloat(itemForm.price),
        cost: parseFloat(itemForm.cost),
        category: itemForm.category,
        course: itemForm.course || undefined,
        available: itemForm.available,
      };
      if (editingItem) {
        await apiClient.patch(`/menu-engineering/items/${editingItem.id}`, payload);
      } else {
        await apiClient.post('/menu-engineering/items', payload);
      }
      setItemModalOpen(false);
      await fetchMenuItems();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      setActionLoading(id);
      await apiClient.delete(`/menu-engineering/items/${id}`);
      await fetchMenuItems();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      setActionLoading(item.id);
      await apiClient.patch(`/menu-engineering/items/${item.id}`, { available: !item.available });
      await fetchMenuItems();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  // --- Modifier Group Handlers ---

  const handleAddGroup = async () => {
    try {
      setActionLoading('add-group');
      await apiClient.post('/menu-engineering/modifier-groups', {
        name: groupForm.name,
        required: groupForm.required,
        min_selections: parseInt(groupForm.min_selections, 10),
        max_selections: parseInt(groupForm.max_selections, 10),
      });
      setGroupModalOpen(false);
      setGroupForm({ name: '', required: false, min_selections: '0', max_selections: '1' });
      await fetchModifierGroups();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddModifier = async (groupId: string) => {
    if (!newModifier.name) return;
    try {
      setActionLoading('add-modifier');
      await apiClient.post(`/menu-engineering/modifier-groups/${groupId}/modifiers`, {
        name: newModifier.name,
        price_adjustment: parseFloat(newModifier.price_adjustment) || 0,
      });
      setNewModifier({ group_id: '', name: '', price_adjustment: '0' });
      await fetchModifierGroups();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menu Engineering"
        description="Optimize your menu with item analysis, modifiers, recipes, and the engineering matrix."
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800/50 p-1 rounded-lg border border-gray-700 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* --- Menu Items Tab --- */}
      {activeTab === 'items' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openAddItem} className="bg-green-600 hover:bg-green-700 text-white">
              <Plus className="h-4 w-4 mr-2" /> Add Item
            </Button>
          </div>

          {menuItems.length === 0 ? (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="py-12 text-center">
                <UtensilsCrossed className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">No menu items yet. Add your first item to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {menuItems.map((item) => (
                <Card key={item.id} className="bg-gray-800/50 border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-white font-medium">{item.name}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {item.category}{item.course ? ` · ${item.course}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => handleToggleAvailability(item)}
                        disabled={actionLoading === item.id}
                        className="text-gray-400 hover:text-white disabled:opacity-50"
                      >
                        {item.available ? (
                          <ToggleRight className="h-6 w-6 text-green-400" />
                        ) : (
                          <ToggleLeft className="h-6 w-6 text-gray-500" />
                        )}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <p className="text-gray-400">Price</p>
                        <p className="text-white font-medium">{formatCurrency(item.price)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Cost</p>
                        <p className="text-white font-medium">{formatCurrency(item.cost)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditItem(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-md transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        disabled={actionLoading === item.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- Modifier Groups Tab --- */}
      {activeTab === 'modifiers' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setGroupModalOpen(true)} className="bg-green-600 hover:bg-green-700 text-white">
              <Plus className="h-4 w-4 mr-2" /> Add Group
            </Button>
          </div>

          {modifierGroups.length === 0 ? (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="py-12 text-center">
                <Layers className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">No modifier groups yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {modifierGroups.map((group) => (
                <Card key={group.id} className="bg-gray-800/50 border-gray-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-white flex items-center gap-2">
                      {group.name}
                      {group.required && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-orange-500/20 text-orange-400">Required</span>
                      )}
                      <span className="text-xs text-gray-400 font-normal">
                        ({group.min_selections}–{group.max_selections} selections)
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {group.modifiers.length > 0 && (
                      <div className="space-y-1 mb-3">
                        {group.modifiers.map((mod) => (
                          <div key={mod.id} className="flex items-center justify-between py-1.5 px-3 rounded bg-gray-700/30 text-sm">
                            <span className="text-gray-200">{mod.name}</span>
                            <span className={`font-medium ${mod.price_adjustment > 0 ? 'text-green-400' : mod.price_adjustment < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                              {mod.price_adjustment > 0 ? '+' : ''}{formatCurrency(mod.price_adjustment)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Add modifier inline */}
                    <div className="flex gap-2 items-end">
                      <Input
                        placeholder="Modifier name"
                        value={newModifier.group_id === group.id ? newModifier.name : ''}
                        onChange={(e) => setNewModifier({ group_id: group.id, name: e.target.value, price_adjustment: newModifier.group_id === group.id ? newModifier.price_adjustment : '0' })}
                        className="bg-gray-700 border-gray-600 text-white text-sm flex-1"
                      />
                      <Input
                        type="number"
                        placeholder="Price adj."
                        value={newModifier.group_id === group.id ? newModifier.price_adjustment : '0'}
                        onChange={(e) => setNewModifier({ ...newModifier, group_id: group.id, price_adjustment: e.target.value })}
                        className="bg-gray-700 border-gray-600 text-white text-sm w-28"
                      />
                      <Button
                        onClick={() => handleAddModifier(group.id)}
                        disabled={actionLoading === 'add-modifier' || (newModifier.group_id === group.id && !newModifier.name)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- Recipes Tab --- */}
      {activeTab === 'recipes' && (
        <div className="space-y-4">
          {recipes.length === 0 ? (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="py-12 text-center">
                <ChefHat className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">No recipes found.</p>
              </CardContent>
            </Card>
          ) : (
            recipes.map((recipe) => (
              <Card key={recipe.id} className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-0">
                  <button
                    onClick={() => setExpandedRecipe(expandedRecipe === recipe.id ? null : recipe.id)}
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-700/30 transition-colors"
                  >
                    <div>
                      <h3 className="text-white font-medium">{recipe.name}</h3>
                      <p className="text-sm text-gray-400 mt-0.5">
                        {recipe.ingredients.length} ingredients · Yield: {recipe.yield_qty}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-medium">{formatCurrency(recipe.total_cost)}</p>
                      <p className="text-xs text-gray-400">{formatCurrency(recipe.cost_per_serving)} / serving</p>
                    </div>
                  </button>
                  {expandedRecipe === recipe.id && (
                    <div className="px-6 pb-4 border-t border-gray-700/50">
                      <table className="w-full text-sm mt-3">
                        <thead className="text-xs text-gray-400 uppercase">
                          <tr>
                            <th className="text-left py-2">Ingredient</th>
                            <th className="text-right py-2">Qty</th>
                            <th className="text-right py-2">Unit</th>
                            <th className="text-right py-2">Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/30">
                          {recipe.ingredients.map((ing) => (
                            <tr key={ing.id}>
                              <td className="py-2 text-gray-200">{ing.product_name}</td>
                              <td className="py-2 text-gray-300 text-right">{ing.quantity}</td>
                              <td className="py-2 text-gray-400 text-right">{ing.unit}</td>
                              <td className="py-2 text-white text-right">{formatCurrency(ing.cost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* --- Engineering Matrix Tab --- */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          {matrixItems.length === 0 ? (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="py-12 text-center">
                <Grid3X3 className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">Not enough data to generate the engineering matrix.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(['star', 'puzzle', 'plowhorse', 'dog'] as const).map((quadrant) => {
                const qStyle = QUADRANT_STYLES[quadrant];
                const items = matrixItems.filter((i) => i.quadrant === quadrant);
                return (
                  <Card key={quadrant} className={`border-gray-700 ${qStyle.bg}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className={`text-sm font-semibold flex items-center gap-2 ${qStyle.text}`}>
                        {qStyle.icon}
                        {qStyle.label}s
                        <span className="text-xs text-gray-400 font-normal">({items.length})</span>
                      </CardTitle>
                      <p className="text-xs text-gray-400 mt-1">
                        {quadrant === 'star' && 'High popularity, high profit'}
                        {quadrant === 'puzzle' && 'Low popularity, high profit'}
                        {quadrant === 'plowhorse' && 'High popularity, low profit'}
                        {quadrant === 'dog' && 'Low popularity, low profit'}
                      </p>
                    </CardHeader>
                    <CardContent>
                      {items.length === 0 ? (
                        <p className="text-gray-500 text-sm">No items</p>
                      ) : (
                        <div className="space-y-2">
                          {items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between py-2 px-3 rounded bg-gray-800/60 text-sm">
                              <div>
                                <p className="text-white font-medium">{item.name}</p>
                                <p className="text-xs text-gray-400">{item.category}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-gray-300">Pop: {item.popularity}%</p>
                                <p className="text-gray-300">Margin: {item.profit_margin}%</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- Add/Edit Item Modal --- */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">
                {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
              </h2>
              <button onClick={() => setItemModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name</label>
                <Input
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="bg-gray-700 border-gray-600 text-white"
                  placeholder="Item name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Price (R)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={itemForm.price}
                    onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                    className="bg-gray-700 border-gray-600 text-white"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Cost (R)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={itemForm.cost}
                    onChange={(e) => setItemForm({ ...itemForm, cost: e.target.value })}
                    className="bg-gray-700 border-gray-600 text-white"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Category</label>
                <Input
                  value={itemForm.category}
                  onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                  className="bg-gray-700 border-gray-600 text-white"
                  placeholder="e.g. Mains, Starters"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Course (optional)</label>
                <Input
                  value={itemForm.course}
                  onChange={(e) => setItemForm({ ...itemForm, course: e.target.value })}
                  className="bg-gray-700 border-gray-600 text-white"
                  placeholder="e.g. Lunch, Dinner"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setItemForm({ ...itemForm, available: !itemForm.available })}
                  className="text-gray-400 hover:text-white"
                >
                  {itemForm.available ? (
                    <ToggleRight className="h-6 w-6 text-green-400" />
                  ) : (
                    <ToggleLeft className="h-6 w-6 text-gray-500" />
                  )}
                </button>
                <span className="text-sm text-gray-300">Available</span>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
              <Button onClick={() => setItemModalOpen(false)} className="bg-gray-700 hover:bg-gray-600 text-white">
                Cancel
              </Button>
              <Button
                onClick={handleSaveItem}
                disabled={actionLoading === 'save-item' || !itemForm.name || !itemForm.price}
                className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
              >
                {actionLoading === 'save-item' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {editingItem ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* --- Add Modifier Group Modal --- */}
      {groupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Add Modifier Group</h2>
              <button onClick={() => setGroupModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Group Name</label>
                <Input
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  className="bg-gray-700 border-gray-600 text-white"
                  placeholder="e.g. Sauce Choice"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Min Selections</label>
                  <Input
                    type="number"
                    min="0"
                    value={groupForm.min_selections}
                    onChange={(e) => setGroupForm({ ...groupForm, min_selections: e.target.value })}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Max Selections</label>
                  <Input
                    type="number"
                    min="1"
                    value={groupForm.max_selections}
                    onChange={(e) => setGroupForm({ ...groupForm, max_selections: e.target.value })}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setGroupForm({ ...groupForm, required: !groupForm.required })}
                  className="text-gray-400 hover:text-white"
                >
                  {groupForm.required ? (
                    <ToggleRight className="h-6 w-6 text-green-400" />
                  ) : (
                    <ToggleLeft className="h-6 w-6 text-gray-500" />
                  )}
                </button>
                <span className="text-sm text-gray-300">Required</span>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
              <Button onClick={() => setGroupModalOpen(false)} className="bg-gray-700 hover:bg-gray-600 text-white">
                Cancel
              </Button>
              <Button
                onClick={handleAddGroup}
                disabled={actionLoading === 'add-group' || !groupForm.name}
                className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
              >
                {actionLoading === 'add-group' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Create Group
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
