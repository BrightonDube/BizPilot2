import { AIChatPage } from '@/components/ai/AIChatPage'
import { FeatureGate } from '@/components/subscription/FeatureGate'

export default function AIAssistantPage() {
  return (
    <FeatureGate feature="ai_assistant">
      <AIChatPage />
    </FeatureGate>
  )
}
