import { useAuth } from "../auth/AuthContext";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function Dashboard() {
  const { user, token } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [events, setEvents] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !token) return;
    fetchDashboardData();
  }, [user, token]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      if (user.role === "regular") {
        // Fetch recent transactions for regular users
        const res = await fetch(`${API_BASE_URL}/users/me/transactions?limit=5`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setTransactions(data.results || []);
        }
      } else if (user.role === "cashier") {
        // Cashiers don't need specific data on dashboard
      } else if (user.role === "manager" || user.role === "superuser") {
        // Fetch overview data for managers/superusers
        const [eventsRes, promosRes, usersRes] = await Promise.all([
          fetch(`${API_BASE_URL}/events?limit=5`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/promotions?limit=5`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/users?limit=5`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (eventsRes.ok) {
          const data = await eventsRes.json();
          setEvents(data.results || []);
        }
        if (promosRes.ok) {
          const data = await promosRes.json();
          setPromotions(data.results || []);
        }
        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers(data.results || []);
        }
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>

      {/* Regular User Dashboard */}
      {user.role === "regular" && (
        <>
          {/* Points Balance Card */}
          <div className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl shadow-lg p-8 text-white">
            <h2 className="text-lg font-medium opacity-90">Your Points Balance</h2>
            <p className="text-5xl font-bold mt-2">{user.points || 0}</p>
            <p className="text-sm opacity-80 mt-2">points available</p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/events"
              className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition text-center"
            >
              <div className="text-pink-600 text-3xl mb-2">🎉</div>
              <h3 className="font-semibold text-gray-900">Browse Events</h3>
              <p className="text-sm text-gray-500 mt-1">RSVP to upcoming events</p>
            </Link>
            <Link
              to="/transactions"
              className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition text-center"
            >
              <div className="text-pink-600 text-3xl mb-2">💳</div>
              <h3 className="font-semibold text-gray-900">Transactions</h3>
              <p className="text-sm text-gray-500 mt-1">View your history</p>
            </Link>
            <Link
              to="/promotions"
              className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition text-center"
            >
              <div className="text-pink-600 text-3xl mb-2">🎁</div>
              <h3 className="font-semibold text-gray-900">Promotions</h3>
              <p className="text-sm text-gray-500 mt-1">View available deals</p>
            </Link>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Recent Transactions</h2>
              <Link to="/transactions" className="text-pink-600 hover:text-pink-700 text-sm font-medium">
                View All →
              </Link>
            </div>
            {loading ? (
              <p className="text-gray-500">Loading...</p>
            ) : transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.map((txn) => (
                  <div
                    key={txn.id}
                    className={`p-4 rounded-lg border-l-4 ${
                      txn.type === "purchase"
                        ? "border-green-500 bg-green-50"
                        : txn.type === "event"
                        ? "border-blue-500 bg-blue-50"
                        : txn.type === "transfer"
                        ? "border-purple-500 bg-purple-50"
                        : txn.type === "redemption"
                        ? "border-red-500 bg-red-50"
                        : "border-gray-500 bg-gray-50"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-900 capitalize">{txn.type}</p>
                        {txn.remark && <p className="text-sm text-gray-600">{txn.remark}</p>}
                      </div>
                      <p className={`font-bold ${
                        txn.amount > 0 ? "text-green-600" : "text-red-600"
                      }`}>
                        {txn.amount > 0 ? "+" : ""}{txn.amount} pts
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No transactions yet</p>
            )}
          </div>
        </>
      )}

      {/* Cashier Dashboard */}
      {user.role === "cashier" && (
        <>
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Cashier Dashboard</h2>
            <p className="text-gray-600 mb-6">Quick access to your daily tasks</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link
              to="/cashier/create-transaction"
              className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition"
            >
              <div className="text-pink-600 text-4xl mb-3">💳</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Create Transaction</h3>
              <p className="text-gray-600">Process customer purchases and award points</p>
            </Link>
            <Link
              to="/cashier/process-redemption"
              className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition"
            >
              <div className="text-pink-600 text-4xl mb-3">✅</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Process Redemption</h3>
              <p className="text-gray-600">Process customer point redemption requests</p>
            </Link>
          </div>
        </>
      )}

      {/* Manager/Superuser Dashboard */}
      {(user.role === "manager" || user.role === "superuser") && (
        <>
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl shadow-lg p-8 text-white">
            <h2 className="text-2xl font-bold">Management Overview</h2>
            <p className="opacity-90 mt-2">Welcome back, {user.name || user.utorid}</p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Total Events</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{events.length}</p>
                </div>
                <div className="text-pink-600 text-3xl">🎉</div>
              </div>
              <Link to="/events" className="text-pink-600 hover:text-pink-700 text-sm font-medium mt-4 inline-block">
                Manage Events →
              </Link>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Active Promotions</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{promotions.length}</p>
                </div>
                <div className="text-pink-600 text-3xl">🎁</div>
              </div>
              <Link to="/promotions" className="text-pink-600 hover:text-pink-700 text-sm font-medium mt-4 inline-block">
                Manage Promotions →
              </Link>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Total Users</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{users.length}</p>
                </div>
                <div className="text-pink-600 text-3xl">👥</div>
              </div>
              <Link to="/users" className="text-pink-600 hover:text-pink-700 text-sm font-medium mt-4 inline-block">
                Manage Users →
              </Link>
            </div>
          </div>

          {/* Recent Events */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Recent Events</h2>
              <Link to="/events" className="text-pink-600 hover:text-pink-700 text-sm font-medium">
                View All →
              </Link>
            </div>
            {loading ? (
              <p className="text-gray-500">Loading...</p>
            ) : events.length > 0 ? (
              <div className="space-y-3">
                {events.slice(0, 3).map((event) => (
                  <div key={event.id} className="p-4 border rounded-lg hover:bg-gray-50 transition">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{event.name}</h3>
                        <p className="text-sm text-gray-600">{event.location}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(event.startTime).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        event.published ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {event.published ? "Published" : "Draft"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No events yet</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}