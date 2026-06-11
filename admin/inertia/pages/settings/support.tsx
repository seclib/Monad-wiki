import { Head } from '@inertiajs/react'
import { IconExternalLink } from '@tabler/icons-react'
import SettingsLayout from '~/layouts/SettingsLayout'

export default function SupportPage() {
  return (
    <SettingsLayout>
      <Head title="Support the Project | MONAD" />
      <div className="xl:pl-72 w-full">
        <main className="px-12 py-6 max-w-4xl">
          <h1 className="text-4xl font-semibold mb-4">Support MONAD</h1>
          <p className="text-text-muted mb-10 text-lg">
            MONAD is built by seclib as a local-first knowledge system. The best way to support it
            is to improve the project, report issues, and share practical feedback.
          </p>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-3">Contribute</h2>
            <p className="text-text-muted mb-4">
              Code, documentation, localization, testing notes, and bug reports all help make MONAD
              more useful for local deployments.
            </p>
            <a
              href="https://github.com/seclib/monad"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-desert-green hover:bg-desert-green-dark text-white font-semibold rounded-lg transition-colors"
            >
              Open MONAD on GitHub
              <IconExternalLink size={18} />
            </a>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-3">Other Ways to Help</h2>
            <ul className="space-y-2 text-text-muted">
              <li>
                <a
                  href="https://github.com/seclib/monad"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Star the project on GitHub
                </a>{' '}
                — it helps more people discover MONAD
              </li>
              <li>
                <a
                  href="https://github.com/seclib/monad/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Report bugs and suggest features
                </a>{' '}
                — every report makes MONAD better
              </li>
              <li>Share MONAD with someone who needs a local-first knowledge system.</li>
              <li>Contribute Réunion-first wording, workflows, or offline deployment notes.</li>
            </ul>
          </section>
        </main>
      </div>
    </SettingsLayout>
  )
}
