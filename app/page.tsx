import Image from 'next/image'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { Reveal } from '@/components/marketing/Reveal'

/** Replace with your Calendly (or HubSpot) link via env, or keep mailto fallback. */
const DEMO_URL =
  process.env.NEXT_PUBLIC_DEMO_URL ??
  'mailto:sales@tgs.com?subject=Caller%20CRM%20demo%20-%20Auto%20Warranty%20Campaign'

const DEMO_IS_MAIL = DEMO_URL.startsWith('mailto:')

export default function Home() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <MarketingHeader demoUrl={DEMO_URL} demoIsMail={DEMO_IS_MAIL} />

      {/* Hero - full-bleed campaign image; brand + one message + CTA */}
      <section className="relative -mt-[4.25rem] min-h-[92vh] overflow-hidden">
        <Image
          src="/hero-auto-warranty-campaign.jpg"
          alt=""
          fill
          priority
          className="marketing-hero-media object-cover object-center"
          sizes="100vw"
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-ink/92 via-ink/78 to-ink/35"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-ink/40"
          aria-hidden
        />

        <div className="relative mx-auto flex min-h-[92vh] max-w-5xl flex-col justify-end px-6 pb-16 pt-20 sm:pb-20 sm:pt-24">
          <div className="marketing-hero-copy max-w-xl">
            <p className="text-sm font-semibold tracking-wide text-status-gold">
              TGS Caller CRM
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.08] tracking-tight text-paper sm:text-5xl lg:text-6xl">
              Sell more warranties.
              <span className="mt-2 block text-paper/80">Lose fewer campaign leads.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-paper/70">
              Each Auto Warranty Campaign gets its own fronter desk and closer desk, so your
              team qualifies, hands off warm, and closes.
            </p>
            <div className="mt-8">
              <a
                href={DEMO_URL}
                target={DEMO_IS_MAIL ? undefined : '_blank'}
                rel={DEMO_IS_MAIL ? undefined : 'noopener noreferrer'}
                className="inline-flex rounded-md bg-paper px-6 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:bg-nav-active"
              >
                Book a 20-min demo
              </a>
            </div>
            <p className="mt-5 text-sm text-paper/50">
              We’ll walk the fronter desk and the closer handoff live.
            </p>
          </div>
        </div>
      </section>

      {/* Proof strip */}
      <Reveal>
        <section className="border-b border-slate/20 bg-ink">
          <div className="mx-auto grid max-w-5xl gap-8 px-6 py-10 sm:grid-cols-3 sm:gap-10">
            {[
              {
                label: 'Your leads',
                copy: 'stay with your team. No shared free-for-all',
              },
              {
                label: 'Warm handoffs',
                copy: 'fronter desk qualifies. Closers sell with context',
              },
              {
                label: 'From $49',
                copy: 'per agent / month. Clear pricing, sized on demo',
              },
            ].map((item) => (
              <div key={item.label} className="border-l border-status-gold/50 pl-5">
                <p className="text-xl font-bold tracking-tight text-paper sm:text-2xl">
                  {item.label}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-paper/55">{item.copy}</p>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* Product - desks */}
      <section id="product" className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-gradient-to-b from-nav-active via-paper to-paper"
          aria-hidden
        />
        <div className="relative mx-auto max-w-5xl px-6 py-16 sm:py-24">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate">Product</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Two desks. One campaign. Zero leakage.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-body-text sm:text-lg">
              Fronters qualify on their desk. Closers finish on theirs. Google’s book never
              lands on Meta’s floor.
            </p>
          </Reveal>

          <div className="marketing-queue-panel mt-12 grid gap-5 lg:grid-cols-2">
            <Reveal delay={40}>
              <div className="h-full overflow-hidden rounded-lg border border-slate/25 bg-paper shadow-[0_12px_40px_-24px_rgba(28,36,48,0.35)] transition hover:-translate-y-1 hover:border-slate/40">
                <div className="flex items-center justify-between border-b border-slate/20 bg-shop-floor px-4 py-3">
                  <span className="text-xs font-semibold text-ink">
                    Fronter desk · Team Google
                  </span>
                  <span className="text-[11px] font-medium text-navy">3 in queue</span>
                </div>
                <ul className="divide-y divide-slate/15">
                  {[
                    {
                      name: 'Dana R.',
                      detail: '2019 Honda Accord',
                      status: 'Qualified',
                      statusClass: 'text-status-green',
                      meta: 'Ready to transfer',
                      delay: '280ms',
                    },
                    {
                      name: 'Luis M.',
                      detail: '2021 Toyota Camry',
                      status: 'Qualifying',
                      statusClass: 'text-navy',
                      meta: 'Consent captured',
                      delay: '400ms',
                    },
                    {
                      name: 'Priya S.',
                      detail: '2018 Ford F-150',
                      status: 'Ringing',
                      statusClass: 'text-status-gold',
                      meta: 'Google campaign',
                      delay: '520ms',
                    },
                  ].map((row) => (
                    <li
                      key={row.name}
                      className="marketing-queue-row flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-table-strip"
                      style={{ animationDelay: row.delay }}
                    >
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          {row.name} · {row.detail}
                        </p>
                        <p className="mt-0.5 text-xs text-slate">{row.meta}</p>
                      </div>
                      <p className={`text-xs font-medium ${row.statusClass}`}>{row.status}</p>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-slate/20 bg-nav-active px-4 py-3 text-xs text-body-text">
                  Qualify once, transfer warm. The story rides with the call.
                </div>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <div className="h-full overflow-hidden rounded-lg border border-slate/25 bg-paper shadow-[0_12px_40px_-24px_rgba(28,36,48,0.35)] transition hover:-translate-y-1 hover:border-slate/40">
                <div className="flex items-center justify-between border-b border-slate/20 bg-shop-floor px-4 py-3">
                  <span className="text-xs font-semibold text-ink">
                    Closer desk · Team Google
                  </span>
                  <span className="text-[11px] font-medium text-status-green">3 ready</span>
                </div>
                <ul className="divide-y divide-slate/15">
                  {[
                    {
                      name: 'Maria K.',
                      campaign: 'From fronter · Honda Accord',
                      wait: '0:42',
                      delay: '320ms',
                    },
                    {
                      name: 'James R.',
                      campaign: 'From fronter · Toyota Camry',
                      wait: '1:18',
                      delay: '440ms',
                    },
                    {
                      name: 'Aisha T.',
                      campaign: 'From fronter · Ford F-150',
                      wait: '2:05',
                      delay: '560ms',
                    },
                  ].map((row) => (
                    <li
                      key={row.name}
                      className="marketing-queue-row flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-table-strip"
                      style={{ animationDelay: row.delay }}
                    >
                      <div>
                        <p className="text-sm font-semibold text-ink">{row.name}</p>
                        <p className="mt-0.5 text-xs text-slate">{row.campaign}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-navy">Waiting {row.wait}</p>
                        <p className="mt-0.5 text-[11px] text-slate">Ready to close</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-slate/20 bg-nav-active px-4 py-3 text-xs text-body-text">
                  Only this team’s closers see those handoffs. Meta never shares the pile.
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Why */}
      <section id="why" className="relative overflow-hidden border-t border-slate/20">
        <div className="absolute inset-0 bg-shop-floor" aria-hidden />
        <div
          className="absolute -left-20 top-24 h-64 w-64 rounded-full bg-status-blue/10 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-5xl px-6 py-16 sm:py-24">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate">
              Why teams choose Caller CRM
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Stop paying for leads your other team closes.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-body-text sm:text-lg">
              When every closer can grab every lead, campaign spend leaks and coaching falls
              apart. Caller CRM gives each Auto Warranty Campaign its own fronter desk and
              closer desk, so the team that paid for the traffic qualifies it, hands it off,
              and gets the sale.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-8 sm:grid-cols-3 sm:gap-6">
            {[
              {
                n: '01',
                title: 'Protect what you spend',
                copy: 'Google campaigns stay with the Google team. Meta with Meta. Your budget stops funding someone else’s book.',
              },
              {
                n: '02',
                title: 'Fronter desk does the hard part',
                copy: 'Qualification, consent, and disposition on their own desk, then a warm handoff to a free closer on the same campaign.',
              },
              {
                n: '03',
                title: 'See what works',
                copy: 'Live floor visibility and clear funnel numbers by team, so you know which campaigns actually convert.',
              },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 90}>
                <div className="h-full border-t-2 border-navy/80 pt-6 transition hover:border-navy">
                  <p className="text-xs font-semibold tracking-[0.14em] text-navy">{item.n}</p>
                  <h3 className="mt-4 text-lg font-bold tracking-tight text-ink">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-body-text">{item.copy}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="border-t border-slate/20 bg-paper">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate">
              How it works
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              From campaign call to signed warranty.
            </h2>
          </Reveal>

          <ol className="mt-14 space-y-4">
            {[
              {
                title: 'The lead hits the fronter desk',
                copy: 'Your Auto Warranty Campaign rings in on that team’s fronter desk, not a shared free-for-all across campaigns.',
              },
              {
                title: 'Fronters qualify and transfer',
                copy: 'They capture vehicle, consent, and disposition, then transfer only when a closer on the same team is free. Warm, with the story already written.',
              },
              {
                title: 'Closers finish on their desk',
                copy: 'Only that team’s closers see the handoff. They sell protection. Leaders watch the results.',
              },
            ].map((step, i) => (
              <Reveal key={step.title} delay={i * 80}>
                <li className="group grid gap-4 rounded-lg border border-slate/20 bg-gradient-to-r from-nav-active/80 to-paper px-5 py-7 transition hover:-translate-y-0.5 hover:border-slate/40 sm:grid-cols-[5rem_1fr] sm:items-start sm:gap-10 sm:px-8">
                  <span className="text-3xl font-bold tracking-tight text-navy/25 transition group-hover:text-navy/45">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-ink">{step.title}</h3>
                    <p className="mt-2 max-w-2xl text-base leading-relaxed text-body-text">
                      {step.copy}
                    </p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Results */}
      <section id="results" className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-gradient-to-br from-ink via-[#243044] to-navy"
          aria-hidden
        />
        <div
          className="absolute -right-24 top-0 h-72 w-72 rounded-full bg-status-blue/20 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-status-gold/15 blur-3xl"
          aria-hidden
        />

        <div className="relative mx-auto max-w-5xl px-6 py-16 sm:py-24">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-wide text-paper/55">
              Results
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-paper sm:text-4xl">
              Built for people who run Auto Warranty floors.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-paper/65">
              One CRM, three jobs on the floor. Each one clearer when campaigns stop getting
              mixed.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {[
              {
                n: '01',
                title: 'Owners & operators',
                outcome: 'Know each campaign’s return.',
                copy: 'Stop guessing which team is quietly closing the other’s leads.',
              },
              {
                n: '02',
                title: 'Floor managers',
                outcome: 'See the floor, not the noise.',
                copy: 'Who’s busy, what’s waiting, where deals stall, without dialer clutter.',
              },
              {
                n: '03',
                title: 'Agents',
                outcome: 'A real desk. A fair book.',
                copy: 'Fronters qualify and transfer. Closers work their own campaign, not a scramble.',
              },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 90}>
                <div className="h-full border-t border-paper/20 pt-6 transition hover:border-status-gold/60">
                  <p className="text-xs font-semibold tracking-[0.14em] text-status-gold">
                    {item.n}
                  </p>
                  <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-paper/55">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-xl font-bold leading-snug tracking-tight text-paper sm:text-2xl">
                    {item.outcome}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-paper/60">{item.copy}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing - interactive plan pickers */}
      <section id="pricing" className="relative overflow-hidden border-t border-slate/20 bg-paper">
        <div
          className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-shop-floor to-transparent"
          aria-hidden
        />
        <div className="relative mx-auto max-w-5xl px-6 py-16 sm:py-24">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate">Pricing</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Simple plans. Priced for your floor.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-body-text">
              <span className="font-semibold text-ink">Floor starts at $49 per agent / month</span>
              {' '}
              with annual billing. Campaign Teams is quoted for your headcount and how many
              paid sources you run. No surprise dial fees.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            <Reveal delay={60}>
              <a
                href={DEMO_URL}
                target={DEMO_IS_MAIL ? undefined : '_blank'}
                rel={DEMO_IS_MAIL ? undefined : 'noopener noreferrer'}
                className="group flex h-full flex-col rounded-lg border border-slate/25 bg-paper p-7 shadow-[0_12px_40px_-28px_rgba(28,36,48,0.4)] transition hover:-translate-y-1 hover:border-navy/40"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate">
                  Start here
                </p>
                <h3 className="mt-3 text-xl font-bold text-ink">Floor</h3>
                <p className="mt-4 text-4xl font-bold tracking-tight text-ink">
                  $49
                  <span className="text-base font-semibold text-slate"> / agent / mo</span>
                </p>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-body-text">
                  Everything your sales floor needs to qualify, hand off, close, and see
                  results. Ideal when you’re running one Auto Warranty operation.
                </p>
                <span className="mt-6 inline-flex text-sm font-semibold text-navy transition group-hover:translate-x-0.5">
                  Start with Floor →
                </span>
              </a>
            </Reveal>
            <Reveal delay={140}>
              <a
                href={DEMO_URL}
                target={DEMO_IS_MAIL ? undefined : '_blank'}
                rel={DEMO_IS_MAIL ? undefined : 'noopener noreferrer'}
                className="group relative flex h-full flex-col overflow-hidden rounded-lg bg-ink p-7 text-paper shadow-[0_16px_48px_-24px_rgba(28,36,48,0.55)] transition hover:-translate-y-1"
              >
                <div
                  className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-status-gold/20 blur-2xl transition group-hover:bg-status-gold/30"
                  aria-hidden
                />
                <p className="relative text-xs font-semibold uppercase tracking-wide text-status-gold">
                  Multi-campaign
                </p>
                <h3 className="relative mt-3 text-xl font-bold">Campaign teams</h3>
                <p className="relative mt-4 text-4xl font-bold tracking-tight">
                  Custom
                  <span className="text-base font-semibold text-paper/55"> / floor</span>
                </p>
                <p className="relative mt-3 flex-1 text-sm leading-relaxed text-paper/70">
                  Floor, plus separate teams for each paid campaign, so Google and Meta
                  never share a closer pile. Built for floors with multiple lead sources.
                </p>
                <span className="relative mt-6 inline-flex text-sm font-semibold text-paper transition group-hover:translate-x-0.5">
                  Get a Campaign Teams quote →
                </span>
              </a>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <Reveal>
        <section className="relative overflow-hidden">
          <div
            className="absolute inset-0 bg-gradient-to-br from-navy via-ink to-[#121820]"
            aria-hidden
          />
          <div
            className="absolute right-0 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-status-blue/15 blur-3xl"
            aria-hidden
          />
          <div className="relative mx-auto max-w-5xl px-6 py-16 sm:py-24">
            <h2 className="max-w-xl text-3xl font-bold tracking-tight text-paper sm:text-5xl">
              See your campaigns on the right desks in one demo.
            </h2>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-paper/65 sm:text-lg">
              Twenty minutes. We’ll walk your floor story, show fronter-to-closer separation
              live, and price it for your headcount.
            </p>
            <div className="mt-9">
              <a
                href={DEMO_URL}
                target={DEMO_IS_MAIL ? undefined : '_blank'}
                rel={DEMO_IS_MAIL ? undefined : 'noopener noreferrer'}
                className="inline-flex rounded-md bg-paper px-6 py-3.5 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:bg-nav-active"
              >
                Book a 20-min demo
              </a>
            </div>
          </div>
        </section>
      </Reveal>

      <footer className="border-t border-slate/20 bg-paper px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-ink text-[9px] font-bold text-paper">
              TGS
            </div>
            <span className="text-xs font-medium text-ink">Caller CRM</span>
          </div>
          <p className="text-xs text-slate">Auto Warranty Campaign</p>
        </div>
      </footer>
    </main>
  )
}
