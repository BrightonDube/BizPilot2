import { ContactSalesForm } from '@/components/common/ContactSalesForm'
import HeroStarsBackground from '@/components/home/HeroStarsBackground'

type ContactPageProps = {
  searchParams?: {
    topic?: string
    tier?: string
  }
}

export default function ContactPage({ searchParams }: ContactPageProps) {
  const topic = searchParams?.topic
  const tier = searchParams?.tier

  return (
    <section className="relative min-h-screen bg-slate-950 px-4 py-20 text-gray-100">
      <HeroStarsBackground />
      <div className="relative z-10 mx-auto flex max-w-5xl justify-center">
        <ContactSalesForm topic={topic} tier={tier} />
      </div>
    </section>
  )
}
