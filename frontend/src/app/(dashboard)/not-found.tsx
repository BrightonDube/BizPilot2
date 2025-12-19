import Link from 'next/link'
import { ArrowLeft, SearchX } from 'lucide-react'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="max-w-xl w-full bg-gray-800/50 border border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <SearchX className="h-5 w-5 text-blue-400" />
            Not found
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-400">That page doesn&apos;t exist in your dashboard.</p>
          <Link href="/products">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Products
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
