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

type Candidate = {
  id: string;
  name: string;
  email: string;
  phone: string;
  skills: string[];
  score: number;
  status: string;
  created_at: string;
};

export default function DashboardPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

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

    const total = candidates.reduce(
      (sum, item) => sum + (item.score || 0),
      0
    );

    return (total / candidates.length).toFixed(1);
  }, [candidates]);

  const pieData = useMemo(() => {
    const selected = candidates.filter(
      (c) => c.status?.toLowerCase() === "selected"
    ).length;

    const rejected = candidates.filter(
      (c) => c.status?.toLowerCase() === "rejected"
    ).length;

    return [
      { name: "Selected", value: selected },
      { name: "Rejected", value: rejected },
    ];
  }, [candidates]);

  const skillsData = useMemo(() => {
  const map: Record<string, number> = {};
  candidates.forEach((candidate) => {
    const skills = typeof candidate.skills === 'string'
      ? candidate.skills.replace(/[\[\]"]/g, '').split(',').map(s => s.trim())
      : candidate.skills || [];
    skills.forEach((skill) => {
      map[skill] = (map[skill] || 0) + 1;
    });
  });
  return Object.entries(map)
    .map(([skill, count]) => ({ skill, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}, [candidates]);

    return Object.entries(map)
      .map(([skill, count]) => ({
        skill,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [candidates]);

  const candidatesPerDay = useMemo(() => {
    const map: Record<string, number> = {};

    candidates.forEach((candidate) => {
      const day = new Date(candidate.created_at).toLocaleDateString();

      map[day] = (map[day] || 0) + 1;
    });

    return Object.entries(map).map(([date, count]) => ({
      date,
      count,
    }));
  }, [candidates]);

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white shadow-xl rounded-xl p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold mb-6 text-center">
            Hiring Dashboard
          </h1>

          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-lg px-4 py-3 mb-4"
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
      <div className="min-h-screen flex justify-center items-center">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">
          Hiring Analytics Dashboard
        </h1>

        {/* KPI Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 mb-8">
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-gray-500 text-sm">Total Candidates</h3>
            <p className="text-4xl font-bold mt-2">{totalCandidates}</p>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-gray-500 text-sm">
              Average Qualification Score
            </h3>
            <p className="text-4xl font-bold mt-2">{averageScore}</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="font-semibold mb-4">
              Selected vs Rejected
            </h2>

            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  outerRadius={100}
                  label
                >
                  {pieData.map((_, index) => (
                    <Cell
                      key={index}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="font-semibold mb-4">
              Skills Distribution
            </h2>

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
          <h2 className="font-semibold mb-4">
            Candidates Per Day
          </h2>

          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={candidatesPerDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="count"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Candidates */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold mb-4">
            Recent Candidates
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Score</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Date</th>
                </tr>
              </thead>

              <tbody>
                {candidates.slice(0, 10).map((candidate) => (
                  <tr key={candidate.id} className="border-b">
                    <td className="p-3">{candidate.name}</td>
                    <td className="p-3">
                      {candidate.score}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-3 py-1 rounded-full text-sm ${
                          candidate.status === "selected"
                            ? "bg-green-100 text-green-700"
                            : candidate.status === "rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {candidate.status}
                      </span>
                    </td>
                    <td className="p-3">
                      {new Date(
                        candidate.created_at
                      ).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
