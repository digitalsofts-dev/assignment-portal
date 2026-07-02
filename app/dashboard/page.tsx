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

const COLORS = ["#10B981", "#EF4444"];
const ROWS_PER_PAGE = 10;

type Candidate = {
  id: string;
  name: string;
  email: string;
  phone: string;
  skills: string | string[];
  experience: number;
  education: string;
  score: number;
  status: string;
  created_at: string;
  interview_score: number | null;
  cal_booking_date: string | null;
  cal_booking_time: string | null;
  cal_booking_status: string | null;
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
};

function getStageFromCandidate(candidate: Candidate, assignment: Assignment | null) {
  if (candidate.status === "rejected") return "rejected";
  if (candidate.status === "selected") return "selected";
  if (candidate.cal_booking_status === "booked") return "cal_booked";
  if (assignment?.review_score !== null && assignment?.review_score !== undefined) return "assignment_reviewed";
  if (assignment?.submitted_github) return "assignment_submitted";
  if (assignment) return "assignment_sent";
  if (candidate.interview_score !== null) return "interview_done";
  if (candidate.score !== null) return "cv_reviewed";
  return "applied";
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    selected: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    applied: "bg-yellow-100 text-yellow-700",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${map[status] || "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

function TimelineStep({
  icon, title, done, children
}: { icon: string; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex gap-4 pb-6 relative ${done ? "" : "opacity-50"}`}>
      <div className="flex flex-col items-center">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${done ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>
          {icon}
        </div>
        <div className="w-0.5 bg-gray-200 flex-1 mt-2" />
      </div>
      <div className="flex-1 pb-4">
        <h3 className="font-semibold text-gray-800 mb-2">{title}</h3>
        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">{children}</div>
      </div>
    </div>
  );
}

function CandidateProfile({
  candidate,
  assignment,
  onBack,
}: {
  candidate: Candidate;
  assignment: Assignment | null;
  onBack: () => void;
}) {
  const stage = getStageFromCandidate(candidate, assignment);

  const skills = typeof candidate.skills === "string"
    ? candidate.skills.replace(/[\[\]"]/g, "").split(",").map((s) => s.trim())
    : candidate.skills || [];

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
        >
          ← Back to Dashboard
        </button>

        {/* Header */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{candidate.name}</h1>
              <p className="text-gray-500 mt-1">{candidate.email}</p>
              {candidate.phone && <p className="text-gray-500">{candidate.phone}</p>}
            </div>
            <StatusBadge status={candidate.status} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Education</span>
              <p className="text-gray-800 font-medium">{candidate.education || "—"}</p>
            </div>
            <div>
              <span className="text-gray-400">Experience</span>
              <p className="text-gray-800 font-medium">{candidate.experience ? `${candidate.experience} years` : "—"}</p>
            </div>
          </div>

          {skills.length > 0 && (
            <div className="mt-4">
              <span className="text-gray-400 text-sm">Skills</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {skills.map((skill, i) => (
                  <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-gray-800 mb-6 text-lg">Application Journey</h2>

          {/* Step 1 - CV */}
          <TimelineStep icon="📄" title="CV Submitted" done={true}>
            <div className="flex justify-between">
              <span>CV Score</span>
              <span className="font-semibold text-gray-800">{candidate.score ?? "—"} / 100</span>
            </div>
            <div className="flex justify-between mt-1">
              <span>Applied On</span>
              <span className="font-semibold text-gray-800">
                {new Date(candidate.created_at).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })}
              </span>
            </div>
          </TimelineStep>

          {/* Step 2 - Interview */}
          <TimelineStep
            icon="🎯"
            title="Interview"
            done={candidate.interview_score !== null}
          >
            {candidate.interview_score !== null ? (
              <div className="flex justify-between">
                <span>Interview Score</span>
                <span className="font-semibold text-gray-800">{candidate.interview_score} / 100</span>
              </div>
            ) : (
              <span className="text-gray-400">Interview not yet completed</span>
            )}
          </TimelineStep>

          {/* Step 3 - Assignment */}
          <TimelineStep
            icon="📝"
            title="Technical Assignment"
            done={assignment !== null}
          >
            {assignment ? (
              <>
                {assignment.assignment_title && (
                  <div className="flex justify-between mb-1">
                    <span>Title</span>
                    <span className="font-semibold text-gray-800">{assignment.assignment_title}</span>
                  </div>
                )}
                <div className="flex justify-between mb-1">
                  <span>Status</span>
                  <span className="font-semibold text-gray-800 capitalize">{assignment.status}</span>
                </div>
                {assignment.submitted_github && (
                  <div className="flex justify-between mb-1">
                    <span>GitHub</span>
                    <a href={assignment.submitted_github} target="_blank" rel="noreferrer"
                      className="text-blue-600 hover:underline font-medium">
                      View Repo
                    </a>
                  </div>
                )}
                {assignment.submitted_at && (
                  <div className="flex justify-between mb-1">
                    <span>Submitted At</span>
                    <span className="font-semibold text-gray-800">
                      {new Date(assignment.submitted_at).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })}
                    </span>
                  </div>
                )}
                {assignment.review_score !== null && (
                  <div className="flex justify-between mb-1">
                    <span>Assignment Score</span>
                    <span className="font-semibold text-gray-800">{assignment.review_score} / 100</span>
                  </div>
                )}
                {assignment.explanation && (
                  <div className="mt-2">
                    <span className="text-gray-400">Feedback</span>
                    <p className="text-gray-700 mt-1">{assignment.explanation}</p>
                  </div>
                )}
              </>
            ) : (
              <span className="text-gray-400">Assignment not yet sent</span>
            )}
          </TimelineStep>

          {/* Step 4 - Cal Booking */}
          <TimelineStep
            icon="📅"
            title="Final Interview Scheduled"
            done={candidate.cal_booking_status === "booked"}
          >
            {candidate.cal_booking_status === "booked" ? (
              <>
                <div className="flex justify-between mb-1">
                  <span>Date</span>
                  <span className="font-semibold text-gray-800">
                    {candidate.cal_booking_date
                      ? new Date(candidate.cal_booking_date).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Time</span>
                  <span className="font-semibold text-gray-800">{candidate.cal_booking_time || "—"}</span>
                </div>
              </>
            ) : candidate.cal_booking_status === "pending" ? (
              <span className="text-yellow-600">Link sent — awaiting booking</span>
            ) : (
              <span className="text-gray-400">Not yet scheduled</span>
            )}
          </TimelineStep>

          {/* Step 5 - Final Status */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                candidate.status === "selected" ? "bg-green-500 text-white" :
                candidate.status === "rejected" ? "bg-red-500 text-white" :
                "bg-gray-200 text-gray-400"
              }`}>
                {candidate.status === "selected" ? "✅" : candidate.status === "rejected" ? "❌" : "🏁"}
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-800 mb-2">Final Decision</h3>
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <StatusBadge status={candidate.status} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const handleLogin = () => {
    if (password === "admin123") {
      setAuthenticated(true);
    } else {
      alert("Invalid password");
    }
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

  const getAssignmentForCandidate = (candidateId: string) =>
    assignments.find((a) => a.candidate_id === candidateId) || null;

  const totalCandidates = candidates.length;

  const averageScore = useMemo(() => {
    if (!candidates.length) return 0;
    const total = candidates.reduce((sum, item) => sum + (item.score || 0), 0);
    return (total / candidates.length).toFixed(1);
  }, [candidates]);

  const pieData = useMemo(() => {
    const selected = candidates.filter((c) => c.status?.toLowerCase() === "selected").length;
    const rejected = candidates.filter((c) => c.status?.toLowerCase() === "rejected").length;
    return [
      { name: "Selected", value: selected },
      { name: "Rejected", value: rejected },
    ];
  }, [candidates]);

  const skillsData = useMemo(() => {
    const map: Record<string, number> = {};
    candidates.forEach((candidate) => {
      const skills = typeof candidate.skills === "string"
        ? candidate.skills.replace(/[\[\]"]/g, "").split(",").map((s) => s.trim())
        : candidate.skills || [];
      skills.forEach((skill) => {
        if (skill) map[skill] = (map[skill] || 0) + 1;
      });
    });
    return Object.entries(map)
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [candidates]);

  const candidatesPerDay = useMemo(() => {
    const map: Record<string, number> = {};
    candidates.forEach((candidate) => {
      const day = new Date(candidate.created_at).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" });
      map[day] = (map[day] || 0) + 1;
    });
    return Object.entries(map).map(([date, count]) => ({ date, count }));
  }, [candidates]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: candidates.length };
    candidates.forEach((c) => {
      const status = c.status?.toLowerCase() || "unknown";
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    let result = candidates;
    if (statusFilter !== "all") {
      result = result.filter((c) => c.status?.toLowerCase() === statusFilter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter(
        (c) => c.name?.toLowerCase().includes(term) || c.email?.toLowerCase().includes(term)
      );
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

  const statusTabs = [
    { key: "all", label: "All" },
    { key: "applied", label: "Applied" },
    { key: "selected", label: "Selected" },
    { key: "rejected", label: "Rejected" },
  ];

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white shadow-xl rounded-xl p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Hiring Dashboard</h1>
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full border rounded-lg px-4 py-3 mb-4 text-gray-800"
          />
          <button onClick={handleLogin} className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700">
            Login
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="min-h-screen flex justify-center items-center text-gray-700">Loading dashboard...</div>;
  }

  if (selectedCandidate) {
    return (
      <CandidateProfile
        candidate={selectedCandidate}
        assignment={getAssignmentForCandidate(selectedCandidate.id)}
        onBack={() => setSelectedCandidate(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">Hiring Analytics Dashboard</h1>

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-gray-500 text-sm">Total Candidates</h3>
            <p className="text-4xl font-bold mt-2 text-gray-800">{totalCandidates}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-gray-500 text-sm">Average Score</h3>
            <p className="text-4xl font-bold mt-2 text-gray-800">{averageScore}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="font-semibold mb-4 text-gray-800">Selected vs Rejected</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} dataKey="value" outerRadius={100} label>
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="font-semibold mb-4 text-gray-800">Skills Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={skillsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="skill" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6 mb-8">
          <h2 className="font-semibold mb-4 text-gray-800">Candidates Per Day</h2>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={candidatesPerDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" strokeWidth={3} stroke="#3B82F6" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex flex-col gap-4 mb-4 md:flex-row md:items-center md:justify-between">
            <h2 className="font-semibold text-gray-800">All Candidates</h2>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex flex-wrap gap-2">
                {statusTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                      statusFilter === tab.key
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                    }`}
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
                className="border rounded-lg px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 w-full md:w-64"
              />
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
                className="border rounded-lg px-3 py-1.5 text-sm text-gray-800 bg-white"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 text-gray-600">Name</th>
                  <th className="text-left p-3 text-gray-600">Applied On</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="p-6 text-center text-gray-400">No candidates found.</td>
                  </tr>
                ) : (
                  paginatedCandidates.map((candidate) => (
                    <tr
                      key={candidate.id}
                      className="border-b hover:bg-blue-50 cursor-pointer transition"
                      onClick={() => setSelectedCandidate(candidate)}
                    >
                      <td className="p-3 text-blue-600 font-medium hover:underline">{candidate.name}</td>
                      <td className="p-3 text-gray-500 text-sm">
                        {new Date(candidate.created_at).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredCandidates.length > ROWS_PER_PAGE && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
              <span>
                Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}-
                {Math.min(currentPage * ROWS_PER_PAGE, filteredCandidates.length)} of{" "}
                {filteredCandidates.length}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="px-3 py-1.5">Page {currentPage} of {totalPages}</span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
