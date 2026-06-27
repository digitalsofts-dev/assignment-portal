'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Home() {
  const [form, setForm] = useState({
    name: '', email: '', github: '', explanation: ''
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<any>({})
  const [resumeUrl, setResumeUrl] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const url = params.get('resumeUrl')
    if (url) setResumeUrl(url)
  }, [])

  const validate = () => {
    const newErrors: any = {}

    // Name validation
    if (!form.name.trim()) {
      newErrors.name = 'Name is required!'
    } else if (form.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters!'
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!form.email.trim()) {
      newErrors.email = 'Email is required!'
    } else if (!emailRegex.test(form.email)) {
      newErrors.email = 'Please enter a valid email address!'
    }

    // GitHub validation
    const githubRegex = /^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+\/?$/
    if (!form.github.trim()) {
      newErrors.github = 'GitHub repository link is required!'
    } else if (!githubRegex.test(form.github)) {
      newErrors.github = 'Please enter a valid GitHub repository URL (e.g. https://github.com/username/repo)'
    }

    // Explanation validation
    if (!form.explanation.trim()) {
      newErrors.explanation = 'Please provide a brief explanation!'
    } else if (form.explanation.trim().length < 20) {
      newErrors.explanation = 'Explanation must be at least 20 characters!'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setLoading(true)

    const { error } = await supabase
      .from('assignments')
      .insert({
        name: form.name,
        email: form.email,
        submitted_github: form.github,
        explanation: form.explanation,
        submitted_at: new Date().toISOString(),
        status: 'submitted'
      })

    if (error) {
      setErrors({ submit: 'Submission failed: ' + error.message })
    } else {
      if (resumeUrl) {
        await fetch(resumeUrl, { method: 'POST' }).catch(() => {})
      }
      setSubmitted(true)
    }
    setLoading(false)
  }

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8 bg-white rounded-xl shadow">
        <h1 className="text-2xl font-bold text-green-600">Submitted! ✅</h1>
        <p className="text-gray-600 mt-2">We will review and get back to you soon.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow w-full max-w-lg">
        <h1 className="text-2xl font-bold mb-6">Assignment Submission</h1>

        {errors.submit && <p className="text-red-500 mb-4">{errors.submit}</p>}

        <div className="mb-4">
          <input
            className={`w-full border p-3 rounded ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
            placeholder="Your Name"
            value={form.name}
            onChange={e => setForm({...form, name: e.target.value})}
          />
          {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
        </div>

        <div className="mb-4">
          <input
            className={`w-full border p-3 rounded ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
            placeholder="Your Email"
            value={form.email}
            onChange={e => setForm({...form, email: e.target.value})}
          />
          {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
        </div>

        <div className="mb-4">
          <input
            className={`w-full border p-3 rounded ${errors.github ? 'border-red-500' : 'border-gray-300'}`}
            placeholder="GitHub Repository Link"
            value={form.github}
            onChange={e => setForm({...form, github: e.target.value})}
          />
          {errors.github && <p className="text-red-500 text-sm mt-1">{errors.github}</p>}
        </div>

        <div className="mb-4">
          <textarea
            className={`w-full border p-3 rounded h-32 ${errors.explanation ? 'border-red-500' : 'border-gray-300'}`}
            placeholder="Brief explanation of your solution (min 20 characters)"
            value={form.explanation}
            onChange={e => setForm({...form, explanation: e.target.value})}
          />
          {errors.explanation && <p className="text-red-500 text-sm mt-1">{errors.explanation}</p>}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-blue-600 text-white p-3 rounded font-bold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit Assignment'}
        </button>
      </div>
    </div>
  )
}
