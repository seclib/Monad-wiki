import { Link } from '@inertiajs/react'
import {
  IconBuildingStore,
  IconFiles,
  IconHomeHeart,
  IconLayoutDashboard,
  IconNotebook,
} from '@tabler/icons-react'
import AppLayout from '~/layouts/AppLayout'
import classNames from '~/lib/classNames'

const navItems = [
  { href: '/local-life', label: 'Tableau local', icon: IconLayoutDashboard },
  { href: '/local-life/documents', label: 'Documents', icon: IconFiles },
  { href: '/local-life/notes', label: 'Notes', icon: IconNotebook },
  { href: '/local-life/services', label: 'Services', icon: IconBuildingStore },
]

export default function LocalLifeLayout({ children }: { children: React.ReactNode }) {
  const currentPath = typeof window === 'undefined' ? '/local-life' : window.location.pathname

  return (
    <AppLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-desert-green">
              <IconHomeHeart className="size-8" />
              <h2 className="text-3xl font-bold text-text-primary">Vie locale</h2>
            </div>
            <p className="mt-1 text-text-secondary">MONAD au quotidien à La Réunion</p>
          </div>
          <nav className="flex flex-wrap gap-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = currentPath === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={classNames(
                    'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition',
                    active
                      ? 'border-desert-green bg-desert-green text-white'
                      : 'border-border-default bg-surface-primary text-text-primary hover:border-desert-green hover:text-desert-green'
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
        {children}
      </div>
    </AppLayout>
  )
}
