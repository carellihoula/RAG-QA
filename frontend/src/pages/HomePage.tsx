import { useNavigate } from 'react-router-dom'
import './HomePage.css'

interface Feature {
  icon: string
  title: string
  description: string
}

const features: Feature[] = [
  {
    icon: '📄',
    title: 'Upload any PDF',
    description: 'Drag and drop your documents. We index them instantly using vector embeddings.'
  },
  {
    icon: '💬',
    title: 'Ask in plain English',
    description: 'Ask any question about your document. No query language, no keyword search.'
  },
  {
    icon: '🔍',
    title: 'Answers with sources',
    description: 'Every answer comes with the exact pages and excerpts it was based on.'
  }
]

export default function HomePage() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  return (
    <div className="home">
      <nav className="home-nav">
        <span className="home-logo">RAG Q&A</span>
        <div className="home-nav-actions">
          {token ? (
            <button className="btn-primary" onClick={() => navigate('/app')}>Open app</button>
          ) : (
            <>
              <button className="btn-ghost" onClick={() => navigate('/login')}>Log in</button>
              <button className="btn-primary" onClick={() => navigate('/login?tab=register')}>Get started</button>
            </>
          )}
        </div>
      </nav>

      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">
            Chat with your<br />
            <span className="hero-accent">PDF documents</span>
          </h1>
          <p className="hero-subtitle">
            Upload a PDF, ask questions in plain English, and get accurate answers
            grounded in the document — with source references.
          </p>
          <div className="hero-actions">
            <button className="btn-primary btn-lg" onClick={() => navigate('/login?tab=register')}>
              Get started for free
            </button>
            <button className="btn-ghost btn-lg" onClick={() => navigate('/login')}>
              Log in
            </button>
          </div>
        </div>
        <div className="hero-visual">
          <div className="mockup">
            <div className="mockup-bar">
              <span /><span /><span />
            </div>
            <div className="mockup-body">
              <div className="mockup-msg user">What are the main conclusions of chapter 3?</div>
              <div className="mockup-msg assistant">
                Chapter 3 concludes that… <span className="mockup-source">Page 42</span>
              </div>
              <div className="mockup-msg user">Can you summarise the methodology?</div>
              <div className="mockup-msg assistant typing">
                <span /><span /><span />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features">
        <h2 className="features-title">Everything you need</h2>
        <div className="features-grid">
          {features.map(f => (
            <div key={f.title} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="home-footer">
        <p>Built with FastAPI · LangChain · FAISS · React</p>
      </footer>
    </div>
  )
}