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
  const [error, setError] = useState('')
  const [resumeUrl, setResumeUrl] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const url = params.get('resumeUrl')
    if (url) setResumeUrl(url)
  }, [])

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.github) {
      setError('Sab fields fill karo!')
      return
    }
    setLoading(true)
    setError('')

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
      setError('Error: ' + error.message)
    } else {
      // resumeUrl call karo n8n Wait node resume karne ke liye
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
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <input className="w-full border p-3 rounded mb-4" placeholder="Your Name"
          value={form.name}
          onChange={e => setForm({...form, name: e.target.value})} />
        <input className="w-full border p-3 rounded mb-4" placeholder="Your Email"
          value={form.email}
          onChange={e => setForm({...form, email: e.target.value})} />
        <input className="w-full border p-3 rounded mb-4" placeholder="GitHub Repository Link"
          value={form.github}
          onChange={e => setForm({...form, github: e.target.value})} />
        <textarea className="w-full border p-3 rounded mb-4 h-32" placeholder="Brief explanation of your solution"
          value={form.explanation}
          onChange={e => setForm({...form, explanation: e.target.value})} />
        <button onClick={handleSubmit} disabled={loading}
          className="w-full bg-blue-600 text-white p-3 rounded font-bold hover:bg-blue-700">
          {loading ? 'Submitting...' : 'Submit Assignment'}
        </button>
      </div>
    </div>
  )
}
