import Header from './components/Header'
import DocumentIngestor from './components/DocumentIngestor'
import { phantomDesign } from './design-system/phantomDesign'

const SESSION_ID = crypto.randomUUID()

export default function App(): JSX.Element {
  return (
    <div className={phantomDesign.layout.page}>
      <Header />
      <main className={phantomDesign.layout.container}>
        <div className="mx-auto w-full max-w-3xl">
          <DocumentIngestor sessionId={SESSION_ID} />
        </div>
      </main>
    </div>
  )
}
