import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "automatic", label: "Automatic" },
  { value: "one-time", label: "One-time" },
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
  if (type === "one-time")
    return "bg-purple-50 text-purple-700 border-purple-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
}

function getPromotionStatus(startTime, endTime) {
  if (!startTime && !endTime) return "";
  const now = new Date();
  const start = startTime ? new Date(startTime) : null;
  const end = endTime ? new Date(endTime) : null;

  if (start && now < start) return "Not started yet";
  if (end && now > end) return "Ended";
  return "Active";
}

export default function CashierPromotions() {
  const { token } = useAuth();

  const [promotions, setPromotions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [nameFilter, setNameFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

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
  }, [token, nameFilter, typeFilter, page, limit]);

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const startIndex = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const endIndex = Math.min(totalCount, page * limit);

  function handleClearFilters() {
    setNameFilter("");
    setTypeFilter("");
    setPage(1);
  }

  function handlePageChange(newPage) {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  }

  return (
    <div className="page page-promotions px-16">
      {/* Header */}
      <div className="page-header flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold mb-1">Promotions</h1>
        </div>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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

          {/* Page size */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Rows per page
            </label>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
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
        ) : promotions.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500 text-sm">
            No promotions available.
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-semibold">Available Promotions</h2>
              <span className="text-xs text-gray-500">
                Showing {startIndex}–{endIndex} of {totalCount}
              </span>
            </div>

            <ul className="divide-y divide-gray-100">
              {promotions.map((promo) => (
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
                          {promo.type === "automatic" ? "Automatic" : "One-time"}
                        </span>
                        <span className="text-xs text-gray-400">
                          ID #{promo.id}
                        </span>
                      </div>

                      <h3 className="text-sm font-semibold text-gray-900">
                        {promo.name}
                      </h3>

                      {promo.endTime && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Ends: {formatDateTime(promo.endTime)}
                        </p>
                      )}

                      <p className="text-xs text-gray-500 mt-1">
                        Status:{" "}
                        <span className="font-medium">
                          {getPromotionStatus(promo.startTime, promo.endTime)}
                        </span>
                      </p>

                      <div className="mt-1 space-y-0.5 text-xs text-gray-500">
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
                  </div>
                </li>
              ))}
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
