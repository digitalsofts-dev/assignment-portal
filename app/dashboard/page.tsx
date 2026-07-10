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
      className="inline-flex items-center gap-2 px-4 py-2 rounded-sm bg-[#1a1a1a] hover:bg-[#2d2d2d] text-[#d4d4d4] text-xs font-mono transition-all border border-[#2d2d2d]"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    selected:          { bg: "bg-[#00ff9d]/10", text: "text-[#00ff9d]", border: "border-[#00ff9d]/30" },
    rejected:          { bg: "bg-[#ff0040]/10", text: "text-[#ff0040]", border: "border-[#ff0040]/30" },
    applied:           { bg: "bg-[#ffb000]/10", text: "text-[#ffb000]", border: "border-[#ffb000]/30" },
    "interview rejected": { bg: "bg-[#ff6b35]/10", text: "text-[#ff6b35]", border: "border-[#ff6b35]/30" },
  };
  const s = map[status?.toLowerCase()] || { bg: "bg-[#2d2d2d]", text: "text-[#d4d4d4]", border: "border-[#2d2d2d]" };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-sm text-xs font-mono border ${s.bg} ${s.text} ${s.border}`}>
      {s.text.charAt(0).toUpperCase() + s.text.slice(1)}
    </span>
  );
}

function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 70 ? "#00ff9d" : score >= 50 ? "#ffb000" : "#ff0040";
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#2d2d2d" strokeWidth="3" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3"
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
        <div className={`w-9 h-9 rounded-sm flex items-center justify-center text-sm flex-shrink-0 transition-all font-mono
          ${done ? "bg-[#00ff9d] text-[#0a0a0a]" : "bg-[#2d2d2d] text-[#666]"}`}>
          {icon}
        </div>
        {!last && <div className={`w-px flex-1 mt-2 mb-2 ${done ? "bg-[#00ff9d]/30" : "bg-[#2d2d2d]"}`} />}
      </div>
      <div className={`flex-1 pb-6 ${last ? "" : ""}`}>
        <p className={`text-sm font-mono mb-2 ${done ? "text-[#d4d4d4]" : "text-[#666]"}`}>{title}</p>
        <div className={`rounded-sm p-4 text-sm ${done ? "bg-[#1a1a1a] border border-[#2d2d2d]" : "bg-[#0f0f0f] border border-[#1a1a1a]"}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

function AssignmentSection({ assignment, candidate }: { assignment: Assignment; candidate: Candidate }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="space-y-2 font-mono text-xs">
      {assignment.assignment_title && (
        <div className="flex justify-between border-b border-[#1a1a1a] pb-2">
          <span className="text-[#666]">TITLE</span>
          <span className="font-medium text-[#d4d4d4]">{assignment.assignment_title}</span>
        </div>
      )}
      <div className="flex justify-between border-b border-[#1a1a1a] pb-2">
        <span className="text-[#666]">STATUS</span>
        <span className="font-medium text-[#d4d4d4] capitalize">{assignment.status}</span>
      </div>
      {assignment.submitted_github && (
        <div className="flex justify-between items-center border-b border-[#1a1a1a] pb-2">
          <span className="text-[#666]">GITHUB</span>
          <a href={assignment.submitted_github} target="_blank" rel="noreferrer"
            className="text-[#00ff9d] hover:text-[#66ffb8] font-medium text-xs transition-colors">
            View Repo →
          </a>
        </div>
      )}
      {assignment.submitted_at && (
        <div className="flex justify-between border-b border-[#1a1a1a] pb-2">
          <span className="text-[#666]">SUBMITTED</span>
          <span className="font-medium text-[#d4d4d4]">
            {new Date(assignment.submitted_at).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })}
          </span>
        </div>
      )}
      {assignment.review_score !== null && (
        <div className="flex justify-between border-b border-[#1a1a1a] pb-2">
          <span className="text-[#666]">SCORE</span>
          <span className="font-semibold text-[#00ff9d]">{assignment.review_score}/100</span>
        </div>
      )}
      {assignment.explanation && (
        <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <p className="text-[#666] text-[10px] mb-1">FEEDBACK</p>
          <p className="text-[#d4d4d4] text-xs leading-relaxed">{assignment.explanation}</p>
        </div>
      )}
      <div className="flex gap-2 mt-2 flex-wrap">
        <PdfButton path={candidate.assignment_pdf_path} label="Assignment PDF" />
      </div>
      {assignment.assignment_text && (
        <div className="mt-2">
          <button onClick={() => setExpanded(!expanded)}
            className="text-[#00ff9d] hover:text-[#66ffb8] text-[10px] font-mono flex items-center gap-1 transition-colors">
            {expanded ? "▲ HIDE" : "▼ VIEW FULL"}
          </button>
          {expanded && (
            <div className="mt-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-sm p-3 text-[10px] text-[#d4d4d4] whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed font-mono">
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
    <div className="min-h-screen bg-[#0a0a0a] text-[#d4d4d4]">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[#1a1a1a] border border-[#00ff9d]/30 text-[#00ff9d] px-5 py-3 rounded-sm text-sm font-mono shadow-2xl animate-in slide-in-from-top-2">
          ✓ {toast}
        </div>
      )}

      <div className="bg-[#0f0f0f] border-b border-[#1a1a1a] px-8 py-4 flex items-center gap-3 sticky top-0 z-40">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-[#666] hover:text-[#d4d4d4] transition text-sm font-mono">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15,18 9,12 15,6"/></svg>
          BACK
        </button>
        <span className="text-[#2d2d2d]">/</span>
        <span className="text-sm text-[#d4d4d4] font-mono">{candidate.name}</span>
        <div className="ml-auto">
          <StatusBadge status={candidate.status} />
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-8 space-y-6">
        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-sm overflow-hidden">
          <div className="h-1 bg-[#00ff9d]" />
          <div className="p-8">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-sm bg-[#1a1a1a] flex items-center justify-center text-[#00ff9d] text-xl font-mono border border-[#2d2d2d]">
                  {candidate.name.charAt(0)}
                </div>
                <div>
                  <h1 className="text-xl font-mono text-[#d4d4d4]">{candidate.name}</h1>
                  <p className="text-[#666] text-sm font-mono">{candidate.email}</p>
                  {candidate.phone && <p className="text-[#444] text-xs font-mono mt-0.5">{candidate.phone}</p>}
                </div>
              </div>

              {!candidate.manual_override ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[#444] text-[10px] font-mono mr-1">HR DECISION:</span>
                  <button
                    onClick={() => updateStatus("selected")}
                    disabled={updating || candidate.status === "selected"}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-sm bg-[#00ff9d] hover:bg-[#00dd8a] text-[#0a0a0a] text-xs font-mono font-bold transition disabled:opacity-40"
                  >
                    ✓ SELECT
                  </button>
                  <button
                    onClick={() => updateStatus("rejected")}
                    disabled={updating || candidate.status === "rejected"}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-sm bg-[#ff0040] hover:bg-[#dd0038] text-[#0a0a0a] text-xs font-mono font-bold transition disabled:opacity-40"
                  >
                    ✕ REJECT
                  </button>
                  <button
                    onClick={() => updateStatus("applied")}
                    disabled={updating || candidate.status === "applied"}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-sm bg-[#2d2d2d] hover:bg-[#3d3d3d] text-[#666] text-xs font-mono transition disabled:opacity-40"
                  >
                    ↩ RESET
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[#ffb000] text-[10px] font-mono border border-[#ffb000]/30 bg-[#ffb000]/5 px-3 py-1.5 rounded-sm">
                    ● MANUAL OVERRIDE
                  </span>
                  <button
                    onClick={() => updateStatus("applied")}
                    disabled={updating}
                    className="text-[#444] hover:text-[#666] text-[10px] font-mono underline transition-colors"
                  >
                    UNDO
                  </button>
                </div>
              )}
            </div>

            <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                { label: "CV SCORE", value: candidate.score, show: true },
                { label: "INTERVIEW", value: candidate.interview_score, show: true },
                { label: "EXPERIENCE", value: candidate.experience && candidate.experience !== "0" ? candidate.experience : null, show: true, isText: true },
              ].map((item, i) => (
                <div key={i} className="bg-[#0a0a0a] rounded-sm p-5 text-center border border-[#1a1a1a]">
                  {item.isText ? (
                    <p className="text-2xl font-mono text-[#d4d4d4]">{item.value ?? "—"}</p>
                  ) : (
                    <div className="flex flex-col items-center">
                      {item.value !== null && item.value !== undefined ? (
                        <div className="relative">
                          <ScoreRing score={item.value as number} />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-sm font-mono font-bold text-[#d4d4d4]">{item.value}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-2xl font-mono text-[#333] py-3">—</p>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] font-mono text-[#444] mt-2 tracking-wider">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div className="bg-[#0a0a0a] rounded-sm p-4 border border-[#1a1a1a]">
                <p className="text-[#444] text-[10px] font-mono mb-1 tracking-wider">EDUCATION</p>
                <p className="text-[#d4d4d4] font-mono text-sm leading-snug">{candidate.education || "—"}</p>
              </div>
              <div className="bg-[#0a0a0a] rounded-sm p-4 border border-[#1a1a1a]">
                <p className="text-[#444] text-[10px] font-mono mb-1 tracking-wider">APPLIED ON</p>
                <p className="text-[#d4d4d4] font-mono">
                  {new Date(candidate.created_at).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
            </div>

            {skills.length > 0 && (
              <div className="mt-4">
                <p className="text-[#444] text-[10px] font-mono mb-2 tracking-wider">SKILLS</p>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((skill, i) => (
                    <span key={i} className="px-2.5 py-1 bg-[#1a1a1a] text-[#00ff9d] rounded-sm text-[10px] font-mono border border-[#00ff9d]/20">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <PdfButton path={candidate.cv_path} label="View CV" />
              <PdfButton path={candidate.evaluation_pdf_path} label="Evaluation Report" />
            </div>
          </div>
        </div>

        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-sm p-8">
          <h2 className="font-mono text-[#d4d4d4] text-sm mb-6 flex items-center gap-2 border-b border-[#1a1a1a] pb-4">
            <span className="text-[#00ff9d]">▶</span>
            APPLICATION JOURNEY
          </h2>

          <TimelineStep icon="📄" title="CV SUBMITTED" done={true}>
            <div className="flex justify-between text-[#666] font-mono text-xs">
              <span>CV Score</span>
              <span className="font-semibold text-[#d4d4d4]">{candidate.score}/100</span>
            </div>
            <div className="flex justify-between text-[#666] font-mono text-xs mt-1">
              <span>Applied</span>
              <span className="font-medium text-[#d4d4d4]">
                {new Date(candidate.created_at).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })}
              </span>
            </div>
          </TimelineStep>

          <TimelineStep icon="🎯" title="AI INTERVIEW" done={candidate.interview_score !== null}>
            {candidate.interview_score !== null ? (
              <div className="flex justify-between text-[#666] font-mono text-xs">
                <span>Score</span>
                <span className="font-semibold text-[#d4d4d4]">{candidate.interview_score}/100</span>
              </div>
            ) : <span className="text-[#444] text-xs font-mono">Interview not yet completed</span>}
          </TimelineStep>

          <TimelineStep icon="💻" title="TECHNICAL ASSIGNMENT" done={assignment !== null}>
            {assignment
              ? <AssignmentSection assignment={assignment} candidate={candidate} />
              : <span className="text-[#444] text-xs font-mono">Assignment not yet sent</span>
            }
          </TimelineStep>

          <TimelineStep icon="📅" title="FINAL INTERVIEW" done={candidate.cal_booking_status === "booked"} last={true}>
            {candidate.cal_booking_status === "booked" ? (
              <div className="space-y-1 text-[#666] font-mono text-xs">
                <div className="flex justify-between border-b border-[#1a1a1a] pb-1">
                  <span>Date</span>
                  <span className="font-medium text-[#d4d4d4]">
                    {candidate.cal_booking_date
                      ? new Date(candidate.cal_booking_date).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", day: "numeric", month: "long" })
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Time</span>
                  <span className="font-medium text-[#d4d4d4]">{candidate.cal_booking_time || "—"}</span>
                </div>
              </div>
            ) : candidate.cal_booking_status === "pending" ? (
              <span className="text-[#ffb000] text-xs font-mono">Link sent — awaiting booking</span>
            ) : (
              <span className="text-[#444] text-xs font-mono">Not yet scheduled</span>
            )}
          </TimelineStep>
        </div>

        <div className={`rounded-sm border p-5 flex items-center justify-between font-mono
          ${candidate.status === "selected" ? "bg-[#00ff9d]/5 border-[#00ff9d]/30" :
            candidate.status === "rejected" ? "bg-[#ff0040]/5 border-[#ff0040]/30" :
            "bg-[#0f0f0f] border-[#1a1a1a]"}`}>
          <div>
            <p className="text-[10px] font-mono text-[#444] tracking-wider mb-1">FINAL DECISION</p>
            <StatusBadge status={candidate.status} />
          </div>
          {candidate.manual_override && (
            <span className="text-[10px] text-[#444] font-mono">Set manually by HR</span>
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

  const PIE_COLORS = ["#00ff9d", "#ff0040", "#ffb000"];

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

  if (!authenticated && !loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 border border-[#00ff9d]/30 bg-[#0f0f0f] rounded-sm flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00ff9d" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="0"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h1 className="text-2xl font-mono text-[#d4d4d4] tracking-tight">RECRUITMENT TRACKER</h1>
            <p className="text-[#444] text-sm font-mono mt-1">Sign in to manage your pipeline</p>
          </div>
          <div className="border border-[#1a1a1a] bg-[#0f0f0f] rounded-sm p-8">
            {loginError && (
              <div className="mb-4 px-4 py-3 bg-[#ff0040]/10 border border-[#ff0040]/30 rounded-sm text-[#ff0040] text-sm font-mono text-center">
                {loginError}
              </div>
            )}
            <div className="space-y-3">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-sm px-4 py-3 text-[#d4d4d4] placeholder-[#444] focus:outline-none focus:border-[#00ff9d]/50 text-sm font-mono"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-sm px-4 py-3 text-[#d4d4d4] placeholder-[#444] focus:outline-none focus:border-[#00ff9d]/50 text-sm font-mono"
              />
              <button
                onClick={handleLogin}
                className="w-full bg-[#00ff9d] hover:bg-[#00dd8a] text-[#0a0a0a] py-3 rounded-sm font-mono font-bold text-sm transition-all mt-1"
              >
                SIGN IN
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#0a0a0a] gap-3">
      <div className="w-8 h-8 border-2 border-[#00ff9d] border-t-transparent rounded-full animate-spin" />
      <p className="text-[#444] text-sm font-mono">Loading pipeline...</p>
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
    <div className="min-h-screen bg-[#0a0a0a] text-[#d4d4d4]">
      <div className="flex">
        <div className="w-56 min-h-screen bg-[#0f0f0f] border-r border-[#1a1a1a] fixed left-0 top-0 flex flex-col">
          <div className="p-5 border-b border-[#1a1a1a]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 border border-[#00ff9d]/30 bg-[#0a0a0a] rounded-sm flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00ff9d" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div>
                <p className="text-xs font-mono font-bold text-[#d4d4d4] tracking-wider">RT</p>
                <p className="text-[10px] font-mono text-[#444] uppercase">{userRole}</p>
              </div>
            </div>
          </div>

          <nav className="p-3 flex-1">
            {[
              { key: "dashboard", label: "OVERVIEW", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
              { key: "candidates", label: "CANDIDATES", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as "dashboard" | "candidates")}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-sm text-sm font-mono transition-all mb-1
                  ${activeTab === tab.key
                    ? "bg-[#00ff9d]/10 text-[#00ff9d] border border-[#00ff9d]/30"
                    : "text-[#444] hover:bg-[#1a1a1a] hover:text-[#d4d4d4]"}`}
              >
                <span className={activeTab === tab.key ? "text-[#00ff9d]" : ""}>{tab.icon}</span>
                {tab.label}
                {tab.key === "candidates" && (
                  <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-sm font-mono
                    ${activeTab === tab.key ? "bg-[#00ff9d] text-[#0a0a0a]" : "bg-[#1a1a1a] text-[#666]"}`}>
                    {candidates.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="p-3 border-t border-[#1a1a1a]">
            <button
              onClick={async () => { await supabase.auth.signOut(); setAuthenticated(false); setUserRole(null); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-sm text-sm font-mono text-[#444] hover:bg-[#ff0040]/10 hover:text-[#ff0040] transition-all"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              SIGN OUT
            </button>
          </div>
        </div>

        <div className="ml-56 flex-1 min-h-screen">
          <div className="bg-[#0f0f0f] border-b border-[#1a1a1a] px-8 py-4 sticky top-0 z-30">
            <h1 className="text-lg font-mono font-bold text-[#d4d4d4] tracking-tight">
              {activeTab === "dashboard" ? "PIPELINE OVERVIEW" : "ALL CANDIDATES"}
            </h1>
            <p className="text-[10px] font-mono text-[#444] mt-0.5 tracking-wider">
              {activeTab === "dashboard" ? "REAL-TIME RECRUITMENT ANALYTICS" : `${candidates.length} CANDIDATES TOTAL`}
            </p>
          </div>

          <div className="p-8">
            {activeTab === "dashboard" && (
              <>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "TOTAL APPLICANTS", value: candidates.length, sub: "All time", icon: "👥" },
                    { label: "AVG CV SCORE", value: avgScore, sub: "Out of 100", icon: "📊" },
                    { label: "SELECTED", value: candidates.filter(c => c.status === "selected").length, sub: `${conversionRate}% conversion`, icon: "✅" },
                    { label: "REJECTED", value: candidates.filter(c => c.status === "rejected").length, sub: "Screened out", icon: "❌" },
                  ].map((stat, i) => (
                    <div key={i} className="bg-[#0f0f0f] border border-[#1a1a1a] p-5 rounded-sm">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xl">{stat.icon}</span>
                        <span className="text-[10px] font-mono text-[#444]">{stat.sub}</span>
                      </div>
                      <p className="text-3xl font-mono font-bold text-[#d4d4d4]">{stat.value}</p>
                      <p className="text-[10px] font-mono text-[#444] mt-1 tracking-wider">{stat.label}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-5 mb-5">
                  <div className="bg-[#0f0f0f] border border-[#1a1a1a] p-6 rounded-sm">
                    <h3 className="font-mono text-[#d4d4d4] text-sm mb-4 tracking-wider">RECRUITMENT PIPELINE</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={pipelineData} layout="vertical" barSize={20}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1a1a1a" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#444", fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="stage" width={80} tick={{ fontSize: 10, fill: "#666", fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 0, fontSize: 10, fontFamily: "monospace", color: "#d4d4d4" }} />
                        <Bar dataKey="count" fill="#00ff9d" radius={[0, 2, 2, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-[#0f0f0f] border border-[#1a1a1a] p-6 rounded-sm">
                    <h3 className="font-mono text-[#d4d4d4] text-sm mb-4 tracking-wider">DECISION BREAKDOWN</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" outerRadius={85} innerRadius={48}
                          label={({ name, value }) => value > 0 ? `${name}: ${value}` : ""}
                          labelLine={false} fontSize={10} fontFamily="monospace" fill="#d4d4d4">
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 0, fontSize: 10, fontFamily: "monospace", color: "#d4d4d4" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-[#0f0f0f] border border-[#1a1a1a] p-6 rounded-sm">
                  <h3 className="font-mono text-[#d4d4d4] text-sm mb-4 tracking-wider">APPLICATIONS OVER TIME</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={candidatesPerMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#444", fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#444", fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 0, fontSize: 10, fontFamily: "monospace", color: "#d4d4d4" }} />
                      <Line type="monotone" dataKey="count" stroke="#00ff9d" strokeWidth={2.5} dot={{ fill: "#00ff9d", r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {activeTab === "candidates" && (
              <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-sm">
                <div className="p-5 border-b border-[#1a1a1a] flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { key: "all", label: "ALL" },
                      { key: "applied", label: "APPLIED" },
                      { key: "selected", label: "SELECTED" },
                      { key: "rejected", label: "REJECTED" },
                    ].map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setStatusFilter(tab.key)}
                        className={`px-3 py-1.5 rounded-sm text-[10px] font-mono font-semibold transition
                          ${statusFilter === tab.key
                            ? "bg-[#00ff9d] text-[#0a0a0a]"
                            : "bg-[#1a1a1a] text-[#666] hover:bg-[#2d2d2d] hover:text-[#d4d4d4]"}`}
                      >
                        {tab.label} <span className="opacity-70">({statusCounts[tab.key] || 0})</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      <input
                        type="text"
                        placeholder="Search candidates..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 pr-3 py-2 border border-[#1a1a1a] bg-[#0a0a0a] rounded-sm text-xs font-mono text-[#d4d4d4] placeholder-[#444] w-48 focus:outline-none focus:border-[#00ff9d]/50"
                      />
                    </div>
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
                      className="border border-[#1a1a1a] bg-[#0a0a0a] rounded-sm px-3 py-2 text-xs font-mono text-[#d4d4d4] focus:outline-none"
                    >
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                    </select>
                  </div>
                </div>

                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1a1a1a]">
                      <th className="text-left px-5 py-3 text-[10px] font-mono font-semibold text-[#444] tracking-wider">CANDIDATE</th>
                      <th className="text-left px-5 py-3 text-[10px] font-mono font-semibold text-[#444] tracking-wider">STATUS</th>
                      <th className="text-left px-5 py-3 text-[10px] font-mono font-semibold text-[#444] tracking-wider">CV SCORE</th>
                      <th className="text-left px-5 py-3 text-[10px] font-mono font-semibold text-[#444] tracking-wider">APPLIED</th>
                      <th className="text-left px-5 py-3 text-[10px] font-mono font-semibold text-[#444] tracking-wider">OVERRIDE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCandidates.length === 0 ? (
                      <tr><td colSpan={5} className="py-16 text-center text-[#444] text-sm font-mono">No candidates found.</td></tr>
                    ) : (
                      paginatedCandidates.map(candidate => (
                        <tr
                          key={candidate.id}
                          onClick={() => setSelectedCandidate(candidate)}
                          className="border-b border-[#0f0f0f] hover:bg-[#1a1a1a] cursor-pointer transition group"
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-sm border border-[#2d2d2d] bg-[#0a0a0a] flex items-center justify-center text-[#00ff9d] text-xs font-mono flex-shrink-0">
                                {candidate.name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-mono font-semibold text-[#d4d4d4] group-hover:text-[#00ff9d] transition-colors">{candidate.name}</p>
                                <p className="text-[10px] font-mono text-[#444]">{candidate.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <StatusBadge status={candidate.status} />
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-[#1a1a1a] rounded-sm overflow-hidden">
                                <div
                                  className={`h-full rounded-sm ${candidate.score >= 70 ? "bg-[#00ff9d]" : candidate.score >= 50 ? "bg-[#ffb000]" : "bg-[#ff0040]"}`}
                                  style={{ width: `${candidate.score}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono font-semibold text-[#666]">{candidate.score}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-[10px] font-mono text-[#444]">
                            {new Date(candidate.created_at).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", day: "numeric", month: "short" })}
                          </td>
                          <td className="px-5 py-3.5">
                            {candidate.manual_override && (
                              <span className="text-[10px] font-mono bg-[#ffb000]/10 text-[#ffb000] px-2 py-0.5 rounded-sm border border-[#ffb000]/30">MANUAL</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {filteredCandidates.length > ROWS_PER_PAGE && (
                  <div className="flex items-center justify-between px-5 py-4 border-t border-[#1a1a1a] text-[10px] font-mono text-[#444]">
                    <span>Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}–{Math.min(currentPage * ROWS_PER_PAGE, filteredCandidates.length)} of {filteredCandidates.length}</span>
                    <div className="flex gap-1.5">
                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                        className="px-3 py-1.5 rounded-sm border border-[#1a1a1a] disabled:opacity-40 hover:bg-[#1a1a1a] transition font-mono">← Prev</button>
                      <span className="px-3 py-1.5 font-mono">{currentPage}/{totalPages}</span>
                      <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                        className="px-3 py-1.5 rounded-sm border border-[#1a1a1a] disabled:opacity-40 hover:bg-[#1a1a1a] transition font-mono">Next →</button>
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