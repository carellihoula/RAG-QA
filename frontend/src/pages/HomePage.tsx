import { useNavigate } from 'react-router-dom'
import { FileText, MessageSquare, BookOpen, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/ModeToggle'

interface Feature {
  icon: React.ReactNode
  title: string
  description: string
}

const features: Feature[] = [
  {
    icon: <FileText className="h-5 w-5" />,
    title: 'Upload any PDF',
    description: 'Drag and drop your documents. We index them instantly using vector embeddings.',
  },
  {
    icon: <MessageSquare className="h-5 w-5" />,
    title: 'Ask in plain English',
    description: 'Ask any question about your document. No query language, no keyword search.',
  },
  {
    icon: <BookOpen className="h-5 w-5" />,
    title: 'Answers with sources',
    description: 'Every answer comes with the exact pages and excerpts it was based on.',
  },
]

export default function HomePage() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-10 flex items-center justify-between px-6 py-3.5 border-b bg-background/80 backdrop-blur-sm">
        <span className="text-lg font-extrabold tracking-tight">RAG Q&amp;A</span>
        <div className="flex items-center gap-2">
          {token ? (
            <Button size="sm" onClick={() => navigate('/app')}>
              Open app <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Log in</Button>
              <Button size="sm" onClick={() => navigate('/login?tab=register')}>Get started</Button>
            </>
          )}
          <ModeToggle />
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-6 py-28">
        <div className="max-w-2xl text-center">
          <h1 className="text-5xl font-extrabold tracking-tight leading-tight mb-5">
            Chat with your{' '}
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              PDF documents
            </span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-xl mx-auto">
            Upload a PDF, ask questions in plain English, and get accurate answers
            grounded in the document — with source references.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button size="lg" onClick={() => navigate('/login?tab=register')}>
              Get started for free <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/login')}>
              Log in
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/30 px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 tracking-tight">Everything you need</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map(f => (
              <div key={f.title} className="rounded-xl border bg-card p-6 transition-shadow hover:shadow-md">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-5 text-center text-xs text-muted-foreground">
        Built with FastAPI · LangChain · FAISS · React
      </footer>
    </div>
  )
}
