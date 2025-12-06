import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function NewPromotion() {
  const { user, token, currentView } = useAuth();
  const navigate = useNavigate();

  const hasAccess =
    user && (user.role === "manager" || user.role === "superuser") && (currentView == "manager" || currentView == "superuser");

  useEffect(() => {
    if (user && !hasAccess) {
      navigate("/promotions", { replace: true });
    }
  }, [user, hasAccess, navigate]);

  // Don’t render the form until we know the role
  if (!user) return null;
  if (!hasAccess) return null;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("automatic");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [minSpending, setMinSpending] = useState("");
  const [rate, setRate] = useState("");
  const [points, setPoints] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});



  function validate() {
    const errors = {};
    if (!name.trim()) {
      errors.name = "Name is required.";
    }
    if (!type || !["automatic", "one-time"].includes(type)) {
      errors.type = "Type must be automatic or one-time.";
    }

    // time validation
    if (!startTime) {
      errors.startTime = "Start time is required.";
    }
    if (!endTime) {
      errors.endTime = "End time is required.";
    }

    let startDate = null;
    let endDate = null;
    const now = new Date();

    if (startTime) {
      startDate = new Date(startTime);
      if (isNaN(startDate.getTime())) {
        errors.startTime = "Start time is invalid.";
      } else if (startDate < now) {
        errors.startTime = "Start time cannot be in the past.";
      }
    }

    if (endTime) {
      endDate = new Date(endTime);
      if (isNaN(endDate.getTime())) {
        errors.endTime = "End time is invalid.";
      } else if (endDate < now) {
        errors.endTime = "End time cannot be in the past.";
      }
    }

    if (startDate && endDate && endDate <= startDate) {
      errors.endTime = "End time must be after start time.";
    }

    // numeric fields 
    if (minSpending !== "") {
      const v = Number(minSpending);
      if (!Number.isFinite(v) || v <= 0) {
        errors.minSpending = "Minimum spending must be a positive number.";
      }
    }

    if (rate !== "") {
      const v = Number(rate);
      if (!Number.isFinite(v) || v <= 0) {
        errors.rate = "Rate must be a positive number.";
      }
    }

    if (points !== "") {
      const v = Number(points);
      if (!Number.isFinite(v) || !Number.isInteger(v) || v <= 0) {
        errors.points = "Points must be a positive integer.";
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    if (!validate()) return;

    try {
      setSubmitting(true);

      // Convert datetime local to ISO strings
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      };

      if (minSpending !== "") body.minSpending = Number(minSpending);
      if (rate !== "") body.rate = Number(rate)/100;
      if (points !== "") body.points = Number(points);

      const res = await fetch(`${API_BASE_URL}/promotions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        if (res.status === 400) {
          setError(
            "Invalid promotion data. Please check the fields and try again."
          );
        } else if (res.status === 403) {
          setError("You are not allowed to create promotions.");
        } else {
          setError(`Failed to create promotion (status ${res.status}).`);
        }
        return;
      }

      const data = await res.json();

      if (data.id) {
        navigate(`/promotions/${data.id}`);
      } else {
        navigate("/promotions");
      }
    } catch (err) {
      console.error("Error creating promotion:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page md:px-16">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold mb-1">
              Create New Promotion
            </h1>
            <p className="text-sm text-gray-500">
              Set up a new automatic or one-time promotion.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/promotions")}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="card p-6 rounded-2xl bg-white shadow-sm space-y-4"
        >
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-2 rounded-xl">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Promotion name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full rounded-xl border px-3 py-2 text-sm ${
                fieldErrors.name
                  ? "border-red-300"
                  : "border-gray-200"
              }`}
              placeholder="Start of Summer Celebration"
            />
            {fieldErrors.name && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.name}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder="Describe what this promotion is for"
            />
          </div>

          {/* Type and Time */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Type */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Type <span className="text-red-500">*</span>
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-sm bg-white ${
                  fieldErrors.type ? "border-red-300" : "border-gray-200"
                }`}
              >
                <option value="automatic">Automatic</option>
                <option value="one-time">One-time</option>
              </select>
              {fieldErrors.type && (
                <p className="mt-1 text-xs text-red-500">
                  {fieldErrors.type}
                </p>
              )}
            </div>

            {/* Start time */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Start time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-sm ${
                  fieldErrors.startTime
                    ? "border-red-300"
                    : "border-gray-200"
                }`}
              />
              {fieldErrors.startTime && (
                <p className="mt-1 text-xs text-red-500">
                  {fieldErrors.startTime}
                </p>
              )}
            </div>

            {/* End time */}
            <div>
              <label className="block text-sm font-medium mb-1">
                End time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-sm ${
                  fieldErrors.endTime
                    ? "border-red-300"
                    : "border-gray-200"
                }`}
              />
              {fieldErrors.endTime && (
                <p className="mt-1 text-xs text-red-500">
                  {fieldErrors.endTime}
                </p>
              )}
            </div>
          </div>

          {/* Numbers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Min spending */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Minimum spending ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={minSpending}
                onChange={(e) => setMinSpending(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-sm ${
                  fieldErrors.minSpending
                    ? "border-red-300"
                    : "border-gray-200"
                }`}
                placeholder="e.g., 50.00"
              />
              {fieldErrors.minSpending && (
                <p className="mt-1 text-xs text-red-500">
                  {fieldErrors.minSpending}
                </p>
              )}
            </div>

            {/* Rate */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Rate (extra points per $1)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-sm ${
                  fieldErrors.rate
                    ? "border-red-300"
                    : "border-gray-200"
                }`}
                placeholder="e.g., 0.5"
              />
              {fieldErrors.rate && (
                <p className="mt-1 text-xs text-red-500">
                  {fieldErrors.rate}
                </p>
              )}
            </div>

            {/* Points */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Bonus points
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-sm ${
                  fieldErrors.points
                    ? "border-red-300"
                    : "border-gray-200"
                }`}
                placeholder="e.g., 100"
              />
              {fieldErrors.points && (
                <p className="mt-1 text-xs text-red-500">
                  {fieldErrors.points}
                </p>
              )}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate("/promotions")}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-4 py-2 rounded-xl text-sm font-medium text-white ${
                submitting
                  ? "bg-pink-300 cursor-not-allowed"
                  : "bg-pink-600 hover:bg-pink-700"
              }`}
            >
              {submitting ? "Creating..." : "Create promotion"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
