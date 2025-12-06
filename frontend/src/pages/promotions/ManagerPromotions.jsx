import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "automatic", label: "Automatic" },
  { value: "one-time", label: "One-time" },
];

const STARTED_OPTIONS = [
  { value: "", label: "Any" },
  { value: "true", label: "Started" },
  { value: "false", label: "Not started" },
];

const ENDED_OPTIONS = [
  { value: "", label: "Any" },
  { value: "true", label: "Ended" },
  { value: "false", label: "Not ended" },
];

const PAGE_SIZE_OPTIONS = [5, 10, 20];

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

function getTypeBadgeClass(type) {
  if (type === "automatic")
    return "bg-blue-50 text-blue-700 border-blue-200";
  if (type === "one-time" || type === "onetime")
    return "bg-purple-50 text-purple-700 border-purple-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
}

function getPromotionStatus(startTime, endTime) {
  const now = new Date();
  const start = startTime ? new Date(startTime) : null;
  const end = endTime ? new Date(endTime) : null;

  if (start && now < start) return "Not started yet";
  if (end && now > end) return "Ended";
  return "Active";
}

export default function ManagerPromotions() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [promotions, setPromotions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // filters
  const [nameFilter, setNameFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [startedFilter, setStartedFilter] = useState("");
  const [endedFilter, setEndedFilter] = useState(""); 

  // sort
const [sortField, setSortField] = useState("endTime"); 
const [sortDirection, setSortDirection] = useState("asc"); 

  // pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    if (!token) return;

    async function fetchPromotions() {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams();
        if (nameFilter.trim()) params.append("name", nameFilter.trim());
        if (typeFilter) params.append("type", typeFilter);

        if (startedFilter) {
          params.append("started", startedFilter);
        } else if (endedFilter) {
          params.append("ended", endedFilter);
        }

        params.append("page", String(page));
        params.append("limit", String(limit));

        const res = await fetch(
          `${API_BASE_URL}/promotions?${params.toString()}`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) {
          throw new Error(`Failed to fetch promotions (status ${res.status})`);
        }

        const data = await res.json();
        setPromotions(data.results || []);
        setTotalCount(data.count ?? 0);
      } catch (err) {
        console.error("Error fetching promotions:", err);
        setError("Unable to load promotions. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchPromotions();
  }, [token, nameFilter, typeFilter, startedFilter, endedFilter, page, limit]);

const sortedPromotions = useMemo(() => {
  const copy = [...promotions];

  copy.sort((a, b) => {
    const field = sortField;

    const getTime = (promo) => {
      const v = promo[field];
      if (!v) {
        return sortDirection === "asc" ? Infinity : -Infinity;
      }
      const t = new Date(v).getTime();
      if (Number.isNaN(t)) {
        return sortDirection === "asc" ? Infinity : -Infinity;
      }
      return t;
    };

    const ta = getTime(a);
    const tb = getTime(b);

    return sortDirection === "asc" ? ta - tb : tb - ta;
  });

  return copy;
}, [promotions, sortField, sortDirection]);


  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const startIndex = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const endIndex = Math.min(totalCount, page * limit);

  function handleClearFilters() {
    setNameFilter("");
    setTypeFilter("");
    setStartedFilter("");
    setEndedFilter("");
    setSortBy("endSoonest");
    setPage(1);
  }

  function handlePageChange(newPage) {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  }

  async function handleDelete(promoId) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this promotion?"
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE_URL}/promotions/${promoId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 403) {
        alert("You cannot delete this promotion because it has already started.");
        return;
      }

      if (!res.ok) {
        throw new Error(`Failed to delete promotion (status ${res.status})`);
      }

      setPromotions((prev) => prev.filter((p) => p.id !== promoId));
      setTotalCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Error deleting promotion:", err);
      alert("Failed to delete promotion. Please try again.");
    }
  }

  return (
    <div className="page page-promotions md:px-16">
      {/* Header */}
      <div className="page-header flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold mb-1">Manage Promotions</h1>
          <p className="text-sm text-gray-500">
            View, filter, and manage all promotions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/promotions/new")}
          className="px-4 py-2 rounded-xl bg-pink-600 text-white text-lg font-medium hover:bg-pink-700"
        >
          + New Promotion
        </button>
      </div>

      {/* Filters card */}
      <div className="card mb-6 p-6 rounded-2xl bg-white shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Filters</h2>
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-sm px-3 py-1.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Clear Filters
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {/* Name filter */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Promotion name
            </label>
            <input
              type="text"
              value={nameFilter}
              onChange={(e) => {
                setNameFilter(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name..."
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </div>

          {/* Type filter */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Promotion type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Started filter */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Started status
            </label>
            <select
              value={startedFilter}
              onChange={(e) => {
                const value = e.target.value;
                setStartedFilter(value);
                if (value) setEndedFilter(""); 
                setPage(1);
              }}
              disabled={endedFilter !== ""} 
              className={
                "w-full rounded-xl border px-3 py-2 text-sm bg-white " +
                (endedFilter !== ""
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "border-gray-200")
              }
            >
              {STARTED_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {startedFilter && (
              <p className="mt-1 text-[11px] text-gray-400">
                Filtering by started disables the “ended” filter.
              </p>
            )}
          </div>

          {/* Ended filter */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Ended status
            </label>
            <select
              value={endedFilter}
              onChange={(e) => {
                const value = e.target.value;
                setEndedFilter(value);
                if (value) setStartedFilter(""); 
                setPage(1);
              }}
              disabled={startedFilter !== ""}
              className={
                "w-full rounded-xl border px-3 py-2 text-sm bg-white " +
                (startedFilter !== ""
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "border-gray-200")
              }
            >
              {ENDED_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {endedFilter && (
              <p className="mt-1 text-[11px] text-gray-400">
                Filtering by ended disables the “started” filter.
              </p>
            )}
          </div>
        </div>

        {/* Sort and page size row */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Order by:</span>

            {/* sort field */}
            <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-1.5 text-sm bg-white"
            >
                <option value="startTime">Start date</option>
                <option value="endTime">End date</option>
            </select>

            {/* sort direction */}
            <select
                value={sortDirection}
                onChange={(e) => setSortDirection(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-1.5 text-sm bg-white"
            >
                <option value="asc">Soonest first</option>
                <option value="desc">Latest first</option>
            </select>
            </div>


          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-xl border border-gray-200 px-3 py-1.5 text-sm bg-white"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-2 rounded-xl">
          {error}
        </div>
      )}

      {/* Promotions list */}
      <div className="card p-0 rounded-2xl bg-white shadow-sm">
        {loading ? (
          <div className="px-6 py-8 text-center text-gray-500 text-sm">
            Loading promotions...
          </div>
        ) : sortedPromotions.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500 text-sm">
            No promotions found.
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-semibold">All Promotions</h2>
              <span className="text-xs text-gray-500">
                Showing {startIndex}–{endIndex} of {totalCount}
              </span>
            </div>

            <ul className="divide-y divide-gray-100">
              {sortedPromotions.map((promo) => {
                const now = new Date();
                const hasStarted =
                  promo.startTime &&
                  new Date(promo.startTime) <= now;
                const hasEnded =
                    promo.endTime &&
                    new Date(promo.endTime) <= now;
            
                return (
                  <li key={promo.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={
                              "inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium " +
                              getTypeBadgeClass(promo.type)
                            }
                          >
                            {promo.type === "automatic"
                              ? "Automatic"
                              : "One-time"}
                          </span>
                          <span className="text-xs text-gray-400">
                            ID #{promo.id}
                          </span>
                        </div>

                        <h3 className="text-sm font-semibold text-gray-900">
                          {promo.name}
                        </h3>

                        <div className="mt-1 space-y-0.5 text-xs text-gray-500">
                          {promo.startTime && (
                            <p>
                              Starts:{" "}
                              <span className="font-medium">
                                {formatDateTime(promo.startTime)}
                              </span>
                            </p>
                          )}
                          {promo.endTime && (
                            <p>
                              Ends:{" "}
                              <span className="font-medium">
                                {formatDateTime(promo.endTime)}
                              </span>
                            </p>
                          )}
                          <p>
                            Status:{" "}
                            <span className="font-medium">
                              {getPromotionStatus(
                                promo.startTime,
                                promo.endTime
                              )}
                            </span>
                          </p>

                          {promo.minSpending != null && (
                            <p>
                              Minimum spending:{" "}
                              <span className="font-medium">
                                ${promo.minSpending.toFixed(2)}
                              </span>
                            </p>
                          )}
                          {promo.rate != null && promo.rate !== 0 && (
                            <p>
                              Rate:{" "}
                              <span className="font-medium">
                                {promo.rate * 100} extra pts per $1
                              </span>
                            </p>
                          )}
                          {promo.points != null && promo.points !== 0 && (
                            <p>
                              Bonus points:{" "}
                              <span className="font-medium">
                                {promo.points} pts
                              </span>
                            </p>
                          )}
                        </div>
                      </div>

                    <div className="flex flex-col items-end gap-2">

                    {/*  edit is disabled if promotion has ended */}
                    <Link
                        to={hasEnded ? "#" : `/promotions/edit/${promo.id}`}
                        onClick={(e) => {
                        if (hasEnded) e.preventDefault();
                        }}
                        className={
                        "px-3 py-1.5 rounded-xl border text-xs " +
                        (hasEnded
                            ? "border-gray-100 text-gray-300 cursor-not-allowed pointer-events-none"
                            : "border-gray-200 text-gray-700 hover:bg-gray-50")
                        }
                        title={
                        hasEnded
                            ? "Cannot edit a promotion that has already ended."
                            : "Edit this promotion"
                        }
                    >
                        Edit
                    </Link>

                    {/* delete is disabled if promotion has started */}
                    <button
                        type="button"
                        onClick={() => handleDelete(promo.id)}
                        disabled={hasStarted}
                        className={
                        "px-3 py-1.5 rounded-xl border text-xs " +
                        (hasStarted
                            ? "border-gray-100 text-gray-300 cursor-not-allowed"
                            : "border-red-200 text-red-600 hover:bg-red-50")
                        }
                        title={
                        hasStarted
                            ? "Cannot delete a promotion that has already started."
                            : "Delete this promotion"
                        }
                    >
                        Delete
                    </button>
                    </div>

                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Pagination */}
            <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
              <div className="text-gray-500">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                  className={`px-3 py-1.5 rounded-xl border text-sm ${
                    page <= 1
                      ? "border-gray-100 text-gray-300 cursor-not-allowed"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages}
                  className={`px-3 py-1.5 rounded-xl border text-sm ${
                    page >= totalPages
                      ? "border-gray-100 text-gray-300 cursor-not-allowed"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
