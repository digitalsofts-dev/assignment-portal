"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ROWS_PER_PAGE = 10;

type Candidate = {
  id: string;
  name: string;
  email: string;
  phone: string;
  skills: string | string[];
  experience: string | null;
  education: string;
  score: number;
  status: string;
  created_at: string;
  interview_score: number | null;
  cal_booking_date: string | null;
  cal_booking_time: string | null;
  cal_booking_status: string | null;
  cv_path: string | null;
  evaluation_pdf_path: string | null;
  assignment_pdf_path: string | null;
  manual_override?: boolean;
};

type Assignment = {
  id: string;
  candidate_id: string;
  assignment_text: string;
  assignment_title: string | null;
  submitted_github: string | null;
  submitted_at: string | null;
  review_score: number | null;
  status: string;
  created_at: string;
  explanation: string | null;
  assignment_pdf_path: string | null;
};

async function openPdf(path: string | null | undefined) {
  if (!path) return;
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    alert("Could not load PDF. Please try again.");
    return;
  }
  window.open(data.signedUrl, "_blank");
}

function PdfButton({ path, label }: { path: string | null | undefined; label: string }) {
  if (!path) return null;
  return (
    <button
      onClick={() => openPdf(path)}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-all"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; dot: string; text: string }> = {
    selected:          { bg: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",  dot: "bg-emerald-500", text: "Selected" },
    rejected:          { bg: "bg-red-50 text-red-600 ring-1 ring-red-200",              dot: "bg-red-500",     text: "Rejected" },
    applied:           { bg: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",        dot: "bg-amber-400",   text: "Applied" },
    "interview rejected": { bg: "bg-orange-50 text-orange-700 ring-1 ring-orange-200", dot: "bg-orange-400",  text: "Interview Rejected" },
  };
  const s = map[status?.toLowerCase()] || { bg: "bg-slate-100 text-slate-600 ring-1 ring-slate-200", dot: "bg-slate-400", text: status };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.text.charAt(0).toUpperCase() + s.text.slice(1)}
    </span>
  );
}

function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth="4" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.6s ease" }} />
    </svg>
  );
}

function TimelineStep({ icon, title, done, last = false, children }: {
  icon: React.ReactNode; title: string; done: boolean; last?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0 transition-all
          ${done ? "bg-violet-600 text-white shadow-md shadow-violet-200" : "bg-slate-100 text-slate-400"}`}>
          {icon}
        </div>
        {!last && <div className={`w-px flex-1 mt-2 mb-2 ${done ? "bg-violet-200" : "bg-slate-100"}`} />}
      </div>
      <div className={`flex-1 pb-6 ${last ? "" : ""}`}>
        <p className={`text-sm font-semibold mb-2 ${done ? "text-slate-800" : "text-slate-400"}`}>{title}</p>
        <div className={`rounded-xl p-4 text-sm ${done ? "bg-slate-50 border border-slate-100" : "bg-slate-50/50 border border-slate-100/50"}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

function AssignmentSection({ assignment, candidate }: { assignment: Assignment; candidate: Candidate }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="space-y-2">
      {assignment.assignment_title && (
        <div className="flex justify-between">
          <span className="text-slate-500">Title</span>
          <span className="font-medium text-slate-800">{assignment.assignment_title}</span>
        </div>
      )}
      <div className="flex justify-between">
        <span className="text-slate-500">Status</span>
        <span className="font-medium text-slate-800 capitalize">{assignment.status}</span>
      </div>
      {assignment.submitted_github && (
        <div className="flex justify-between items-center">
          <span className="text-slate-500">GitHub</span>
          <a href={assignment.submitted_github} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-violet-600 hover:text-violet-800 font-medium text-xs">
            View Repo →
          </a>
        </div>
      )}
      {assignment.submitted_at && (
        <div className="flex justify-between">
          <span className="text-slate-500">Submitted</span>
          <span className="font-medium text-slate-800">
            {new Date(assignment.submitted_at).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })}
          </span>
        </div>
      )}
      {assignment.review_score !== null && (
        <div className="flex justify-between">
          <span className="text-slate-500">Score</span>
          <span className="font-semibold text-slate-800">{assignment.review_score}/100</span>
        </div>
      )}
      {assignment.explanation && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-slate-500 text-xs mb-1">Feedback</p>
          <p className="text-slate-700 text-sm leading-relaxed">{assignment.explanation}</p>
        </div>
      )}
      <div className="flex gap-2 mt-2 flex-wrap">
        <PdfButton path={candidate.assignment_pdf_path} label="Assignment PDF" />
      </div>
      {assignment.assignment_text && (
        <div className="mt-2">
          <button onClick={() => setExpanded(!expanded)}
            className="text-violet-600 hover:text-violet-800 text-xs font-medium flex items-center gap-1">
            {expanded ? "▲ Hide" : "▼ View Full Assignment"}
          </button>
          {expanded && (
            <div className="mt-3 bg-white border border-slate-200 rounded-lg p-4 text-xs text-slate-700 whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed font-mono">
              {assignment.assignment_text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CandidateProfile({ candidate: initialCandidate, assignment, onBack, onStatusChange }: {
  candidate: Candidate;
  assignment: Assignment | null;
  onBack: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [candidate, setCandidate] = useState(initialCandidate);
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const skills = typeof candidate.skills === "string"
    ? candidate.skills.replace(/[\[\]"]/g, "").split(",").map((s) => s.trim()).filter(Boolean)
    : candidate.skills || [];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const updateStatus = async (status: string) => {
    setUpdating(true);
    const { error } = await supabase
      .from("candidates")
      .update({ status, manual_override: true })
      .eq("id", candidate.id);
    if (!error) {
      setCandidate(prev => ({ ...prev, status, manual_override: true }));
      onStatusChange(candidate.id, status);
      showToast(`Status updated to ${status}`);
    }
    setUpdating(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-xl animate-in slide-in-from-top-2">
          ✓ {toast}
        </div>
      )}

      {/* Top bar */}
      <div className="bg-white border-b border-slate-100 px-6 py-3 flex items-center gap-3 sticky top-0 z-40">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition text-sm font-medium">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15,18 9,12 15,6"/></svg>
          All Candidates
        </button>
        <span className="text-slate-200">/</span>
        <span className="text-sm text-slate-800 font-semibold">{candidate.name}</span>
        <div className="ml-auto">
          <StatusBadge status={candidate.status} />
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-5">
        {/* Hero Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" />
          <div className="p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-violet-200">
                  {candidate.name.charAt(0)}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">{candidate.name}</h1>
                  <p className="text-slate-500 text-sm">{candidate.email}</p>
                  {candidate.phone && <p className="text-slate-400 text-xs mt-0.5">{candidate.phone}</p>}
                </div>
              </div>

              {/* HR Action Buttons */}
              {!candidate.manual_override ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-400 mr-1">HR Decision:</span>
                  <button
                    onClick={() => updateStatus("selected")}
                    disabled={updating || candidate.status === "selected"}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition disabled:opacity-40 shadow-sm"
                  >
                    ✓ Select
                  </button>
                  <button
                    onClick={() => updateStatus("rejected")}
                    disabled={updating || candidate.status === "rejected"}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition disabled:opacity-40 shadow-sm"
                  >
                    ✕ Reject
                  </button>
                  <button
                    onClick={() => updateStatus("applied")}
                    disabled={updating || candidate.status === "applied"}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition disabled:opacity-40"
                  >
                    ↩ Reset
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-violet-50 text-violet-600 px-3 py-1.5 rounded-full font-medium ring-1 ring-violet-200">
                    🔒 Manual Override Active
                  </span>
                  <button
                    onClick={() => updateStatus("applied")}
                    disabled={updating}
                    className="text-xs text-slate-500 hover:text-slate-700 underline transition"
                  >
                    Undo
                  </button>
                </div>
              )}
            </div>

            {/* Score Cards */}
            <div className="mt-6 grid grid-cols-3 gap-4">
              {[
                { label: "CV Score", value: candidate.score, show: true },
                { label: "Interview", value: candidate.interview_score, show: true },
                { label: "Experience", value: candidate.experience && candidate.experience !== "0" ? candidate.experience : null, show: true, isText: true },
              ].map((item, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                  {item.isText ? (
                    <p className="text-2xl font-bold text-slate-800">{item.value ?? "—"}</p>
                  ) : (
                    <div className="flex flex-col items-center">
                      {item.value !== null && item.value !== undefined ? (
                        <div className="relative">
                          <ScoreRing score={item.value as number} />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-sm font-bold text-slate-800">{item.value}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-2xl font-bold text-slate-300 py-3">—</p>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-1">{item.label}</p>
                </div>
              ))}
            </div>

            {/* Info Grid */}
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-slate-400 text-xs mb-1">Education</p>
                <p className="text-slate-800 font-medium text-sm leading-snug">{candidate.education || "—"}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-slate-400 text-xs mb-1">Applied On</p>
                <p className="text-slate-800 font-medium">
                  {new Date(candidate.created_at).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
            </div>

            {/* Skills */}
            {skills.length > 0 && (
              <div className="mt-4">
                <p className="text-slate-400 text-xs mb-2">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((skill, i) => (
                    <span key={i} className="px-2.5 py-1 bg-violet-50 text-violet-700 rounded-lg text-xs font-medium border border-violet-100">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* CV Button */}
            <div className="mt-4 flex gap-2">
              <PdfButton path={candidate.cv_path} label="View CV" />
              <PdfButton path={candidate.evaluation_pdf_path} label="Evaluation Report" />
            </div>
          </div>
        </div>

        {/* Application Journey */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-bold text-slate-800 text-base mb-6 flex items-center gap-2">
            <span className="w-6 h-6 bg-violet-100 rounded-lg flex items-center justify-center text-violet-600 text-xs">▶</span>
            Application Journey
          </h2>

          <TimelineStep icon="📄" title="CV Submitted" done={true}>
            <div className="flex justify-between text-slate-600">
              <span>CV Score</span>
              <span className="font-semibold text-slate-800">{candidate.score}/100</span>
            </div>
            <div className="flex justify-between text-slate-600 mt-1">
              <span>Applied</span>
              <span className="font-medium text-slate-800">
                {new Date(candidate.created_at).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })}
              </span>
            </div>
          </TimelineStep>

          <TimelineStep icon="🎯" title="AI Interview" done={candidate.interview_score !== null}>
            {candidate.interview_score !== null ? (
              <div className="flex justify-between text-slate-600">
                <span>Score</span>
                <span className="font-semibold text-slate-800">{candidate.interview_score}/100</span>
              </div>
            ) : <span className="text-slate-400 text-sm">Interview not yet completed</span>}
          </TimelineStep>

          <TimelineStep icon="💻" title="Technical Assignment" done={assignment !== null}>
            {assignment
              ? <AssignmentSection assignment={assignment} candidate={candidate} />
              : <span className="text-slate-400 text-sm">Assignment not yet sent</span>
            }
          </TimelineStep>

          <TimelineStep icon="📅" title="Final Interview" done={candidate.cal_booking_status === "booked"} last={true}>
            {candidate.cal_booking_status === "booked" ? (
              <div className="space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Date</span>
                  <span className="font-medium text-slate-800">
                    {candidate.cal_booking_date
                      ? new Date(candidate.cal_booking_date).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", day: "numeric", month: "long" })
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Time</span>
                  <span className="font-medium text-slate-800">{candidate.cal_booking_time || "—"}</span>
                </div>
              </div>
            ) : candidate.cal_booking_status === "pending" ? (
              <span className="text-amber-600 text-sm">Link sent — awaiting booking</span>
            ) : (
              <span className="text-slate-400 text-sm">Not yet scheduled</span>
            )}
          </TimelineStep>
        </div>

        {/* Final Decision */}
        <div className={`rounded-2xl border p-5 flex items-center justify-between
          ${candidate.status === "selected" ? "bg-emerald-50 border-emerald-200" :
            candidate.status === "rejected" ? "bg-red-50 border-red-200" :
            "bg-slate-50 border-slate-200"}`}>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Final Decision</p>
            <StatusBadge status={candidate.status} />
          </div>
          {candidate.manual_override && (
            <span className="text-xs text-slate-500">Set manually by HR</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "candidates">("dashboard");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const handleLogin = async () => {
    setLoginError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) { setLoginError("Invalid email or password"); return; }
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).single();
    if (!roleData) { setLoginError("Access denied — no role assigned"); return; }
    setUserRole(roleData.role);
    setAuthenticated(true);
  };

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).single();
        if (roleData) { setUserRole(roleData.role); setAuthenticated(true); }
      }
      setLoading(false);
    };
    checkSession();
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    const fetchData = async () => {
      setLoading(true);
      const [{ data: cData }, { data: aData }] = await Promise.all([
        supabase.from("candidates").select("*").order("created_at", { ascending: false }),
        supabase.from("assignments").select("*"),
      ]);
      if (cData) setCandidates(cData as Candidate[]);
      if (aData) setAssignments(aData as Assignment[]);
      setLoading(false);
    };
    fetchData();
  }, [authenticated]);

  const getAssignment = (id: string) => assignments.find((a) => a.candidate_id === id) || null;

  const pipelineData = useMemo(() => [
    { stage: "Applied", count: candidates.length },
    { stage: "Interviewed", count: candidates.filter(c => c.interview_score !== null).length },
    { stage: "Assignment", count: assignments.length },
    { stage: "Selected", count: candidates.filter(c => c.status === "selected").length },
  ], [candidates, assignments]);

  const pieData = useMemo(() => [
    { name: "Selected", value: candidates.filter(c => c.status === "selected").length },
    { name: "Rejected", value: candidates.filter(c => c.status === "rejected").length },
    { name: "Applied", value: candidates.filter(c => c.status === "applied").length },
  ], [candidates]);

  const PIE_COLORS = ["#10B981", "#EF4444", "#F59E0B"];

  const candidatesPerMonth = useMemo(() => {
    const map: Record<string, number> = {};
    candidates.forEach(c => {
      const month = new Date(c.created_at).toLocaleDateString("en-PK", { month: "short", year: "numeric", timeZone: "Asia/Karachi" });
      map[month] = (map[month] || 0) + 1;
    });
    return Object.entries(map).map(([date, count]) => ({ date, count }));
  }, [candidates]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: candidates.length };
    candidates.forEach(c => {
      const s = c.status?.toLowerCase() || "unknown";
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    let result = candidates;
    if (statusFilter !== "all") result = result.filter(c => c.status?.toLowerCase() === statusFilter);
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter(c => c.name?.toLowerCase().includes(term) || c.email?.toLowerCase().includes(term));
    }
    result = [...result].sort((a, b) => {
      const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return sortOrder === "newest" ? diff : -diff;
    });
    return result;
  }, [candidates, statusFilter, searchTerm, sortOrder]);

  useEffect(() => { setCurrentPage(1); }, [statusFilter, searchTerm, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredCandidates.length / ROWS_PER_PAGE));
  const paginatedCandidates = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredCandidates.slice(start, start + ROWS_PER_PAGE);
  }, [filteredCandidates, currentPage]);

  const avgScore = useMemo(() => {
    if (!candidates.length) return 0;
    return (candidates.reduce((s, c) => s + (c.score || 0), 0) / candidates.length).toFixed(1);
  }, [candidates]);

  const conversionRate = useMemo(() => {
    if (!candidates.length) return 0;
    return ((candidates.filter(c => c.status === "selected").length / candidates.length) * 100).toFixed(0);
  }, [candidates]);

  // LOGIN
  if (!authenticated && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-violet-900/50">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Recruitment Tracker</h1>
            <p className="text-slate-400 text-sm mt-1">Sign in to manage your pipeline</p>
          </div>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
            {loginError && (
              <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                {loginError}
              </div>
            )}
            <div className="space-y-3">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
              />
              <button
                onClick={handleLogin}
                className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white py-3 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-violet-900/50 mt-1"
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 gap-3">
      <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-400 text-sm">Loading pipeline...</p>
    </div>
  );

  if (selectedCandidate) {
    return (
      <CandidateProfile
        candidate={selectedCandidate}
        assignment={getAssignment(selectedCandidate.id)}
        onBack={() => setSelectedCandidate(null)}
        onStatusChange={(id, status) => {
          setCandidates(prev => prev.map(c => c.id === id ? { ...c, status, manual_override: true } : c));
          setSelectedCandidate(prev => prev ? { ...prev, status, manual_override: true } : null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar + Main layout */}
      <div className="flex">
        {/* Sidebar */}
        <div className="w-56 min-h-screen bg-white border-r border-slate-100 fixed left-0 top-0 flex flex-col">
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">RT Dashboard</p>
                <p className="text-xs text-slate-400 capitalize">{userRole}</p>
              </div>
            </div>
          </div>

          <nav className="p-3 flex-1">
            {[
              { key: "dashboard", label: "Overview", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
              { key: "candidates", label: "Candidates", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as "dashboard" | "candidates")}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-1
                  ${activeTab === tab.key
                    ? "bg-violet-50 text-violet-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
              >
                <span className={activeTab === tab.key ? "text-violet-600" : ""}>{tab.icon}</span>
                {tab.label}
                {tab.key === "candidates" && (
                  <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-md font-semibold
                    ${activeTab === tab.key ? "bg-violet-100 text-violet-600" : "bg-slate-100 text-slate-500"}`}>
                    {candidates.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="p-3 border-t border-slate-100">
            <button
              onClick={async () => { await supabase.auth.signOut(); setAuthenticated(false); setUserRole(null); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all font-medium"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sign Out
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="ml-56 flex-1 min-h-screen">
          {/* Top Header */}
          <div className="bg-white border-b border-slate-100 px-8 py-4 sticky top-0 z-30">
            <h1 className="text-lg font-bold text-slate-800">
              {activeTab === "dashboard" ? "Pipeline Overview" : "All Candidates"}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeTab === "dashboard" ? "Real-time recruitment analytics" : `${candidates.length} candidates total`}
            </p>
          </div>

          <div className="p-8">
            {activeTab === "dashboard" && (
              <>
                {/* Stat Cards */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "Total Applicants", value: candidates.length, sub: "All time", color: "violet", icon: "👥" },
                    { label: "Avg CV Score", value: avgScore, sub: "Out of 100", color: "blue", icon: "📊" },
                    { label: "Selected", value: candidates.filter(c => c.status === "selected").length, sub: `${conversionRate}% conversion`, color: "emerald", icon: "✅" },
                    { label: "Rejected", value: candidates.filter(c => c.status === "rejected").length, sub: "Screened out", color: "red", icon: "❌" },
                  ].map((stat, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xl">{stat.icon}</span>
                        <span className="text-xs text-slate-400 font-medium">{stat.sub}</span>
                      </div>
                      <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
                      <p className="text-xs text-slate-500 mt-1 font-medium">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Charts */}
                <div className="grid grid-cols-2 gap-5 mb-5">
                  <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                    <h3 className="font-bold text-slate-800 text-sm mb-4">Recruitment Pipeline</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={pipelineData} layout="vertical" barSize={20}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="stage" width={80} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                        <Bar dataKey="count" fill="#7c3aed" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                    <h3 className="font-bold text-slate-800 text-sm mb-4">Decision Breakdown</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" outerRadius={85} innerRadius={48}
                          label={({ name, value }) => value > 0 ? `${name}: ${value}` : ""}
                          labelLine={false} fontSize={11}>
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                  <h3 className="font-bold text-slate-800 text-sm mb-4">Applications Over Time</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={candidatesPerMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                      <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2.5} dot={{ fill: "#7c3aed", r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {activeTab === "candidates" && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
                {/* Controls */}
                <div className="p-5 border-b border-slate-100 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { key: "all", label: "All" },
                      { key: "applied", label: "Applied" },
                      { key: "selected", label: "Selected" },
                      { key: "rejected", label: "Rejected" },
                    ].map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setStatusFilter(tab.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition
                          ${statusFilter === tab.key
                            ? "bg-violet-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                      >
                        {tab.label} <span className="opacity-70">({statusCounts[tab.key] || 0})</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      <input
                        type="text"
                        placeholder="Search candidates..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 w-48 focus:outline-none focus:ring-2 focus:ring-violet-300"
                      />
                    </div>
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 bg-white focus:outline-none"
                    >
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                    </select>
                  </div>
                </div>

                {/* Table */}
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Candidate</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">CV Score</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Applied</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Override</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCandidates.length === 0 ? (
                      <tr><td colSpan={5} className="py-16 text-center text-slate-400 text-sm">No candidates found.</td></tr>
                    ) : (
                      paginatedCandidates.map(candidate => (
                        <tr
                          key={candidate.id}
                          onClick={() => setSelectedCandidate(candidate)}
                          className="border-b border-slate-50 hover:bg-violet-50/50 cursor-pointer transition group"
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {candidate.name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800 group-hover:text-violet-700 transition">{candidate.name}</p>
                                <p className="text-xs text-slate-400">{candidate.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <StatusBadge status={candidate.status} />
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${candidate.score >= 70 ? "bg-emerald-500" : candidate.score >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                                  style={{ width: `${candidate.score}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-slate-700">{candidate.score}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-xs text-slate-400">
                            {new Date(candidate.created_at).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", day: "numeric", month: "short" })}
                          </td>
                          <td className="px-5 py-3.5">
                            {candidate.manual_override && (
                              <span className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full ring-1 ring-violet-200 font-medium">Manual</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Pagination */}
                {filteredCandidates.length > ROWS_PER_PAGE && (
                  <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 text-xs text-slate-500">
                    <span>Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}–{Math.min(currentPage * ROWS_PER_PAGE, filteredCandidates.length)} of {filteredCandidates.length}</span>
                    <div className="flex gap-1.5">
                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition font-medium">← Prev</button>
                      <span className="px-3 py-1.5 font-medium">{currentPage}/{totalPages}</span>
                      <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition font-medium">Next →</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
