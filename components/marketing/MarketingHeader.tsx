'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type MarketingHeaderProps = {
  demoUrl: string
  demoIsMail: boolean
}

export function MarketingHeader({ demoUrl, demoIsMail }: MarketingHeaderProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const link = scrolled
    ? 'text-sm text-slate transition hover:text-ink'
    : 'text-sm text-paper/70 transition hover:text-paper'
  const signIn = scrolled
    ? 'text-sm font-medium text-slate transition hover:text-ink'
    : 'text-sm font-medium text-paper/80 transition hover:text-paper'
  const brand = scrolled ? 'text-sm font-semibold text-ink' : 'text-sm font-semibold text-paper'
  const mark = scrolled
    ? 'flex h-8 w-8 items-center justify-center rounded bg-ink text-[10px] font-bold text-paper'
    : 'flex h-8 w-8 items-center justify-center rounded bg-paper text-[10px] font-bold text-ink'
  const cta = scrolled
    ? 'rounded-md bg-ink px-3.5 py-2 text-sm font-medium text-paper transition hover:-translate-y-0.5 hover:opacity-90'
    : 'rounded-md bg-paper px-3.5 py-2 text-sm font-medium text-ink transition hover:-translate-y-0.5 hover:bg-nav-active'

  return (
    <header className="sticky top-0 z-50 bg-transparent">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className={mark}>TGS</div>
          <span className={brand}>Caller CRM</span>
        </div>
        <nav className="flex items-center gap-5">
          <a href="#why" className={`hidden md:inline ${link}`}>
            Why
          </a>
          <a href="#product" className={`hidden md:inline ${link}`}>
            Product
          </a>
          <a href="#results" className={`hidden md:inline ${link}`}>
            Results
          </a>
          <a href="#pricing" className={`hidden md:inline ${link}`}>
            Pricing
          </a>
          <Link href="/login" className={signIn}>
            Sign in
          </Link>
          <a
            href={demoUrl}
            target={demoIsMail ? undefined : '_blank'}
            rel={demoIsMail ? undefined : 'noopener noreferrer'}
            className={cta}
          >
            Book a demo
          </a>
        </nav>
      </div>
    </header>
  )
}
