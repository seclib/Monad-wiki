import { useState } from 'react'
import Footer from '~/components/Footer'
import ChatButton from '~/components/chat/ChatButton'
import ChatModal from '~/components/chat/ChatModal'
import useServiceInstalledStatus from '~/hooks/useServiceInstalledStatus'
import { SERVICE_NAMES } from '../../constants/service_names'
import { Link, router, usePage } from '@inertiajs/react'
import { IconArrowLeft } from '@tabler/icons-react'
import classNames from 'classnames'
import { UsePageProps } from '../../types/system'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const aiAssistantInstalled = useServiceInstalledStatus(SERVICE_NAMES.OLLAMA)
  const { projectTagline, projectDescription } = usePage().props as unknown as UsePageProps

  return (
    <div className="min-h-screen flex flex-col">
      {window.location.pathname !== '/home' && (
        <Link href="/home" className="absolute top-60 md:top-48 left-4 flex items-center">
          <IconArrowLeft className="mr-2" size={24} />
          <p className="text-lg text-text-secondary">Retour à l'accueil</p>
        </Link>
      )}
      <div
        className="p-2 flex gap-2 flex-col items-center justify-center cursor-pointer"
        onClick={() => router.visit('/home')}
      >
        <img src="/monad_logo.webp" alt="MONAD Logo" className="h-40 w-40" />
        <h1 className="text-5xl font-bold text-desert-green">Centre de commande</h1>
        <p className="text-text-secondary text-center">
          {projectTagline || 'Optimisé pour La Réunion'}
        </p>
        <p className="text-sm text-text-secondary text-center">
          {projectDescription || 'Système local de gestion et de connaissance'}
        </p>
      </div>
      <hr
        className={classNames(
          'text-desert-green font-semibold h-[1.5px] bg-desert-green border-none',
          window.location.pathname !== '/home' ? 'mt-12 md:mt-0' : 'mt-0'
        )}
      />
      <div className="flex-1 w-full bg-desert">{children}</div>
      <Footer />

      {aiAssistantInstalled && (
        <>
          <ChatButton onClick={() => setIsChatOpen(true)} />
          <ChatModal open={isChatOpen} onClose={() => setIsChatOpen(false)} />
        </>
      )}
    </div>
  )
}
