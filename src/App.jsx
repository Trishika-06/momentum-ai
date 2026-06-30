import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  GENERATE_PLAN_ENDPOINT,
  INSIGHT_ENDPOINT,
  COACH_ENDPOINT,
} from './config'

const initialTasks = [
  {
    title: 'Launch Momentum AI deck',
    description: 'Finalize slides, design system, and deployment checklist.',
    estimate_hours: 2,
    priority: 'High',
    deadline: '2026-06-30T17:00',
    completed: false,
  },
  {
    title: 'Build task prioritization flow',
    description: 'Add task form, list UI, and AI planning integration.',
    estimate_hours: 3,
    priority: 'High',
    deadline: '2026-06-30T18:00',
    completed: false,
  },
  {
    title: 'Prepare demo script',
    description: 'Write talking points, highlight AI-assisted scheduling.',
    estimate_hours: 1.5,
    priority: 'Medium',
    deadline: '2026-06-30T16:00',
    completed: false,
  },
]

const sectionMeta = {
  Priority: {
    icon: '🎯',
    subtitle: 'What deserves attention first',
  },
  Schedule: {
    icon: '⏰',
    subtitle: 'Time-blocked execution plan',
  },
  Risks: {
    icon: '⚠️',
    subtitle: 'Watchouts and bottlenecks',
  },
  Tips: {
    icon: '💡',
    subtitle: 'Ways to stay focused and efficient',
  },
}

function parsePlanSections(plan) {
  if (!plan) return []

  const normalizedPlan = plan.replace(/\r\n/g, '\n')
  
  // First, try to parse the new emoji-based format
  const priorityRegex = /^([⚡🔥💪📌🎯✨])\s*Priority\s*(\d+)\s*\n(.+?)\nTime:\s*(.+?)\n(Reason:.*?)(?=\n\n|$)/gm
  const priorityMatches = [...normalizedPlan.matchAll(priorityRegex)]
  
  if (priorityMatches.length > 0) {
    // Parse new format
    const priorities = priorityMatches.map(match => {
      const emoji = match[1]
      const taskTitle = match[3].trim()
      const timeBlock = match[4].trim()
      const reasonAndMore = match[5].trim()
      
      let content = `${emoji} ${taskTitle}\n`
      content += `⏰ ${timeBlock}\n`
      content += reasonAndMore
      
      return {
        title: `Priority ${match[2]}`,
        content: content,
        emoji: emoji,
      }
    })
    
    // Extract key insights section if it exists
    const insightsMatch = normalizedPlan.match(/KEY INSIGHTS:\n([\s\S]*?)(?=\n\n|$)/i)
    if (insightsMatch) {
      priorities.push({
        title: 'Key Insights',
        content: insightsMatch[1].trim(),
        emoji: '💡',
      })
    }
    
    return priorities
  }

  // Fallback: parse old format
  const sectionRegex = /(Task Priority|Detailed Schedule(?: with time slots)?|Suggested Schedule|Schedule|Why this order was chosen|Reasoning|Risks|Productivity Tips|Improvement Suggestions|Tips)\s*[:\-]*/gi
  const matches = [...normalizedPlan.matchAll(sectionRegex)]

  if (!matches.length) {
    return []
  }

  const sectionTitles = ['Priority', 'Schedule', 'Risks', 'Tips']

  return matches
    .map((match, index) => {
      const rawTitle = match[1]
      const start = match.index + match[0].length
      const end = index + 1 < matches.length ? matches[index + 1].index : normalizedPlan.length
      const content = normalizedPlan.slice(start, end).trim()

      if (!content) return null

      const normalizedTitle = (() => {
        const lowerTitle = rawTitle.toLowerCase()
        if (lowerTitle.includes('priority')) return 'Priority'
        if (lowerTitle.includes('schedule')) return 'Schedule'
        if (lowerTitle.includes('risk')) return 'Risks'
        if (lowerTitle.includes('tip') || lowerTitle.includes('improvement')) return 'Tips'
        return rawTitle
      })()

      return sectionTitles.includes(normalizedTitle)
        ? { title: normalizedTitle, content }
        : null
    })
    .filter(Boolean)
}

function parseProductivityMetrics(plan, tasks) {
  if (!plan) {
    return {
      productivityScore: null,
      stressLevel: null,
      deadlineRisk: null,
      todaysFocus: null,
    }
  }

  const scoreMatch = plan.match(/Productivity Score\s*[:\-]\s*(\d{1,3})%?/i)
  const stressMatch = plan.match(/Stress Level\s*[:\-]\s*([A-Za-z0-9\s]+)/i)
  const riskMatch = plan.match(/Deadline Risk\s*[:\-]\s*([A-Za-z0-9\s]+)/i)
  const focusMatch = plan.match(/Today's Focus\s*[:\-]\s*([\s\S]*?)(?=\n\s*\n|$)/i)

  return {
    productivityScore: scoreMatch ? `${scoreMatch[1]}%` : null,
    stressLevel: stressMatch ? stressMatch[1].trim() : null,
    deadlineRisk: riskMatch ? riskMatch[1].trim() : null,
    todaysFocus: focusMatch ? focusMatch[1].trim() : null,
  }
}

function App() {
  const [page, setPage] = useState('landing')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tasks, setTasks] = useState(initialTasks)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [estimate, setEstimate] = useState(1)
  const [priority, setPriority] = useState('Medium')
  const [deadline, setDeadline] = useState('')
  const [aiPlan, setAiPlan] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [coachQuery, setCoachQuery] = useState('')
  const [coachMessages, setCoachMessages] = useState([])
  const [coachLoading, setCoachLoading] = useState(false)
  const [coachError, setCoachError] = useState('')
  const [aiInsight, setAiInsight] = useState('')
  const [insightLoading, setInsightLoading] = useState(false)
  const [insightError, setInsightError] = useState('')

  const planSections = useMemo(() => parsePlanSections(aiPlan), [aiPlan])
  const productivityMetrics = useMemo(() => parseProductivityMetrics(aiPlan, tasks), [aiPlan, tasks])

  const totalHours = useMemo(() => tasks.reduce((sum, task) => sum + Number(task.estimate_hours), 0), [tasks])
  const remainingHours = useMemo(() => tasks.filter(t => !t.completed).reduce((sum, task) => sum + Number(task.estimate_hours), 0), [tasks])
  const completedCount = useMemo(() => tasks.filter(t => t.completed).length, [tasks])
  const momentumLevel = useMemo(() => {
    return tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0
  }, [tasks, completedCount])

  const getMomentumStage = (level) => {
    if (level <= 25) return { emoji: '🌱', label: 'Sprouting' }
    if (level <= 50) return { emoji: '🌿', label: 'Growing' }
    if (level <= 75) return { emoji: '🌳', label: 'Flourishing' }
    return { emoji: '✨', label: 'Peak Momentum' }
  }

  const dashboardCards = useMemo(() => {
    const workloadLabel = remainingHours <= 4 ? 'Light' : remainingHours <= 8 ? 'Balanced' : remainingHours <= 12 ? 'Intense' : 'Heavy'
    const workloadHint = remainingHours <= 4 ? 'Room to breathe' : remainingHours <= 8 ? 'Manageable pace' : remainingHours <= 12 ? 'Needs focus' : 'Rebalance soon'
    const incompleteTasks = tasks.filter(t => !t.completed).length
    const focusScore = incompleteTasks > 0
      ? Math.max(55, Math.min(95, 100 - Math.round(remainingHours * 4) - Math.max(0, incompleteTasks - 3) * 2))
      : 0

    return [
      {
        label: 'Productivity Score',
        value: productivityMetrics.productivityScore || (incompleteTasks ? '—' : 'Complete!'),
        hint: 'Execution outlook',
        icon: '🚀',
        accent: 'from-cyan-400/20 to-sky-500/5',
        barWidth: productivityMetrics.productivityScore ? `${Math.min(100, Number.parseInt(productivityMetrics.productivityScore, 10) || 0)}%` : '0%',
      },
      {
        label: 'Remaining Work',
        value: `${workloadLabel} · ${remainingHours.toFixed(1)}h`,
        hint: workloadHint,
        icon: '⚖️',
        accent: 'from-fuchsia-500/20 to-violet-500/5',
        barWidth: `${Math.min(100, Math.round((remainingHours / 16) * 100))}%`,
      },
      {
        label: 'Deadline Risk',
        value: productivityMetrics.deadlineRisk || (incompleteTasks ? 'Moderate' : 'On Track'),
        hint: 'Delivery pressure',
        icon: '⏳',
        accent: 'from-amber-400/20 to-orange-500/5',
        barWidth: productivityMetrics.deadlineRisk ? '70%' : '0%',
      },
      {
        label: 'Focus Score',
        value: incompleteTasks ? `${focusScore}/100` : 'All done!',
        hint: 'Concentration readiness',
        icon: '🎯',
        accent: 'from-emerald-400/20 to-cyan-500/5',
        barWidth: `${focusScore}%`,
      },
    ]
  }, [productivityMetrics.deadlineRisk, productivityMetrics.productivityScore, tasks, remainingHours])

  const handlePageChange = (target) => {
    setError('')
    setPage(target)
  }

  const handleLogin = (event) => {
    event.preventDefault()
    setPage('dashboard')
  }

  const addTask = (event) => {
    event.preventDefault()
    if (!title.trim() || !description.trim()) {
      setError('Give your task a title and description.')
      return
    }

    setTasks((current) => [
      ...current,
      {
        title: title.trim(),
        description: description.trim(),
        estimate_hours: Number(estimate) || 1,
        priority: priority,
        deadline: deadline,
        completed: false,
      },
    ])
    setTitle('')
    setDescription('')
    setEstimate(1)
    setPriority('Medium')
    setDeadline('')
    setError('')
  }

  const toggleTaskCompletion = (index) => {
    const updatedTasks = [...tasks]
    updatedTasks[index].completed = !updatedTasks[index].completed
    setTasks(updatedTasks)
    
    // Auto-regenerate plan when task is completed
    if (updatedTasks[index].completed) {
      // Use setTimeout to ensure state is updated before fetching
      setTimeout(async () => {
        setLoading(true)
        try {
          const response = await fetch(GENERATE_PLAN_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ tasks: updatedTasks, username: email || 'Momentum user' }),
          })
          if (response.ok) {
            const data = await response.json()
            setAiPlan(data.plan || '')
          }
        } catch (err) {
          logger.error('Auto-regenerate plan failed:', err)
        } finally {
          setLoading(false)
        }
        
        // Also fetch updated insight
        try {
          const response = await fetch(INSIGHT_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ tasks: updatedTasks, username: email || 'Momentum user' }),
          })
          if (response.ok) {
            const data = await response.json()
            setAiInsight(data.insight || 'Great progress!')
          }
        } catch (err) {
          logger.error('Auto-regenerate insight failed:', err)
        }
      }, 0)
    }
  }

  const removeTask = (index) => {
    setTasks((current) => current.filter((_, taskIndex) => taskIndex !== index))
  }

  const generatePlan = async () => {
    if (!tasks.length) {
      setError('Add at least one task before generating your AI plan.')
      return
    }

    setLoading(true)
    setError('')
    setAiPlan('')

    try {
      const response = await fetch(GENERATE_PLAN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tasks, username: email || 'Momentum user' }),
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(body || 'Gemini API request failed')
      }

      const data = await response.json()
      setAiPlan(data.plan || '')
    } catch (fetchError) {
      setError(fetchError.message || 'Unable to generate AI plan.')
    } finally {
      setLoading(false)
    }
  }

  const fetchInsight = async () => {
    if (!tasks.length) {
      setAiInsight('Add a task to see an AI insight here.')
      return
    }

    setInsightError('')
    setInsightLoading(true)

    try {
      const response = await fetch(INSIGHT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tasks, username: email || 'Momentum user' }),
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(body || 'Insight API request failed')
      }

      const data = await response.json()
      setAiInsight(data.insight || 'Your workload looks good.')
    } catch (fetchError) {
      setInsightError(fetchError.message || 'Unable to load insight.')
      setAiInsight('Your workload looks good.')
    } finally {
      setInsightLoading(false)
    }
  }

  useEffect(() => {
    fetchInsight()
  }, [tasks])

  const sendCoachMessage = async (question) => {
    const prompt = question.trim()
    if (!prompt) return

    setCoachError('')
    setCoachLoading(true)
    setCoachMessages((current) => [...current, { role: 'user', text: prompt }])
    setCoachQuery('')

    try {
      const response = await fetch('http://127.0.0.1:8000/api/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tasks, username: email || 'Momentum user', question: prompt }),
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(body || 'Gemini coaching failed')
      }

      const data = await response.json()
      setCoachMessages((current) => [...current, { role: 'assistant', text: data.response || 'No response from AI.' }])
    } catch (fetchError) {
      setCoachError(fetchError.message || 'Unable to reach the AI coach.')
    } finally {
      setCoachLoading(false)
    }
  }

  const handleCoachSubmit = (event) => {
    event.preventDefault()
    sendCoachMessage(coachQuery)
  }

  const coachSuggestions = [
    'I only have 2 hours.',
    'I am feeling overwhelmed.',
    'What should I postpone?',
    'Give me motivation.',
  ]

  const hasLoginView = page === 'login'
  const hasDashboardView = page === 'dashboard'

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="relative isolate overflow-hidden px-6 py-8 sm:px-10 lg:px-12">
        <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-cyan-400/20 to-transparent blur-3xl" />
        <header className="mx-auto flex max-w-7xl items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-400 to-sky-600 text-slate-950 font-extrabold shadow-xl shadow-cyan-500/20">
              M
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Momentum AI</p>
              <p className="text-sm text-slate-400">Smart productivity companion</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handlePageChange('landing')}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              Landing
            </button>
            <button
              onClick={() => handlePageChange('login')}
              className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300"
            >
              Login
            </button>
          </div>
        </header>

        {hasLoginView ? (
          <main className="mx-auto mt-16 max-w-3xl rounded-[2rem] border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-slate-950/40 backdrop-blur">
            <div className="space-y-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Sign in</p>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">Login to your Momentum workspace.</h1>
                <p className="mt-4 text-slate-400">
                  This is a UI-only login experience for hackathon demo flows.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="text-sm font-semibold text-slate-200">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="mt-2 w-full rounded-3xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-200">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter a password"
                    className="mt-2 w-full rounded-3xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                  />
                </div>

                {error && (
                  <p className="rounded-3xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200 ring-1 ring-rose-500/20">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full rounded-3xl bg-cyan-400 px-6 py-4 text-sm font-semibold text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:bg-cyan-300"
                >
                  Continue to Dashboard
                </button>
              </form>
            </div>
          </main>
        ) : hasDashboardView ? (
          <main className="mx-auto mt-16 max-w-7xl space-y-10">
            <section className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur">
              <div className="relative">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Dashboard</p>
                    <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">Your productivity hub is ready.</h1>
                    <p className="mt-4 max-w-2xl text-slate-400">
                      Add tasks, track estimated time, and let Gemini craft an intelligent plan for your day.
                    </p>
                  </div>
                  <div className="rounded-3xl bg-slate-950/90 p-5 text-sm text-slate-300 ring-1 ring-white/5">
                    <p className="font-semibold text-white">Total estimated load</p>
                    <p className="mt-3 text-3xl font-semibold text-cyan-300">{totalHours.toFixed(1)} hrs</p>
                    <p className="mt-2 text-slate-500">{tasks.length} tasks · premium AI planning</p>
                  </div>
                </div>

                <div className="pointer-events-none absolute right-0 top-0 hidden w-96 translate-x-1/2 -translate-y-1/2 rounded-[2rem] border border-cyan-400/20 bg-slate-950/95 p-6 text-white shadow-2xl shadow-cyan-500/20 ring-1 ring-cyan-500/10 backdrop-blur md:block">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">AI insight</p>
                  <p className="mt-4 text-lg font-semibold text-white">
                    {insightLoading ? 'Updating insight…' : aiInsight || 'Your workload is balanced.'}
                  </p>
                  {insightError && (
                    <p className="mt-3 text-sm text-rose-300">{insightError}</p>
                  )}
                </div>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {dashboardCards.map((card) => (
                <div key={card.label} className="dashboard-card rounded-[2rem] border border-white/10 bg-slate-950/90 p-6 shadow-2xl shadow-slate-950/40 ring-1 ring-white/5">
                  <div className={`rounded-[1.5rem] border border-white/10 bg-gradient-to-br ${card.accent} p-4`}>
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-950/80 text-2xl text-cyan-200 shadow-lg shadow-cyan-500/10">
                        {card.icon}
                      </div>
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">{card.label}</p>
                        <p className="mt-1 text-sm text-slate-400">{card.hint}</p>
                      </div>
                    </div>
                    <p className="mt-6 text-3xl font-semibold text-white">{card.value}</p>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-950/70">
                      <div className="dashboard-card__bar h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-500" style={{ width: card.barWidth }} />
                    </div>
                  </div>
                </div>
              ))}
            </section>

            <section className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
              {/* LEFT: Task Management */}
              <div className="space-y-10">
                {/* Add Task Card */}
                <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Add Task</p>
                      <h2 className="mt-4 text-2xl font-semibold text-white">New work item</h2>
                    </div>
                    <span className="rounded-full bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold uppercase text-cyan-200 ring-1 ring-cyan-400/20">
                      AI-ready
                    </span>
                  </div>

                  <form onSubmit={addTask} className="mt-8 space-y-5">
                    <div>
                      <label className="text-sm font-medium text-slate-300">Task title</label>
                      <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Design onboarding flow"
                        className="mt-2 w-full rounded-3xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-300">Description</label>
                      <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Give your task context, goal, and constraints."
                        rows={3}
                        className="mt-2 w-full rounded-3xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="text-sm font-medium text-slate-300">Hours</label>
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={estimate}
                          onChange={(event) => setEstimate(event.target.value)}
                          className="mt-2 w-full rounded-3xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-300">Priority</label>
                        <select
                          value={priority}
                          onChange={(event) => setPriority(event.target.value)}
                          className="mt-2 w-full rounded-3xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-300">Deadline</label>
                        <input
                          type="datetime-local"
                          value={deadline}
                          onChange={(event) => setDeadline(event.target.value)}
                          className="mt-2 w-full rounded-3xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full rounded-3xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:bg-cyan-300"
                    >
                      Add task
                    </button>
                  </form>
                </div>

                {/* Task List Card */}
                <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Task list</p>
                    <h2 className="mt-4 text-2xl font-semibold text-white">Current backlog</h2>
                  </div>

                  <div className="mt-8 max-h-96 space-y-3 overflow-y-auto pr-2">
                    {tasks.map((task, index) => (
                      <div
                        key={index}
                        className={`rounded-3xl border p-4 transition ${
                          task.completed
                            ? 'border-cyan-400/30 bg-cyan-500/5 opacity-70'
                            : 'border-white/10 bg-slate-950/90 hover:border-cyan-400/30'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => toggleTaskCompletion(index)}
                            className="mt-1 h-5 w-5 cursor-pointer accent-cyan-400"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`text-sm font-semibold ${task.completed ? 'text-slate-400 line-through' : 'text-white'}`}>
                                {task.title}
                              </p>
                              <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
                                task.priority === 'High'
                                  ? 'bg-rose-500/20 text-rose-200'
                                  : task.priority === 'Medium'
                                  ? 'bg-amber-500/20 text-amber-200'
                                  : 'bg-emerald-500/20 text-emerald-200'
                              }`}>
                                {task.priority}
                              </span>
                            </div>
                            <p className={`mt-1 text-xs leading-5 ${task.completed ? 'text-slate-500' : 'text-slate-400'}`}>
                              {task.description}
                            </p>
                            <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                              <span>⏱ {task.estimate_hours}h</span>
                              {task.deadline && (
                                <span>📅 {new Date(task.deadline).toLocaleDateString()} {new Date(task.deadline).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => removeTask(index)}
                            className="text-xs font-semibold uppercase text-rose-300 transition hover:text-rose-100 whitespace-nowrap"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                    {!tasks.length && (
                      <p className="py-8 text-center text-sm text-slate-400">No tasks yet. Add one above to get started.</p>
                    )}
                  </div>

                  {error && (
                    <div className="mt-6 rounded-3xl bg-rose-500/10 p-4 text-sm text-rose-200 ring-1 ring-rose-500/20">
                      {error}
                    </div>
                  )}

                  {totalHours > 10 && (
                    <div className="mt-6 rounded-3xl bg-amber-500/10 p-4 text-sm text-amber-100 ring-1 ring-amber-400/20">
                      Your current load is above 10 hours. Gemini will suggest ways to rebalance the plan.
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: AI Results */}
              <div className="space-y-10">
                {!aiPlan ? (
                  <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-slate-950/40 backdrop-blur text-center">
                    <div className="text-5xl mb-4">✨</div>
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">AI Plan</p>
                    <h2 className="mt-4 text-2xl font-semibold text-white">AI-Powered Strategy</h2>
                    <p className="mt-4 text-slate-400">
                      Generate an AI plan to see personalized insights, task priorities, optimized scheduling, and productivity tips.
                    </p>
                    <button
                      onClick={generatePlan}
                      disabled={loading || !tasks.length}
                      className="mt-6 rounded-3xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading ? 'Generating…' : 'Generate AI Plan'}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-[2rem] border border-cyan-400/20 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-10 shadow-2xl shadow-slate-950/40 ring-1 ring-cyan-400/10">
                    <div className="flex items-start justify-between gap-4 mb-8">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">AI Result</p>
                        <h2 className="mt-4 text-3xl font-semibold text-white">Gemini Strategy Breakdown</h2>
                      </div>
                      <span className="inline-flex items-center justify-center rounded-full bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase text-cyan-200 ring-1 ring-cyan-400/20 whitespace-nowrap">
                        Premium AI
                      </span>
                    </div>

                    {/* Plan Sections in Single Card */}
                    {planSections.length ? (
                      <div className="space-y-6">
                        {planSections.map((section, idx) => {
                          const isPriority = section.title.includes('Priority')
                          const isInsights = section.title.includes('Insights')
                          const meta = sectionMeta[section.title] || {}
                          
                          return (
                            <div
                              key={`${section.title}-${idx}`}
                              className={`rounded-2xl p-5 ${
                                isPriority
                                  ? 'border border-cyan-400/30 bg-gradient-to-br from-slate-800/50 to-slate-900/50'
                                  : 'border-l-4 border-cyan-400/40 bg-slate-950/30 pl-5'
                              }`}
                            >
                              {isPriority ? (
                                <div className="space-y-3">
                                  <div className="flex items-start gap-3">
                                    <span className="text-2xl flex-shrink-0">{section.emoji || '⚡'}</span>
                                    <h3 className="text-lg font-semibold text-white">{section.title}</h3>
                                  </div>
                                  <div className="whitespace-pre-line text-sm leading-6 text-slate-200 ml-11">
                                    {section.content}
                                  </div>
                                </div>
                              ) : isInsights ? (
                                <div className="space-y-2">
                                  <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
                                    <span>💡</span>
                                    {section.title}
                                  </h3>
                                  <div className="whitespace-pre-line text-sm leading-6 text-slate-200">
                                    {section.content}
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="flex items-start gap-3">
                                    <div className="text-2xl flex-shrink-0">{meta.icon || '✨'}</div>
                                    <div>
                                      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
                                        {section.title}
                                      </p>
                                      <p className="mt-1 text-xs text-slate-400">{meta.subtitle || 'AI-generated insight'}</p>
                                    </div>
                                  </div>
                                  <div className="whitespace-pre-line text-sm leading-6 text-slate-200 ml-11">
                                    {section.content}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="whitespace-pre-line text-sm leading-7 text-slate-100">{aiPlan}</div>
                    )}
                  </div>
                )}

                {/* Momentum Companion */}
                <div className="rounded-[2rem] border border-cyan-400/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur ring-1 ring-cyan-400/10">
                  <div className="text-center">
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Momentum Companion</p>
                    <div className="mt-6 text-6xl">
                      {getMomentumStage(momentumLevel).emoji}
                    </div>
                    <h3 className="mt-4 text-2xl font-bold text-cyan-200">{momentumLevel}%</h3>
                    <p className="mt-2 text-sm font-semibold text-cyan-300">{getMomentumStage(momentumLevel).label}</p>
                    <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-800/40">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 transition-all duration-500"
                        style={{ width: `${momentumLevel}%` }}
                      />
                    </div>
                    <p className="mt-4 text-xs text-slate-400">
                      {completedCount} of {tasks.length} tasks completed
                    </p>
                  </div>
                </div>

                {/* AI Coach */}
                <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur">
                  <div className="flex items-center justify-between gap-4 mb-8">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">AI Coach</p>
                      <h2 className="mt-3 text-xl font-semibold text-white">Adaptive Guidance</h2>
                    </div>
                    <span className="rounded-full bg-slate-800/90 px-3 py-1.5 text-xs font-semibold uppercase text-cyan-200 ring-1 ring-white/10 whitespace-nowrap">
                      On-demand
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-3xl bg-slate-950/90 p-5 ring-1 ring-white/5 max-h-56 overflow-y-auto">
                      {coachMessages.length ? (
                        <div className="space-y-4">
                          {coachMessages.map((message, idx) => (
                            <div key={idx} className={`rounded-3xl px-4 py-3 ${message.role === 'assistant' ? 'bg-cyan-500/10 text-cyan-100' : 'bg-slate-800/80 text-slate-200'}`}>
                              <p className="text-xs uppercase tracking-[0.3em] text-slate-400 font-semibold">{message.role === 'assistant' ? 'Coach' : 'You'}</p>
                              <p className="mt-2 text-sm leading-6">{message.text}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm leading-6 text-slate-400">
                          Ask the coach for adaptive guidance based on your progress.
                        </p>
                      )}
                    </div>

                    <form onSubmit={handleCoachSubmit} className="space-y-3">
                      <textarea
                        value={coachQuery}
                        onChange={(event) => setCoachQuery(event.target.value)}
                        placeholder="What should I focus on first?"
                        rows={3}
                        className="w-full rounded-3xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none transition focus:border-cyan-400 text-sm"
                      />
                      {coachError && (
                        <p className="rounded-3xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200 ring-1 ring-rose-500/20">
                          {coachError}
                        </p>
                      )}
                      <div className="flex flex-col gap-2">
                        <button
                          type="submit"
                          disabled={coachLoading}
                          className="w-full rounded-3xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {coachLoading ? 'Asking coach…' : 'Ask AI Coach'}
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                          {coachSuggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => sendCoachMessage(suggestion)}
                              className="rounded-3xl border border-white/10 bg-slate-950/90 px-3 py-2 text-xs text-slate-300 transition hover:border-cyan-400 hover:text-white"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </section>
          </main>
        ) : (
          <main className="mx-auto mt-16 max-w-7xl lg:mt-24">
            <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:gap-20">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Build momentum, avoid last-minute stress</p>
                <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Your AI Productivity Companion.
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                  Momentum helps you prioritize work, reduce stress, adapt your plans, and stay productive with intelligent AI guidance.
                </p>
                <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <button
                    onClick={() => handlePageChange('login')}
                    className="inline-flex w-full items-center justify-center rounded-full bg-cyan-400 px-8 py-4 text-base font-semibold text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:bg-cyan-300 sm:w-auto"
                  >
                    Start your flow
                  </button>
                  <button
                    onClick={() => handlePageChange('dashboard')}
                    className="inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-8 py-4 text-base font-semibold text-white/80 transition hover:text-white sm:w-auto"
                  >
                    Explore the experience
                  </button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -right-10 top-1/2 -z-10 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl" />
                <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">Momentum Board</p>
                      <h2 className="mt-4 text-3xl font-semibold text-white">Plan your peak productivity.</h2>
                    </div>
                    <span className="rounded-full bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold uppercase text-cyan-200 ring-1 ring-cyan-400/20">
                      AI Premium
                    </span>
                  </div>

                  <div className="mt-8 space-y-5">
                    <div className="rounded-3xl bg-slate-950/90 p-5 ring-1 ring-white/5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-400">Focus task</p>
                        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-cyan-300">High</span>
                      </div>
                      <p className="mt-4 text-xl font-semibold text-white">Finalize momentum deck</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        AI-crafted schedule, clarity cues, and timing suggestions for your most important work.
                      </p>
                    </div>
                    <div className="rounded-3xl bg-slate-950/90 p-5 ring-1 ring-white/5">
                      <div className="flex items-center justify-between text-sm text-slate-400">
                        <span>Focus window</span>
                        <span>2 hrs left</span>
                      </div>
                      <div className="mt-4 flex items-center gap-3">
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full w-3/4 rounded-full bg-cyan-400" />
                        </div>
                        <span className="text-xs font-semibold uppercase text-slate-500">75%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  )
}

export default App;
