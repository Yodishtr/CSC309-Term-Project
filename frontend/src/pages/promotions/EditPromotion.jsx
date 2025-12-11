import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Convert ISO string
function isoToLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function EditPromotion() {
  const { user, token, currentView } = useAuth();
  const navigate = useNavigate();
  const { promotionId } = useParams();

  const [promotion, setPromotion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("automatic");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [minSpending, setMinSpending] = useState("");
  const [rate, setRate] = useState("");
  const [points, setPoints] = useState("");

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


  // Fetch promotion details
  useEffect(() => {
    if (!token || !promotionId) return;

    async function fetchPromotion() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API_BASE_URL}/promotions/${promotionId}`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          if (res.status === 404) {
            setError("Promotion not found.");
          } else if (res.status === 403) {
            setError("You do not have permission to view this promotion.");
          } else {
            setError(`Failed to load promotion (status ${res.status}).`);
          }
          setPromotion(null);
          return;
        }

        const data = await res.json();
        setPromotion(data);

        // populate form
        setName(data.name ?? "");
        setDescription(data.description ?? "");
        setType(data.type === "onetime" ? "one-time" : data.type || "automatic");
        setStartTime(isoToLocalInputValue(data.startTime));
        setEndTime(isoToLocalInputValue(data.endTime));
        setMinSpending(
          data.minSpending != null ? String(data.minSpending) : ""
        );
        setRate(data.rate != null ? String(data.rate) : "");
        setPoints(data.points != null ? String(data.points) : "");
      } catch (err) {
        console.error("Error fetching promotion:", err);
        setError("Unable to load promotion. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchPromotion();
  }, [token, promotionId]);

  const now = new Date();

  const originalStart = useMemo(() => {
    if (!promotion?.startTime) return null;
    const d = new Date(promotion.startTime);
    return isNaN(d.getTime()) ? null : d;
  }, [promotion]);

  const originalEnd = useMemo(() => {
    if (!promotion?.endTime) return null;
    const d = new Date(promotion.endTime);
    return isNaN(d.getTime()) ? null : d;
  }, [promotion]);

  const hasStarted = !!originalStart && originalStart <= now;
  const hasEnded = !!originalEnd && originalEnd <= now;

  const statusLabel = useMemo(() => {
    if (!originalStart && !originalEnd) return "";
    if (hasEnded) return "Ended";
    if (!hasStarted) return "Not started yet";
    return "Active";
  }, [hasStarted, hasEnded, originalStart, originalEnd]);

  function validate() {
    const errors = {};

    if (!promotion) return false;

    // if promotion already fully ended then no edits allowed
    if (hasEnded) {
      setError("This promotion has already ended and cannot be edited.");
      return false;
    }

    const nowLocal = new Date();

    // Parse local form times
    let newStartDate = null;
    let newEndDate = null;

    if (startTime) {
      newStartDate = new Date(startTime);
    }
    if (endTime) {
      newEndDate = new Date(endTime);
    }

    // BEFORE START: full edit allowed
    if (!hasStarted) {
      if (!name.trim()) {
        errors.name = "Name is required.";
      }

      if (!type || !["automatic", "one-time"].includes(type)) {
        errors.type = "Type must be automatic or one-time.";
      }

      if (!startTime) {
        errors.startTime = "Start time is required.";
      } else if (isNaN(newStartDate.getTime())) {
        errors.startTime = "Start time is invalid.";
      } else if (newStartDate < nowLocal) {
        errors.startTime = "Start time cannot be in the past.";
      }

      if (!endTime) {
        errors.endTime = "End time is required.";
      } else if (isNaN(newEndDate.getTime())) {
        errors.endTime = "End time is invalid.";
      } else if (newEndDate < nowLocal) {
        errors.endTime = "End time cannot be in the past.";
      }

      if (!errors.startTime && !errors.endTime) {
        if (newEndDate <= newStartDate) {
          errors.endTime = "End time must be after start time.";
        }
      }

      if (minSpending !== "") {
        const v = Number(minSpending);
        if (!Number.isFinite(v) || v < 0) {
          errors.minSpending = "Minimum spending must be a non negative number.";
        }
      }

      if (rate !== "") {
        const v = Number(rate);
        if (!Number.isFinite(v) || v < 0) {
          errors.rate = "Rate must be a non negative number.";
        }
      }

      if (points !== "") {
        const v = Number(points);
        if (!Number.isFinite(v) || !Number.isInteger(v) || v < 0) {
          errors.points = "Points must be a non negative integer.";
        }
      }
    } else {
      // AFTER START: only endTime can be edited
      if (!endTime) {
        errors.endTime = "End time is required.";
      } else if (isNaN(newEndDate.getTime())) {
        errors.endTime = "End time is invalid.";
      } else if (newEndDate < nowLocal) {
        errors.endTime = "End time cannot be in the past.";
      }

      if (!errors.endTime && originalStart && newEndDate <= originalStart) {
        errors.endTime = "End time must be after the original start time.";
      }

    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function buildPatchBody() {
    if (!promotion) return null;

    const body = {};

    const trimOrNull = (v) => (v != null ? v.trim() : "");

    // AFTER START: only endTime
    if (hasStarted && !hasEnded) {
      const newEndIso = endTime
        ? new Date(endTime).toISOString()
        : null;
      const originalEndIso = promotion.endTime || null;

      if (newEndIso && newEndIso !== originalEndIso) {
        body.endTime = newEndIso;
      }
      return body;
    }

    // BEFORE START: compare each field with original and only send changes
    const newName = trimOrNull(name);
    if (newName !== (promotion.name ?? "")) {
      body.name = newName;
    }

    const newDescription = trimOrNull(description);
    if (newDescription !== (promotion.description ?? "")) {
      body.description = newDescription || undefined;
    }

    const newType = type;
    const originalType =
      promotion.type === "onetime" ? "one-time" : promotion.type;
    if (newType !== (originalType ?? "automatic")) {
      body.type = newType;
    }

    if (startTime) {
      const newStartIso = new Date(startTime).toISOString();
      if (newStartIso !== (promotion.startTime || "")) {
        body.startTime = newStartIso;
      }
    }

    if (endTime) {
      const newEndIso = new Date(endTime).toISOString();
      if (newEndIso !== (promotion.endTime || "")) {
        body.endTime = newEndIso;
      }
    }

    if (minSpending !== "") {
      const v = Number(minSpending);
      if (promotion.minSpending !== v) {
        body.minSpending = v;
      }
    } else if (promotion.minSpending != null) {
    }

    if (rate !== "") {
      const v = Number(rate);
      if (promotion.rate !== v) {
        body.rate = v;
      }
    }

    if (points !== "") {
      const v = Number(points);
      if (promotion.points !== v) {
        body.points = v;
      }
    }

    return body;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    if (!validate()) return;

    const body = buildPatchBody();
    if (!body || Object.keys(body).length === 0) {
      setError("No changes to save.");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(`${API_BASE_URL}/promotions/${promotionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        if (res.status === 400) {
          setError(
            "Update rejected by server. Check that times are in the future and allowed to be edited."
          );
        } else if (res.status === 403) {
          setError("You do not have permission to edit this promotion.");
        } else if (res.status === 404) {
          setError("Promotion not found.");
        } else {
          setError(`Failed to update promotion (status ${res.status}).`);
        }
        return;
      }

      const data = await res.json();

      // Merge updated fields into promotion state
      setPromotion((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          name: data.name ?? prev.name,
          type: data.type === "one-time" ? "onetime" : data.type ?? prev.type,
          description:
            data.description !== undefined
              ? data.description
              : prev.description,
          startTime: data.startTime ?? prev.startTime,
          endTime: data.endTime ?? prev.endTime,
          minSpending:
            data.minSpending !== undefined
              ? data.minSpending
              : prev.minSpending,
          rate: data.rate !== undefined ? data.rate : prev.rate,
          points: data.points !== undefined ? data.points : prev.points,
        };
      });

      navigate("/promotions", { replace: true });


      if (data.endTime) {
        setEndTime(isoToLocalInputValue(data.endTime));
      }
      if (data.startTime) {
        setStartTime(isoToLocalInputValue(data.startTime));
      }
      if (data.name) setName(data.name);
      if (data.description !== undefined) setDescription(data.description ?? "");
      if (data.type) {
        setType(data.type === "one-time" ? "one-time" : data.type);
      }
      if (data.minSpending !== undefined) {
        setMinSpending(
          data.minSpending != null ? String(data.minSpending) : ""
        );
      }
      if (data.rate !== undefined) {
        setRate(data.rate != null ? String(data.rate) : "");
      }
      if (data.points !== undefined) {
        setPoints(data.points != null ? String(data.points) : "");
      }

      setError("");
    } catch (err) {
      console.error("Error updating promotion:", err);
      setError("An unexpected error occurred while saving.");
    } finally {
      setSaving(false);
    }
  }

  if (!user || !hasAccess) return null;

  if (loading) {
    return (
      <div className="page md:px-16">
        <div className="max-w-2xl mx-auto mt-10 text-sm text-gray-500">
          Loading promotion...
        </div>
      </div>
    );
  }

  if (!promotion) {
    return (
      <div className="page md:px-16">
        <div className="max-w-2xl mx-auto mt-10 text-sm text-gray-500">
          {error || "Promotion not found."}
        </div>
      </div>
    );
  }

  const isEndOnlyEditable = hasStarted && !hasEnded;
  const isFullyReadOnly = hasEnded;

  return (
    <div className="page md:px-16">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold mb-1">
              Promotion #{promotion.id}
            </h1>
            <p className="text-sm text-gray-500">
              View and edit this promotion.{" "}
              {statusLabel && (
                <span className="font-medium">Status: {statusLabel}</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/promotions")}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
          >
            Back to promotions
          </button>
        </div>

        {isEndOnlyEditable && (
          <div className="mb-4 text-xs text-amber-800 bg-amber-50 border border-amber-100 px-4 py-2 rounded-xl">
            This promotion has already started. Only the end time can be
            updated. Other fields are locked.
          </div>
        )}

        {isFullyReadOnly && (
          <div className="mb-4 text-xs text-gray-700 bg-gray-50 border border-gray-200 px-4 py-2 rounded-xl">
            This promotion has already ended and cannot be edited.
          </div>
        )}

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-2 rounded-xl">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="card p-6 rounded-2xl bg-white shadow-sm space-y-4"
        >
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Promotion name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isEndOnlyEditable || isFullyReadOnly}
              className={`w-full rounded-xl border px-3 py-2 text-sm ${
                fieldErrors.name
                  ? "border-red-300"
                  : "border-gray-200"
              } ${isEndOnlyEditable || isFullyReadOnly ? "bg-gray-100" : ""}`}
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
              disabled={isEndOnlyEditable || isFullyReadOnly}
              className={`w-full rounded-xl border px-3 py-2 text-sm ${
                isEndOnlyEditable || isFullyReadOnly ? "bg-gray-100" : ""
              } border-gray-200`}
            />
          </div>

          {/* Type & Time */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Type */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                disabled={isEndOnlyEditable || isFullyReadOnly}
                className={`w-full rounded-xl border px-3 py-2 text-sm bg-white ${
                  fieldErrors.type ? "border-red-300" : "border-gray-200"
                } ${isEndOnlyEditable || isFullyReadOnly ? "bg-gray-100" : ""}`}
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
                Start time
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={isEndOnlyEditable || isFullyReadOnly}
                className={`w-full rounded-xl border px-3 py-2 text-sm ${
                  fieldErrors.startTime
                    ? "border-red-300"
                    : "border-gray-200"
                } ${isEndOnlyEditable || isFullyReadOnly ? "bg-gray-100" : ""}`}
              />
              {fieldErrors.startTime && (
                <p className="mt-1 text-xs text-red-500">
                  {fieldErrors.startTime}
                </p>
              )}
              {originalStart && (
                <p className="mt-1 text-[11px] text-gray-400">
                  Original: {formatDateTime(promotion.startTime)}
                </p>
              )}
            </div>

            {/* End time */}
            <div>
              <label className="block text-sm font-medium mb-1">
                End time
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={isFullyReadOnly}
                className={`w-full rounded-xl border px-3 py-2 text-sm ${
                  fieldErrors.endTime
                    ? "border-red-300"
                    : "border-gray-200"
                } ${isFullyReadOnly ? "bg-gray-100" : ""}`}
              />
              {fieldErrors.endTime && (
                <p className="mt-1 text-xs text-red-500">
                  {fieldErrors.endTime}
                </p>
              )}
              {originalEnd && (
                <p className="mt-1 text-[11px] text-gray-400">
                  Original: {formatDateTime(promotion.endTime)}
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
                disabled={isEndOnlyEditable || isFullyReadOnly}
                className={`w-full rounded-xl border px-3 py-2 text-sm ${
                  fieldErrors.minSpending
                    ? "border-red-300"
                    : "border-gray-200"
                } ${isEndOnlyEditable || isFullyReadOnly ? "bg-gray-100" : ""}`}
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
                disabled={isEndOnlyEditable || isFullyReadOnly}
                className={`w-full rounded-xl border px-3 py-2 text-sm ${
                  fieldErrors.rate
                    ? "border-red-300"
                    : "border-gray-200"
                } ${isEndOnlyEditable || isFullyReadOnly ? "bg-gray-100" : ""}`}
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
                disabled={isEndOnlyEditable || isFullyReadOnly}
                className={`w-full rounded-xl border px-3 py-2 text-sm ${
                  fieldErrors.points
                    ? "border-red-300"
                    : "border-gray-200"
                } ${isEndOnlyEditable || isFullyReadOnly ? "bg-gray-100" : ""}`}
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
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || isFullyReadOnly}
              className={`px-4 py-2 rounded-xl text-sm font-medium text-white ${
                saving || isFullyReadOnly
                  ? "bg-pink-300 cursor-not-allowed"
                  : "bg-pink-600 hover:bg-pink-700"
              }`}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
