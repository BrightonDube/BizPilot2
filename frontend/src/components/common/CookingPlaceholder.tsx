'use client'

import Link from 'next/link'
import { ChefHat, ArrowLeft, Sparkles } from 'lucide-react'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'

export function CookingPlaceholder({
  title = 'Cooking…',
  description = "This page is still in the kitchen. It'll be ready soon.",
  backHref,
  backLabel = 'Go back',
}: {
  title?: string
  description?: string
  backHref?: string
  backLabel?: string
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="max-w-xl w-full bg-gray-800/50 border border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <ChefHat className="h-5 w-5 text-purple-400" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-400">{description}</p>

          <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Sparkles className="h-4 w-4 text-blue-400" />
              <span>Tip: check back after the next deploy.</span>
            </div>
          </div>

          {backHref && (
            <Link href={backHref}>
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {backLabel}
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
