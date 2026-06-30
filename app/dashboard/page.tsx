"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
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
  score: number;
  status: string;
  created_at: string;
};

export default function DashboardPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  // Table controls
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const handleLogin = () => {
    if (password === "admin123") {
      setAuthenticated(true);
    } else {
      alert("Invalid password");
    }
  };

  useEffect(() => {
    if (!authenticated) return;
    const fetchCandidates = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("candidates")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) {
        setCandidates(data as Candidate[]);
      }
      setLoading(false);
    };
    fetchCandidates();
  }, [authenticated]);

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
      const day = new Date(candidate.created_at).toLocaleDateString();
      map[day] = (map[day] || 0) + 1;
    });
    return Object.entries(map).map(([date, count]) => ({ date, count }));
  }, [candidates]);

  // Status counts for filter tabs
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: candidates.length };
    candidates.forEach((c) => {
      const status = c.status?.toLowerCase() || "unknown";
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [candidates]);

  // Filtered + searched candidates (full list, before pagination)
  const filteredCandidates = useMemo(() => {
    let result = candidates;

    if (statusFilter !== "all") {
      result = result.filter((c) => c.status?.toLowerCase() === statusFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.name?.toLowerCase().includes(term) ||
          c.email?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [candidates, statusFilter, searchTerm]);

  // Reset to page 1 whenever filter/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchTerm]);

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
            className="w-full border rounded-lg px-4 py-3 mb-4 text-gray-800"
          />
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center text-gray-700">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">Hiring Analytics Dashboard</h1>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 mb-8">
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
                <XAxis dataKey="skill" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" />
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
              <Line type="monotone" dataKey="count" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex flex-col gap-4 mb-4 md:flex-row md:items-center md:justify-between">
            <h2 className="font-semibold text-gray-800">All Candidates</h2>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              {/* Status filter tabs */}
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

              {/* Search */}
              <input
                type="text"
                placeholder="Search name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 w-full md:w-64"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 text-gray-600">Name</th>
                  <th className="text-left p-3 text-gray-600">Score</th>
                  <th className="text-left p-3 text-gray-600">Status</th>
                  <th className="text-left p-3 text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-gray-400">
                      No candidates found.
                    </td>
                  </tr>
                ) : (
                  paginatedCandidates.map((candidate) => (
                    <tr key={candidate.id} className="border-b">
                      <td className="p-3 text-gray-800">{candidate.name}</td>
                      <td className="p-3 text-gray-800">{candidate.score}</td>
                      <td className="p-3">
                        <span className={`px-3 py-1 rounded-full text-sm ${
                          candidate.status === "selected"
                            ? "bg-green-100 text-green-700"
                            : candidate.status === "rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {candidate.status}
                        </span>
                      </td>
                      <td className="p-3 text-gray-800">
                        {new Date(candidate.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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
                <span className="px-3 py-1.5">
                  Page {currentPage} of {totalPages}
                </span>
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
