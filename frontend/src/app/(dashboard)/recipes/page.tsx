'use client'

/**
 * Recipe Management Page
 *
 * Lists all recipes with cost breakdown, ingredient counts, and food cost %.
 * Allows CRUD operations on recipes and their ingredients.
 *
 * Why a separate page instead of embedding in Menu?
 * Recipes can exist independently of menu items (e.g. prep recipes, sauces)
 * and the cost-tracking UX warrants dedicated screen real estate.
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Plus,
  ChefHat,
  Trash2,
  Edit,
  DollarSign,
  Package,
  Search,
  X,
} from 'lucide-react'

import { apiClient } from '@/lib/api'
import {
  Button,
  Card,
  CardContent,
  PageHeader,
  LoadingSpinner,
  Badge,
  Input,
} from '@/components/ui'

/* ── Types ─────────────────────────────────────────────────────────── */

interface RecipeIngredient {
  id: string
  product_id: string
  product_name?: string
  quantity: number
  unit: string
}

interface Recipe {
  id: string
  name: string
  menu_item_id: string | null
  yield_quantity: number
  instructions: string | null
  ingredients: RecipeIngredient[]
  created_at: string
}

interface RecipeCost {
  recipe_id: string
  total_cost: number
}

interface FoodCost {
  recipe_id: string
  name: string
  total_cost: number
  selling_price: number | null
  food_cost_pct: number | null
  cost_per_portion: number
  yield_quantity: number
}

/* ── Component ─────────────────────────────────────────────────────── */

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [costMap, setCostMap] = useState<Record<string, FoodCost>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  /* ── Create / Edit state ──────────────────────────────────────── */
  const [showForm, setShowForm] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
  const [formName, setFormName] = useState('')
  const [formYield, setFormYield] = useState('1')
  const [formInstructions, setFormInstructions] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  /* ── Data fetching ────────────────────────────────────────────── */

  const fetchRecipes = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await apiClient.get<Recipe[]>('/menu/recipes')
      setRecipes(res.data)

      // Fetch food-cost data for each recipe in parallel
      const costEntries = await Promise.allSettled(
        res.data.map((r) =>
          apiClient.get<FoodCost>(`/menu/recipes/${r.id}/food-cost`).then((c) => ({
            id: r.id,
            data: c.data,
          }))
        )
      )

      const map: Record<string, FoodCost> = {}
      for (const entry of costEntries) {
        if (entry.status === 'fulfilled') {
          map[entry.value.id] = entry.value.data
        }
      }
      setCostMap(map)
    } catch (err) {
      setError('Failed to load recipes')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRecipes()
  }, [fetchRecipes])

  /* ── Handlers ─────────────────────────────────────────────────── */

  const openCreateForm = () => {
    setEditingRecipe(null)
    setFormName('')
    setFormYield('1')
    setFormInstructions('')
    setShowForm(true)
  }

  const openEditForm = (recipe: Recipe) => {
    setEditingRecipe(recipe)
    setFormName(recipe.name)
    setFormYield(String(recipe.yield_quantity))
    setFormInstructions(recipe.instructions || '')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) return
    setIsSaving(true)
    try {
      if (editingRecipe) {
        await apiClient.put(`/menu/recipes/${editingRecipe.id}`, {
          name: formName.trim(),
          yield_quantity: parseFloat(formYield) || 1,
          instructions: formInstructions || null,
        })
      } else {
        await apiClient.post('/menu/recipes', {
          name: formName.trim(),
          yield_quantity: parseFloat(formYield) || 1,
          instructions: formInstructions || null,
        })
      }
      setShowForm(false)
      fetchRecipes()
    } catch (err) {
      console.error('Failed to save recipe:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recipe?')) return
    try {
      await apiClient.delete(`/menu/recipes/${id}`)
      fetchRecipes()
    } catch (err) {
      console.error('Failed to delete recipe:', err)
    }
  }

  /* ── Filter ───────────────────────────────────────────────────── */

  const filtered = recipes.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  )

  /* ── Render ───────────────────────────────────────────────────── */

  if (isLoading && recipes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Recipes"
        description="Manage recipes, track costs, and calculate food cost percentages"
        actions={
          <Button variant="gradient" onClick={openCreateForm}>
            <Plus className="h-4 w-4 mr-2" />
            New Recipe
          </Button>
        }
      />

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search recipes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <Card className="mb-6 border-blue-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {editingRecipe ? 'Edit Recipe' : 'New Recipe'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Recipe name"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Yield Quantity</label>
                <Input
                  type="number"
                  value={formYield}
                  onChange={(e) => setFormYield(e.target.value)}
                  min="0.01"
                  step="0.01"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-400 mb-1">Instructions</label>
                <textarea
                  value={formInstructions}
                  onChange={(e) => setFormInstructions(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Preparation instructions..."
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="gradient" onClick={handleSave} disabled={isSaving || !formName.trim()}>
                {isSaving ? 'Saving...' : editingRecipe ? 'Update' : 'Create'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recipe Cards */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ChefHat className="h-12 w-12 mx-auto text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No recipes yet</h3>
            <p className="text-gray-400 mb-4">
              Create your first recipe to start tracking ingredient costs.
            </p>
            <Button variant="gradient" onClick={openCreateForm}>
              <Plus className="h-4 w-4 mr-2" />
              Create Recipe
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((recipe) => {
            const cost = costMap[recipe.id]
            return (
              <Card key={recipe.id} className="hover:border-gray-600 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{recipe.name}</h3>
                      <p className="text-sm text-gray-400">
                        {recipe.ingredients?.length || 0} ingredients · Yield: {recipe.yield_quantity}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditForm(recipe)}
                        className="p-1.5 text-gray-400 hover:text-white rounded"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(recipe.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Cost breakdown */}
                  {cost && (
                    <div className="space-y-2 border-t border-gray-700 pt-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400 flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5" /> Total Cost
                        </span>
                        <span className="text-white font-medium">
                          R {cost.total_cost.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400 flex items-center gap-1">
                          <Package className="h-3.5 w-3.5" /> Cost / Portion
                        </span>
                        <span className="text-white font-medium">
                          R {cost.cost_per_portion.toFixed(2)}
                        </span>
                      </div>
                      {cost.food_cost_pct !== null && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Food Cost %</span>
                          <Badge
                            className={
                              cost.food_cost_pct <= 30
                                ? 'bg-green-500/20 text-green-300'
                                : cost.food_cost_pct <= 35
                                  ? 'bg-yellow-500/20 text-yellow-300'
                                  : 'bg-red-500/20 text-red-300'
                            }
                          >
                            {cost.food_cost_pct.toFixed(1)}%
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
