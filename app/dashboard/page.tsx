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
    alert("PDF load nahi ho saka. Please try again.");
    return;
  }
  window.open(data.signedUrl, "_blank");
}

function PdfButton({ path, label }: { path: string | null | undefined; label: string }) {
  if (!path) return null;
  return (
    <button
      onClick={() => openPdf(path)}
      className="mt-2 inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 hover:underline text-sm font-medium transition"
    >
      📄 {label}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    selected: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    rejected: "bg-red-100 text-red-700 border border-red-200",
    applied: "bg-amber-100 text-amber-700 border border-amber-200",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${map[status] || "bg-gray-100 text-gray-600"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function TimelineStep({ icon, title, done, children }: {
  icon: string; title: string; done: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`flex gap-4 pb-6 relative ${done ? "" : "opacity-40"}`}>
      <div className="flex flex-col items-center">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${done ? "bg-indigo-600 text-white shadow-md" : "bg-gray-100 text-gray-400"}`}>
          {icon}
        </div>
        <div className="w-0.5 bg-gray-200 flex-1 mt-2" />
      </div>
      <div className="flex-1 pb-4">
        <h3 className={`font-semibold mb-2 ${done ? "text-gray-800" : "text-gray-400"}`}>{title}</h3>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm text-gray-600">{children}</div>
      </div>
    </div>
  );
}

function AssignmentSection({ assignment, candidate }: { assignment: Assignment; candidate: Candidate }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      {assignment.assignment_title && (
        <div className="flex justify-between mb-2">
          <span className="text-gray-500">Title</span>
          <span className="font-semibold text-gray-800">{assignment.assignment_title}</span>
        </div>
      )}
      <div className="flex justify-between mb-2">
        <span className="text-gray-500">Status</span>
        <span className="font-semibold text-gray-800 capitalize">{assignment.status}</span>
      </div>
      {assignment.submitted_github && (
        <div className="flex justify-between mb-2">
          <span className="text-gray-500">GitHub</span>
          <a href={assignment.submitted_github} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-medium">View Repo</a>
        </div>
      )}
      {assignment.submitted_at && (
        <div className="flex justify-between mb-2">
          <span className="text-gray-500">Submitted At</span>
          <span className="font-semibold text-gray-800">
            {new Date(assignment.submitted_at).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })}
          </span>
        </div>
      )}
      {assignment.review_score !== null && (
        <div className="flex justify-between mb-2">
          <span className="text-gray-500">Score</span>
          <span className="font-semibold text-gray-800">{assignment.review_score} / 100</span>
        </div>
      )}
      {assignment.explanation && (
        <div className="mt-2">
          <span className="text-gray-500 text-xs">Feedback</span>
          <p className="text-gray-700 mt-1">{assignment.explanation}</p>
        </div>
      )}
      <PdfButton path={candidate.assignment_pdf_path} label="View Assignment PDF" />
      {assignment.assignment_text && (
        <div className="mt-3">
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium transition">
            {expanded ? "▲ Hide Assignment" : "▼ View Full Assignment"}
          </button>
          {expanded && (
            <div className="mt-3 bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed">
              {assignment.assignment_text}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function CandidateProfile({ candidate, assignment, onBack }: {
  candidate: Candidate; assignment: Assignment | null; onBack: () => void;
}) {
  const skills = typeof candidate.skills === "string"
    ? candidate.skills.replace(/[\[\]"]/g, "").split(",").map((s) => s.trim())
    : candidate.skills || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-indigo-900 text-white px-6 py-4 flex items-center gap-4">
        <button onClick={onBack} className="flex items-center gap-2 text-indigo-200 hover:text-white transition text-sm font-medium">
          ← Back
        </button>
        <div className="h-4 w-px bg-indigo-600" />
        <span className="text-sm font-medium text-indigo-200">Candidate Profile</span>
      </div>

      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-600">
                {candidate.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">{candidate.name}</h1>
                <p className="text-gray-500 text-sm mt-0.5">{candidate.email}</p>
                {candidate.phone && <p className="text-gray-400 text-sm">{candidate.phone}</p>}
              </div>
            </div>
            <StatusBadge status={candidate.status} />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-indigo-600">{candidate.score}</p>
              <p className="text-xs text-gray-500 mt-0.5">CV Score</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-indigo-600">{candidate.interview_score ?? "—"}</p>
              <p className="text-xs text-gray-500 mt-0.5">Interview Score</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-indigo-600">{candidate.experience && candidate.experience !== "0" ? candidate.experience : "—"}</p>
              <p className="text-xs text-gray-500 mt-0.5">Experience</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400 text-xs">Education</span>
              <p className="text-gray-800 font-medium mt-0.5">{candidate.education || "—"}</p>
            </div>
            <div>
              <span className="text-gray-400 text-xs">Applied On</span>
              <p className="text-gray-800 font-medium mt-0.5">
                {new Date(candidate.created_at).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })}
              </p>
            </div>
          </div>

          {skills.length > 0 && (
            <div className="mt-4">
              <span className="text-gray-400 text-xs">Skills</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {skills.map((skill, i) => (
                  <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium border border-indigo-100">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-bold text-gray-800 mb-6 text-lg">Application Journey</h2>

          <TimelineStep icon="📄" title="CV Submitted" done={true}>
            <div className="flex justify-between"><span>CV Score</span><span className="font-semibold text-gray-800">{candidate.score} / 100</span></div>
            <div className="flex justify-between mt-1"><span>Applied On</span>
              <span className="font-semibold text-gray-800">{new Date(candidate.created_at).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })}</span>
            </div>
            <PdfButton path={candidate.cv_path} label="View CV" />
          </TimelineStep>

          <TimelineStep icon="🎯" title="Interview" done={candidate.interview_score !== null}>
            {candidate.interview_score !== null ? (
              <div className="flex justify-between"><span>Score</span><span className="font-semibold text-gray-800">{candidate.interview_score} / 100</span></div>
            ) : <span className="text-gray-400">Interview not yet completed</span>}
          </TimelineStep>

          <TimelineStep icon="📝" title="Technical Assignment" done={assignment !== null}>
            {assignment ? <AssignmentSection assignment={assignment} candidate={candidate} /> : <span className="text-gray-400">Assignment not yet sent</span>}
          </TimelineStep>

          <TimelineStep icon="📅" title="Final Interview Scheduled" done={candidate.cal_booking_status === "booked"}>
            {candidate.cal_booking_status === "booked" ? (
              <>
                <div className="flex justify-between mb-1"><span>Date</span>
                  <span className="font-semibold text-gray-800">
                    {candidate.cal_booking_date ? new Date(candidate.cal_booking_date).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" }) : "—"}
                  </span>
                </div>
                <div className="flex justify-between"><span>Time</span><span className="font-semibold text-gray-800">{candidate.cal_booking_time || "—"}</span></div>
              </>
            ) : candidate.cal_booking_status === "pending" ? (
              <span className="text-amber-600">Link sent — awaiting booking</span>
            ) : <span className="text-gray-400">Not yet scheduled</span>}
          </TimelineStep>

          <div className="flex gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${candidate.status === "selected" ? "bg-emerald-500 text-white" : candidate.status === "rejected" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-400"}`}>
              {candidate.status === "selected" ? "✅" : candidate.status === "rejected" ? "❌" : "🏁"}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-800 mb-2">Final Decision</h3>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                <StatusBadge status={candidate.status} />
                <PdfButton path={candidate.evaluation_pdf_path} label="View Evaluation Report" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  // ✅ Sab hooks yahan - component ke andar
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

  // ✅ handleLogin bhi component ke andar
  const handleLogin = async () => {
    setLoginError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setLoginError("Invalid email or password");
      return;
    }
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .single();

    if (!roleData) {
      setLoginError("Access denied — no role assigned");
      return;
    }
    setUserRole(roleData.role);
    setAuthenticated(true);
  };

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
    { stage: "CV Received", count: candidates.length },
    { stage: "Interview", count: candidates.filter(c => c.interview_score !== null).length },
    { stage: "Assignment", count: assignments.length },
    { stage: "Selected", count: candidates.filter(c => c.status === "selected").length },
    { stage: "Rejected", count: candidates.filter(c => c.status === "rejected").length },
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

  // ✅ Login Screen
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-indigo-950 flex items-center justify-center p-6">
        <div className="bg-white shadow-2xl rounded-2xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">🔐</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Recruitment Tracker</h1>
            <p className="text-gray-500 text-sm mt-1">Sign in to access the dashboard</p>
          </div>
          {loginError && (
            <p className="text-red-500 text-sm text-center mb-4">{loginError}</p>
          )}
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 mb-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 mb-4 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleLogin}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 font-semibold transition"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="min-h-screen flex justify-center items-center text-gray-600">Loading...</div>;

  if (selectedCandidate) {
    return <CandidateProfile candidate={selectedCandidate} assignment={getAssignment(selectedCandidate.id)} onBack={() => setSelectedCandidate(null)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-indigo-900 text-white px-6 py-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 py-4">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-sm font-bold">RT</div>
            <div>
              <p className="text-xs text-indigo-300 uppercase tracking-wider">Recruitment Tracker</p>
              <p className="text-sm font-semibold">{activeTab === "dashboard" ? "Dashboard" : "Candidates"}</p>
            </div>
          </div>
          <nav className="flex items-center gap-4">
            {[
              { key: "dashboard", label: "Dashboard" },
              { key: "candidates", label: "Candidates" },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as "dashboard" | "candidates")}
                className={`px-6 py-5 text-sm font-semibold border-b-2 transition ${activeTab === tab.key ? "border-white text-white" : "border-transparent text-indigo-300 hover:text-white"}`}
              >
                {tab.label}
              </button>
            ))}
            {/* Role badge + Logout */}
            <span className="text-xs bg-indigo-700 text-indigo-200 px-3 py-1 rounded-full capitalize">{userRole}</span>
            <button
              onClick={async () => { await supabase.auth.signOut(); setAuthenticated(false); setUserRole(null); }}
              className="text-xs text-indigo-300 hover:text-white transition ml-2"
            >
              Logout
            </button>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {activeTab === "dashboard" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Total Candidates", value: candidates.length, icon: "👥" },
                { label: "Average Score", value: avgScore, icon: "📊" },
                { label: "Selected", value: candidates.filter(c => c.status === "selected").length, icon: "✅" },
                { label: "Rejected", value: candidates.filter(c => c.status === "rejected").length, icon: "❌" },
              ].map((stat, i) => (
                <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">{stat.label}</span>
                    <span className="text-xl">{stat.icon}</span>
                  </div>
                  <p className="text-3xl font-bold text-gray-800">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="font-bold text-gray-800 mb-4">Recruitment Pipeline</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={pipelineData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="stage" width={90} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#4F46E5" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="font-bold text-gray-800 mb-4">Final Decision</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" outerRadius={90} innerRadius={50} label={({ name, value }) => value > 0 ? `${name}: ${value}` : ""} labelLine={false}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="font-bold text-gray-800 mb-4">Applications by Month</h2>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={candidatesPerMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#4F46E5" strokeWidth={3} dot={{ fill: "#4F46E5", r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {activeTab === "candidates" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
              <h2 className="font-bold text-gray-800 text-lg">All Candidates</h2>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "all", label: "All" },
                    { key: "applied", label: "Applied" },
                    { key: "selected", label: "Selected" },
                    { key: "rejected", label: "Rejected" },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setStatusFilter(tab.key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${statusFilter === tab.key ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                    >
                      {tab.label} ({statusCounts[tab.key] || 0})
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Search name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-400 w-full md:w-56 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="text-left p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Applied On</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCandidates.length === 0 ? (
                    <tr><td colSpan={2} className="p-8 text-center text-gray-400">No candidates found.</td></tr>
                  ) : (
                    paginatedCandidates.map(candidate => (
                      <tr
                        key={candidate.id}
                        onClick={() => setSelectedCandidate(candidate)}
                        className="border-b border-gray-50 hover:bg-indigo-50 cursor-pointer transition"
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-600">
                              {candidate.name.charAt(0)}
                            </div>
                            <span className="text-indigo-600 font-medium hover:underline">{candidate.name}</span>
                          </div>
                        </td>
                        <td className="p-3 text-gray-400 text-sm">
                          {new Date(candidate.created_at).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filteredCandidates.length > ROWS_PER_PAGE && (
              <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                <span>Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}–{Math.min(currentPage * ROWS_PER_PAGE, filteredCandidates.length)} of {filteredCandidates.length}</span>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 rounded-lg border disabled:opacity-40 hover:bg-gray-50 transition">Previous</button>
                  <span className="px-3 py-1.5">Page {currentPage} of {totalPages}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 rounded-lg border disabled:opacity-40 hover:bg-gray-50 transition">Next</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
