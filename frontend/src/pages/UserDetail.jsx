import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function UserDetail() {
  const { userId } = useParams();
  const { user: currentUser, token, currentView } = useAuth();

  // Use currentView if available, otherwise fall back to user.role
  const activeView = currentView || currentUser?.role;

  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchUser();
  }, [userId, token]);

  const fetchUser = async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API_BASE_URL}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 404) {
          setError("User not found");
        } else {
          throw new Error("Failed to fetch user");
        }
        return;
      }

      const data = await res.json();
      setUserData(data);
    } catch (err) {
      console.error("Error fetching user:", err);
      setError("Failed to load user");
    } finally {
      setLoading(false);
    }
  };

const handleUpdate = async (updates) => {
  setError("");
  setSuccess("");
  setActionLoading(true);

  try {
    const res = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to update user");
    }

    const updatedUser = await res.json();
    
    setUserData(updatedUser);
    
    setSuccess("User updated successfully!");
    
    // Clear success message after 3 seconds
    setTimeout(() => setSuccess(""), 3000);
    
  } catch (err) {
    console.error("Error updating user:", err);
    setError(err.message);
  } finally {
    setActionLoading(false);
  }
};

  const handleVerify = () => {
    handleUpdate({ verified: true });
  };

  const handleToggleSuspicious = () => {
    handleUpdate({ suspicious: !userData.suspicious });
  };

  const handleRoleChange = (newRole) => {
    if (confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
      handleUpdate({ role: newRole });
    }
  };

  // Check permission based on activeView
  const isManager = activeView === "manager" || activeView === "superuser";
  const isSuperuser = activeView === "superuser";

  if (!isManager) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          You don't have permission to view this page.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <p className="text-gray-500">Loading user...</p>
      </div>
    );
  }

  if (error && !userData) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>
        <Link to="/users" className="text-pink-600 hover:text-pink-700 mt-4 inline-block">
          ← Back to Users
        </Link>
      </div>
    );
  }

  if (!userData) return null;

  // Determine what roles this user can be changed to
  const availableRoles = [];
  if (isSuperuser) {
    if (userData.role === "regular") availableRoles.push("cashier", "manager", "superuser");
    if (userData.role === "cashier") availableRoles.push("regular", "manager", "superuser");
    if (userData.role === "manager") availableRoles.push("regular", "cashier", "superuser");
    if (userData.role === "superuser") availableRoles.push("regular", "cashier", "manager");
  } else if (isManager) {
    if (userData.role === "regular") availableRoles.push("cashier");
    if (userData.role === "cashier") availableRoles.push("regular");
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link to="/users" className="text-pink-600 hover:text-pink-700 font-medium inline-block">
        ← Back to Users
      </Link>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>
      )}

      {success && (
        <div className="bg-green-50 text-green-700 p-4 rounded-lg">{success}</div>
      )}

      {/* User Info Card */}
      <div className="bg-white rounded-xl shadow-md p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{userData.name || "N/A"}</h1>
            <p className="text-gray-500 mt-1">{userData.utorid}</p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              userData.role === "superuser"
                ? "bg-purple-100 text-purple-700"
                : userData.role === "manager"
                ? "bg-blue-100 text-blue-700"
                : userData.role === "cashier"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {userData.role}
          </span>
        </div>

        {/* User Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium text-gray-900">{userData.email || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Birthday</p>
              <p className="font-medium text-gray-900">
                {userData.birthday
                  ? new Date(userData.birthday).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Created At</p>
              <p className="font-medium text-gray-900">
                {userData.createdAt
                  ? new Date(userData.createdAt).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Points Balance</p>
              <p className="font-bold text-2xl text-pink-600">{userData.points || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Verified Status</p>
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  userData.verified
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {userData.verified ? "Verified" : "Not Verified"}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Suspicious Status</p>
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  userData.suspicious
                    ? "bg-orange-100 text-orange-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {userData.suspicious ? "Suspicious" : "Not Suspicious"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Management Actions */}
      <div className="bg-white rounded-xl shadow-md p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Management Actions</h2>

        <div className="space-y-6">
          {/* Verify User */}
          {!userData.verified && (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Verify User</p>
                <p className="text-sm text-gray-500">
                  Mark this user as verified to allow full access
                </p>
              </div>
              <button
                onClick={handleVerify}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                {actionLoading ? "Processing..." : "Verify User"}
              </button>
            </div>
          )}

          {/* Toggle Suspicious (for cashiers) */}
          {userData.role === "cashier" && (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Suspicious Status</p>
                <p className="text-sm text-gray-500">
                  {userData.suspicious
                    ? "This cashier is currently marked as suspicious"
                    : "Mark this cashier as suspicious if needed"}
                </p>
              </div>
              <button
                onClick={handleToggleSuspicious}
                disabled={actionLoading}
                className={`px-4 py-2 rounded-lg transition disabled:opacity-50 ${
                  userData.suspicious
                    ? "bg-gray-600 text-white hover:bg-gray-700"
                    : "bg-orange-600 text-white hover:bg-orange-700"
                }`}
              >
                {actionLoading
                  ? "Processing..."
                  : userData.suspicious
                  ? "Remove Suspicious"
                  : "Mark Suspicious"}
              </button>
            </div>
          )}

          {/* Role Management */}
          {availableRoles.length > 0 && (
            <div className="p-4 border rounded-lg">
              <p className="font-medium text-gray-900 mb-2">Change Role</p>
              <p className="text-sm text-gray-500 mb-4">
                Current role: <span className="font-medium capitalize">{userData.role}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {availableRoles.map((role) => (
                  <button
                    key={role}
                    onClick={() => handleRoleChange(role)}
                    disabled={actionLoading}
                    className={`px-4 py-2 rounded-lg transition disabled:opacity-50 ${
                      role === "superuser"
                        ? "bg-purple-600 text-white hover:bg-purple-700"
                        : role === "manager"
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : role === "cashier"
                        ? "bg-yellow-600 text-white hover:bg-yellow-700"
                        : "bg-gray-600 text-white hover:bg-gray-700"
                    }`}
                  >
                    {actionLoading ? "Processing..." : `Make ${role}`}
                  </button>
                ))}
              </div>
              {!isSuperuser && (
                <p className="text-xs text-gray-400 mt-3">
                  Note: Only superusers can promote users to manager or superuser roles.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Last Login Info */}
      {userData.lastLogin && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <p className="text-sm text-gray-500">Last Login</p>
          <p className="font-medium text-gray-900">
            {new Date(userData.lastLogin).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}