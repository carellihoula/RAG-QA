import { useEffect, useState } from 'react'
import { Joyride, ACTIONS, EVENTS, STATUS, type EventHandler, type Step } from 'react-joyride'

const SEEN_KEY = 'onboarding_seen'

const STEPS: Step[] = [
  {
    target: '[data-tour="add-source"]',
    title: 'Add a source',
    content: 'Click here to add a document — upload a file, paste a URL, or import a Wikipedia article. It lands in your document library.',
    placement: 'right',
    skipBeacon: true,
  },
  {
    target: '[data-tour="add-kb"]',
    title: 'Create a Knowledge Base',
    content: 'A Knowledge Base groups several documents so you can ask questions across all of them at once. A document can belong to one or more Knowledge Bases — it stays in your library either way.',
    placement: 'right',
    skipBeacon: true,
  },
  {
    target: '[data-tour="doc-link-kb"]',
    title: 'Link a document to a Knowledge Base',
    content: 'This icon on a document lets you add or remove it from any Knowledge Base, without leaving your library.',
    placement: 'right',
    skipBeacon: true,
  },
  {
    target: '[data-tour="kb-row"]',
    title: 'Right-click a Knowledge Base',
    content: 'Right-click any Knowledge Base for quick actions — add a source directly to it, rename it, or delete it.',
    placement: 'right',
    skipBeacon: true,
  },
  {
    target: '[data-tour="kb-unlink-doc"]',
    title: 'Unlink a document',
    content: 'Inside an expanded Knowledge Base, this button removes just that document from the KB — the document itself stays in your library.',
    placement: 'right',
    skipBeacon: true,
  },
  {
    target: '[data-tour="clear-conversation"]',
    title: 'Clear the conversation',
    content: 'This clears the current chat history so you can start a fresh conversation with the same document or Knowledge Base.',
    placement: 'bottom',
    skipBeacon: true,
  },
]

const joyrideStyles = {
  options: {
    arrowColor: 'hsl(var(--card))',
    backgroundColor: 'hsl(var(--card))',
    overlayColor: 'rgba(0, 0, 0, 0.55)',
    primaryColor: 'hsl(var(--primary))',
    textColor: 'hsl(var(--foreground))',
    zIndex: 10000,
  },
  tooltip: {
    borderRadius: 12,
    fontSize: 13,
  },
  tooltipTitle: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 4,
  },
  tooltipContent: {
    padding: '4px 0',
    lineHeight: 1.5,
  },
  buttonNext: {
    borderRadius: 8,
    fontSize: 12,
    padding: '8px 14px',
  },
  buttonBack: {
    fontSize: 12,
  },
  buttonSkip: {
    fontSize: 12,
  },
}

export function OnboardingTour() {
  const [run, setRun] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  // Auto-start once, the first time the app shell is available.
  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY)) return
    const t = setTimeout(() => { setStepIndex(0); setRun(true) }, 600)
    return () => clearTimeout(t)
  }, [])

  // Manual restart — dispatched by the "Take a tour" button (skips the "seen" check).
  useEffect(() => {
    function onStart() { setStepIndex(0); setRun(true) }
    window.addEventListener('onboarding:start', onStart)
    return () => window.removeEventListener('onboarding:start', onStart)
  }, [])

  const handleEvent: EventHandler = (data) => {
    const { status, type, index, action } = data

    if (type === EVENTS.TARGET_NOT_FOUND || type === EVENTS.STEP_AFTER) {
      // TARGET_NOT_FOUND: element isn't on screen yet (e.g. no docs/KBs to
      // demo with) — skip it instead of getting stuck, in either direction.
      setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1))
      return
    }

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      localStorage.setItem(SEEN_KEY, '1')
      setRun(false)
    }
  }

  return (
    <Joyride
      steps={STEPS}
      run={run}
      stepIndex={stepIndex}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      styles={joyrideStyles}
      options={{ buttons: ['back', 'skip', 'primary'], showProgress: true }}
      locale={{ last: 'Done', skip: 'Skip tour' }}
    />
  )
}
