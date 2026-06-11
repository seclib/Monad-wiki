import { Head } from '@inertiajs/react'
import SettingsLayout from '~/layouts/SettingsLayout'

export default function LegalPage() {
  return (
    <SettingsLayout>
      <Head title="Legal Notices | MONAD" />
      <div className="xl:pl-72 w-full">
        <main className="px-12 py-6 max-w-4xl">
          <h1 className="text-4xl font-semibold mb-8">Legal Notices</h1>

          {/* License Agreement */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">License Agreement</h2>
            <p className="text-text-primary mb-3">Copyright 2024-2026 seclib</p>
            <p className="text-text-primary mb-3">
              Licensed under the MIT License. Permission is hereby granted, free of charge, to any
              person obtaining a copy of this software and associated documentation files to use,
              copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
              software, subject to the license terms.
            </p>
            <p className="text-text-primary mb-3">
              <a
                href="https://opensource.org/license/mit"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                https://opensource.org/license/mit
              </a>
            </p>
            <p className="text-text-primary">
              The software is provided &quot;AS IS&quot;, without warranty of any kind, express or
              implied, including but not limited to the warranties of merchantability, fitness for a
              particular purpose, and noninfringement.
            </p>
          </section>

          {/* Third-Party Software */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">Third-Party Software Attribution</h2>
            <p className="text-text-primary mb-4">
              MONAD integrates the following open source projects. We are grateful to their
              developers and communities:
            </p>
            <ul className="space-y-3 text-text-primary">
              <li>
                <strong>Kiwix</strong> - Offline Wikipedia and content reader (GPL-3.0 License)
                <br />
                <a
                  href="https://kiwix.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  https://kiwix.org
                </a>
              </li>
              <li>
                <strong>Kolibri</strong> - Offline learning platform by Learning Equality (MIT
                License)
                <br />
                <a
                  href="https://learningequality.org/kolibri"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  https://learningequality.org/kolibri
                </a>
              </li>
              <li>
                <strong>Ollama</strong> - Local large language model runtime (MIT License)
                <br />
                <a
                  href="https://ollama.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  https://ollama.com
                </a>
              </li>
              <li>
                <strong>CyberChef</strong> - Data analysis and encoding toolkit by GCHQ (Apache 2.0
                License)
                <br />
                <a
                  href="https://github.com/gchq/CyberChef"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  https://github.com/gchq/CyberChef
                </a>
              </li>
              <li>
                <strong>FlatNotes</strong> - Self-hosted note-taking application (MIT License)
                <br />
                <a
                  href="https://github.com/dullage/flatnotes"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  https://github.com/dullage/flatnotes
                </a>
              </li>
              <li>
                <strong>Qdrant</strong> - Vector search engine for AI knowledge base (Apache 2.0
                License)
                <br />
                <a
                  href="https://github.com/qdrant/qdrant"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  https://github.com/qdrant/qdrant
                </a>
              </li>
            </ul>
          </section>

          {/* Privacy Statement */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">Privacy Statement</h2>
            <p className="text-text-primary mb-3">
              MONAD is designed with privacy as a core principle:
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-primary">
              <li>
                <strong>Zero Telemetry:</strong> MONAD does not collect, transmit, or store any
                usage data, analytics, or telemetry.
              </li>
              <li>
                <strong>Local-First:</strong> All your data, downloaded content, AI conversations,
                and notes remain on your device.
              </li>
              <li>
                <strong>No Accounts Required:</strong> MONAD operates without user accounts or
                authentication by default.
              </li>
              <li>
                <strong>Network Optional:</strong> An internet connection is only required to
                download content or updates. All installed features work fully offline.
              </li>
            </ul>
          </section>

          {/* Content Disclaimer */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">Content Disclaimer</h2>
            <p className="text-text-primary mb-3">
              MONAD provides tools to download and access content from third-party sources including
              Wikipedia, Wikibooks, medical references, educational platforms, and other publicly
              available resources.
            </p>
            <p className="text-text-primary mb-3">
              seclib does not create, control, verify, or guarantee the accuracy, completeness, or
              reliability of any third-party content. The inclusion of any content does not
              constitute an endorsement.
            </p>
            <p className="text-text-primary">
              Users are responsible for evaluating the appropriateness and accuracy of any content
              they download and use.
            </p>
          </section>

          {/* Medical Disclaimer */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">
              Medical and Emergency Information Disclaimer
            </h2>
            <p className="text-text-primary mb-3">
              Some content available through MONAD includes medical references, first aid guides,
              and emergency preparedness information. This content is provided for general
              informational purposes only.
            </p>
            <p className="text-text-primary mb-3 font-semibold">
              This information is NOT a substitute for professional medical advice, diagnosis, or
              treatment.
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-primary mb-3">
              <li>
                Always seek the advice of qualified health providers with questions about medical
                conditions.
              </li>
              <li>
                Never disregard professional medical advice or delay seeking it because of something
                you read in offline content.
              </li>
              <li>In a medical emergency, call emergency services immediately if available.</li>
              <li>
                Medical information may become outdated. Verify critical information with current
                professional sources when possible.
              </li>
            </ul>
          </section>

          {/* Data Storage Notice */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">Data Storage</h2>
            <p className="text-text-primary mb-3">
              All data associated with MONAD is stored locally on your device:
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-primary">
              <li>
                <strong>Installation Directory:</strong> MONAD project folder
              </li>
              <li>
                <strong>Downloaded Content:</strong> storage/
              </li>
              <li>
                <strong>Application Data:</strong> storage/, logs/, cache/, config/, models/, data/
              </li>
            </ul>
            <p className="text-text-primary mt-3">
              You maintain full control over your data. Uninstalling MONAD or deleting these
              directories will permanently remove all associated data.
            </p>
          </section>
        </main>
      </div>
    </SettingsLayout>
  )
}
