'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { label: 'BOOKINGS', icon: 'hotel', href: '/' },
  { label: 'SEARCH', icon: 'search', href: '/bookings/new' },
  { label: 'ALERTS', icon: 'notifications', href: '/' },
  { label: 'PROFILE', icon: 'person', href: '/' },
]

export default function BottomNav() {
  const path = usePathname()

  function active(label: string) {
    if (label === 'BOOKINGS') return path === '/' || (path.startsWith('/bookings/') && !path.endsWith('/new') && !path.endsWith('/edit'))
    if (label === 'SEARCH') return path === '/bookings/new' || path.endsWith('/edit')
    return false
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border">
      <div className="max-w-lg mx-auto flex items-center justify-around h-16 px-2">
        {NAV.map(({ label, icon, href }) => {
          const isActive = active(label)
          return (
            <Link
              key={label}
              href={href}
              className="flex flex-col items-center gap-0.5 flex-1 py-2"
            >
              <div className={`w-10 h-8 flex items-center justify-center rounded-xl transition-colors ${isActive ? 'bg-navy' : ''}`}>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '1.25rem', color: isActive ? '#fff' : '#94a3b8' }}
                >
                  {icon}
                </span>
              </div>
              <span className={`text-[10px] font-bold tracking-widest ${isActive ? 'text-navy' : 'text-slate-400'}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
