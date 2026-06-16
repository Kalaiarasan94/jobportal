import { useState, useEffect } from 'react';
import axios from 'axios';

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [stats, setStats] = useState({ totalSubmissions: 0, recentApplications: [] });

  const fetchDashboardStats = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/stats.php`);
      setStats(response.data);
    } catch (err) {
      alert('Error fetching tracking statistics.');
    }
  };

  useEffect(() => {
    if (isAuthenticated) { fetchDashboardStats(); }
  }, [isAuthenticated]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/login.php`, { username, password });
      if (response.data.success) { setIsAuthenticated(true); }
    } catch (err) {
      alert('❌ Access Denied: Invalid Username or Password.');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 antialiased">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 max-w-sm w-full">
          <div className="text-center mb-5">
            <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-950 px-2.5 py-1 rounded border border-indigo-900">Secure Access</span>
            <h3 className="text-lg font-bold text-white mt-2">Internal HR Dashboard</h3>
          </div>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="flex flex-col">
              <label className="text-xs text-slate-300 mb-1">Username</label>
              <input type="text" required className="w-full px-4 py-2 border border-slate-700 bg-slate-900 rounded-xl text-sm text-white outline-none" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-slate-300 mb-1">Password</label>
              <input type="password" required className="w-full px-4 py-2 border border-slate-700 bg-slate-900 rounded-xl text-sm text-white outline-none" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 font-bold text-white text-xs rounded-xl uppercase tracking-wider transition shadow-lg shadow-indigo-900/30">Authenticate</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between antialiased">
      <header className="bg-white border-b border-slate-200 py-4 px-6 flex items-center justify-between shadow-sm">
        <h1 className="text-sm font-bold text-slate-900">📊 HR Lead Analytics Engine</h1>
        <button onClick={() => setIsAuthenticated(false)} className="text-xs font-semibold text-slate-500 hover:text-red-600 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 transition">Lock Console</button>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/40 border border-indigo-200 rounded-2xl p-6 flex flex-col justify-center">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Total Submissions Received</span>
            <span className="text-5xl font-black text-slate-900 mt-2 tracking-tight">{stats.totalSubmissions}</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Spreadsheet Extraction</span>
              <p className="text-[11px] text-slate-400 mt-1">Download candidate historical lists structured clean with separate city values.</p>
            </div>
            <a href={`${import.meta.env.VITE_API_URL}/api/admin/download-applicants.php`} className="w-full text-center mt-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-xl transition shadow-md shadow-emerald-700/20">📥 Extract Master Excel (.xlsx)</a>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recent Inbound Applications</h4>
            <button onClick={fetchDashboardStats} className="text-[11px] font-bold text-indigo-600 hover:underline">🔄 Live Refresh Feed</button>
          </div>
          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
            {stats.recentApplications.length > 0 ? (
              stats.recentApplications.map((app: any, i: number) => (
                <div key={i} className="p-3.5 flex items-center justify-between bg-white hover:bg-slate-50/50 transition text-xs">
                  <div>
                    <p className="font-semibold text-slate-900">{app.full_name}</p>
                    <p className="text-slate-400 text-[11px]">{app.email}</p>
                  </div>
                  <span className="text-[10px] bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded font-mono">{new Date(app.submitted_at).toLocaleDateString()}</span>
                </div>
              ))
            ) : (
              <p className="p-6 text-center text-xs text-slate-400 bg-slate-50">No registrations found in the table yet.</p>
            )}
          </div>
        </div>
      </main>

      <footer className="text-center py-3 text-[10px] text-slate-400 bg-white border-t border-slate-100">Secure HR Administrator Dashboard Environment • 2026</footer>
    </div>
  );
}