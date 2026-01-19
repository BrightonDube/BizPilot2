import { ContactSalesForm } from '@/components/common/ContactSalesForm'

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
    <section className="min-h-screen bg-slate-950 px-4 py-20 text-gray-100">
      <div className="mx-auto flex max-w-5xl justify-center">
        <ContactSalesForm topic={topic} tier={tier} />
      </div>
    </section>
  )
}
