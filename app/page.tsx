import Link from 'next/link'

const FEATURES = [
  {
    title: 'Fronters',
    description: 'Qualify inbound leads fast with guided scripts and live disposition tracking.',
  },
  {
    title: 'Closers',
    description: 'Get warm, qualified transfers with full context — no cold screen-pops.',
  },
  {
    title: 'Admins',
    description: 'Monitor the funnel in real time and keep every agent accountable.',
  },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-xs font-bold text-paper">
            TGS
          </div>
          <span className="text-sm font-semibold text-ink">Caller CRM</span>
        </div>
        <Link
          href="/login"
          className="rounded-lg border border-slate/40 bg-paper px-4 py-2 text-sm font-medium text-ink transition hover:bg-slate/10"
        >
          Sign in
        </Link>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-16 pt-12 text-center">
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Every lead, every call, one connected desk.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-slate">
          The call center CRM that takes a lead from first ring to closed deal — built for
          fronters, closers, and the admins keeping score.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/login"
            className="rounded-lg bg-ink px-6 py-3 text-sm font-semibold text-paper transition hover:opacity-90"
          >
            Sign in to your workspace
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-slate/20 bg-slate/5 p-6"
            >
              <h2 className="text-sm font-semibold text-navy">{feature.title}</h2>
              <p className="mt-2 text-sm text-slate">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate/20 py-6 text-center text-xs text-slate">
        Access is provisioned by your administrator — there is no self-service sign-up.
      </footer>
    </main>
  )
}
