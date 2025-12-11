import { useState } from "react";
import { useAuth } from "../auth/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function Register() {
  const { user, token, currentView } = useAuth();

  // Use currentView if available, otherwise fall back to user.role
  const activeView = currentView || user?.role;

  const [formData, setFormData] = useState({
    utorid: "",
    name: "",
    email: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create user");
      }

      const data = await res.json();
      setSuccess({
        message: "User created successfully!",
        resetToken: data.resetToken,
        utorid: data.utorid,
        name: data.name,
        email: data.email,
        password: "$2b$10$pWjxeK/6zpAB1pPre3Oa0OH.B2NNwI4TZsTxI71J/o3nXpelb/Api", // default password
      });

      // Clear form
      setFormData({
        utorid: "",
        name: "",
        email: "",
      });
    } catch (err) {
      console.error("Registration error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Check if user has permission based on activeView (cashier or higher)
  const canRegister =
    activeView === "cashier" ||
    activeView === "manager" ||
    activeView === "superuser";

  if (!canRegister) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          You don't have permission to register new users.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Register New User</h1>
        <p className="text-gray-600 mb-6">Create a new account for a user.</p>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 p-4 rounded-lg mb-4 space-y-3">
            <p className="text-green-700 font-medium">{success.message}</p>
            <div className="bg-white border border-green-200 rounded-lg p-3 space-y-2">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Name:</span> {success.name}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">UTORid:</span> {success.utorid}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Email:</span> {success.email}
              </p>
              {success.resetToken && (
                <div className="mt-3 pt-3 border-t border-green-200">
                  <p className="text-sm font-medium text-yellow-700">Reset Token (share with user):</p>
                  <p className="text-xs font-mono bg-gray-100 p-2 rounded mt-1 break-all">
                    {success.resetToken}
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={() => setSuccess(null)}
              className="w-full mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Register Another User
            </button>
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                UTORid *
              </label>
              <input
                type="text"
                name="utorid"
                value={formData.utorid}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="e.g. johndoe1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="e.g. John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="e.g. john.doe@mail.utoronto.ca"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-pink-600 text-white py-2.5 rounded-lg font-medium hover:bg-pink-700 disabled:opacity-50 transition"
            >
              {loading ? "Creating..." : "Create User"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}