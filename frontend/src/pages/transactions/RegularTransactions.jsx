// src/pages/transactions/UserTransactions.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "purchase", label: "Purchase" },
  { value: "redemption", label: "Redemption" },
  { value: "transfer", label: "Transfer" },
  { value: "adjustment", label: "Adjustment" },
  { value: "event", label: "Event" },
];

const PAGE_SIZE_OPTIONS = [5, 10, 20];

export default function UserTransactions() {
  const { token, user } = useAuth();

// set the poitns balance and verification status, to be used in creating transactions
  const [pointsBalance, setPointsBalance] = useState(user?.points ?? 0);

  const isVerified =
    user?.verified ?? false;

  // Current state of page
  const [transactions, setTransactions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // filters
  const [type, setType] = useState("");
  const [relatedId, setRelatedId] = useState("");
  const [promotionId, setPromotionId] = useState("");
  const [amount, setAmount] = useState("");
  const [operator, setOperator] = useState("gte");

  // sort
  const [sortBy, setSortBy] = useState("newest");

  // pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // mappings from id to name for use in UI
  const [eventNameMap, setEventNameMap] = useState({});
  const [userMap, setUserMap] = useState({});

  // reload after a trasnfer or redemption
  const [reloadKey, setReloadKey] = useState(0);

  // usestate for modals for transfering or redeeming points
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);

  // transfer form state
  const [transferRecipientUtorid, setTransferRecipientUtorid] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferRemark, setTransferRemark] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState("");
  const [transferSuccess, setTransferSuccess] = useState("");

  // redeem form state
  const [redeemAmount, setRedeemAmount] = useState("");
  const [redeemRemark, setRedeemRemark] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemError, setRedeemError] = useState("");
  const [redeemSuccess, setRedeemSuccess] = useState("");

  // global action messages
  const [actionMessage, setActionMessage] = useState("");

  // update the points balance when needed
    useEffect(() => {
        setPointsBalance(user?.points ?? 0);
    }, [user]);


  // Get all transactions for the current user
  useEffect(() => {
    if (!token) return;

    async function fetchTransactions() {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams();

        if (type) params.append("type", type);

        // relatedId must be used with a type
        if (type && relatedId.trim() !== "") {
          params.append("relatedId", relatedId.trim());
        }

        if (promotionId.trim() !== "") {
          params.append("promotionId", promotionId.trim());
        }

        if (amount.trim() !== "") {
          params.append("amount", amount.trim());
          params.append("operator", operator);
        }

        params.append("page", String(page));
        params.append("limit", String(limit));

        const url = `${API_BASE_URL}/users/me/transactions?${params.toString()}`;

        const res = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch transactions (status ${res.status})`);
        }

        const data = await res.json();
        setTransactions(data.results || []);
        setTotalCount(data.count ?? 0);
      } catch (err) {
        console.error("Error fetching user transactions:", err);
        setError("Unable to load transactions. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchTransactions();

  }, [
    token,
    type,
    relatedId,
    promotionId,
    amount,
    operator,
    page,
    limit,
    reloadKey,
  ]);

  // Get event names and utorids into a dictionary for UI use
  useEffect(() => {
    if (!token || transactions.length === 0) return;

    const eventIds = new Set();
    const userIds = new Set();

    for (const tx of transactions) {
      if (tx.type === "event" && tx.relatedId != null) {
        eventIds.add(String(tx.relatedId));
      }
      if (
        (tx.type === "transfer" || tx.type === "redemption") &&
        tx.relatedId != null
      ) {
        userIds.add(String(tx.relatedId));
      }
    }

    async function fetchEventsAndUsers() {
      // events
      await Promise.all(
        Array.from(eventIds)
          .filter((id) => eventNameMap[id] === undefined)
          .map(async (id) => {
            try {
              const res = await fetch(`${API_BASE_URL}/events/${id}`, {
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
              });

              if (!res.ok) {
                // mark as inaccessible if 403/404
                if (res.status === 403 || res.status === 404) {
                  setEventNameMap((prev) => ({ ...prev, [id]: null }));
                }
                return;
              }

              const data = await res.json();
              setEventNameMap((prev) => ({ ...prev, [id]: data.name }));
            } catch (e) {
              console.error("Failed to fetch event", id, e);
            }
          })
      );

      // users 
      await Promise.all(
        Array.from(userIds)
          .filter((id) => userMap[id] === undefined)
          .map(async (id) => {
            try {
              const res = await fetch(`${API_BASE_URL}/users/${id}`, {
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
              });
              if (!res.ok) return;
              const data = await res.json();
              setUserMap((prev) => ({ ...prev, [id]: data.utorid }));
            } catch (e) {
              console.error("Failed to fetch user", id, e);
            }
          })
      );
    }

    fetchEventsAndUsers();
  }, [transactions, token, eventNameMap, userMap]);

  // Sort the transactions based on the filters
  const sortedTransactions = useMemo(() => {
    const copy = [...transactions];

    if (sortBy === "newest") {
      copy.sort((a, b) => b.id - a.id);
    } else if (sortBy === "oldest") {
      copy.sort((a, b) => a.id - b.id);
    } else if (sortBy === "amount-desc") {
      copy.sort((a, b) => b.amount - a.amount);
    } else if (sortBy === "amount-asc") {
      copy.sort((a, b) => a.amount - b.amount);
    }
    return copy;
  }, [transactions, sortBy]);

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const startIndex = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const endIndex = Math.min(totalCount, page * limit);

  function handleClearFilters() {
    setType("");
    setRelatedId("");
    setPromotionId("");
    setAmount("");
    setOperator("gte");
    setPage(1);
  }

  function handlePageChange(newPage) {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  }

  // Helper functions

  function formatType(t) {
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function getTypeBadgeClass(t) {
    switch (t) {
      case "purchase":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "redemption":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "transfer":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "adjustment":
        return "bg-red-50 text-red-700 border-red-200";
      case "event":
        return "bg-green-50 text-green-700 border-green-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  }

  function getAmountClass(amount) {
    if (amount > 0) return "text-green-600";
    if (amount < 0) return "text-pink-600";
    return "text-gray-700";
  }

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

  // Transaction total if it is a purchase
  function renderTransactionTotal(tx) {
    if (tx.type === "purchase" && tx.spent != null) {
      return `$${tx.spent.toFixed(2)}`;
    }
    return "n/a";
  }

  // Related info per type
  function renderRelatedInfo(tx) {
    const rid = tx.relatedId;

    // If its a redemption, show the ID for non processed, and the utorid of the proccessor when it is processed
    if (tx.type === "redemption" && rid == null) {
      return (
        <p className="text-xs text-gray-500 mt-0.5">
          Redemption status:{" "}
          <span className="font-medium">Not processed yet. Transaction ID: {tx.id}</span>
        </p>
      );
    }

    if (rid == null) {
      // for no related id, show nothing
      return null;
    }

    const ridStr = String(rid);

    if (tx.type === "event") {
      const eventName = eventNameMap[ridStr];

      if (eventName === null) {
        // known but inaccessible
        return (
          <p className="text-xs text-gray-500 mt-0.5">
            Event #{ridStr}{" "}
            <span className="text-gray-400">(no longer accessible)</span>
          </p>
        );
      }

      const title = eventName || `Event #${ridStr}`;

      if (eventName) {
        return (
          <p className="text-xs text-gray-500 mt-0.5">
            Event:{" "}
            <Link
              to={`/events/${ridStr}`}
              className="text-pink-600 hover:underline font-medium"
            >
              {title}
            </Link>
          </p>
        );
      }

      // fallback, no name yet
      return (
        <p className="text-xs text-gray-500 mt-0.5">
          Event: {title}
        </p>
      );
    }

    if (tx.type === "adjustment") {
      return (
        <p className="text-xs text-gray-500 mt-0.5">
          Adjusting a previous transaction
        </p>
      );
    }


    if (tx.type === "redemption") {
      const cashierUtorid = userMap[ridStr];
      return (
        <p className="text-xs text-gray-500 mt-0.5">
          Redemption status:{" "}
          {cashierUtorid ? (
            <>
              Processed by{" "}
              <span className="font-medium">{cashierUtorid}</span>
            </>
          ) : (
            <span className="font-medium">Processed</span>
          )}
        </p>
      );
    }

    return null;
  }

  // handling open and close for popups

  function openTransferModal() {
    if (!isVerified) {
      setActionMessage("Please verify your account first.");
      return;
    }
    setActionMessage("");
    setTransferError("");
    setTransferSuccess("");
    setShowTransferModal(true);
  }

  function openRedeemModal() {
    if (!isVerified) {
      setActionMessage("Please verify your account first.");
      return;
    }
    setActionMessage("");
    setRedeemError("");
    setRedeemSuccess("");
    setShowRedeemModal(true);
  }

  function closeTransferModal() {
    setShowTransferModal(false);
  }

  function closeRedeemModal() {
    setShowRedeemModal(false);
  }

  // handle submit for transfer or redeem points

  async function handleSubmitTransfer(e) {
    e.preventDefault();
    if (!token) return;

    setTransferError("");
    setTransferSuccess("");

    const utorid = transferRecipientUtorid.trim();
    const amt = Number(transferAmount);

    if (!utorid) {
      setTransferError("Please enter a recipient UTORid.");
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0 || !Number.isInteger(amt)) {
      setTransferError("Amount must be a positive integer.");
      return;
    }

    try {
      setTransferLoading(true);

      // NOTE: assuming /users/:userId uses UTORid; if it expects numeric id, adjust this.
      const res = await fetch(
        `${API_BASE_URL}/users/${encodeURIComponent(utorid)}/transactions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type: "transfer",
            amount: amt,
            remark: transferRemark.trim() || undefined,
          }),
        }
      );

      if (!res.ok) {
        if (res.status === 400) {
          setTransferError(
            "You don't have enough points to complete this transfer."
          );
          return;
        }
        if (res.status === 403) {
          setTransferError("Please verify your account first.");
          return;
        }
        const text = await res.text();
        console.error("Transfer failed:", res.status, text);
        setTransferError("Failed to create transfer. Please try again.");
        return;
      }

      const data = await res.json();

      setTransferSuccess(
        `Transfer created successfully (Transaction ID #${data.id ?? "?"}).`
      );
      // refresh transactions
      setReloadKey((k) => k + 1);
      // reset form
      setTransferAmount("");
      setTransferRemark("");
      // keep recipient filled for repeated transfers, or clear if you prefer:
      // setTransferRecipientUtorid("");

      // close modal after short delay, or immediately:
      closeTransferModal();
      setActionMessage("Transfer created successfully.");
    } catch (err) {
      console.error(err);
      setTransferError("Failed to create transfer. Please try again.");
    } finally {
      setTransferLoading(false);
    }
  }

  async function handleSubmitRedeem(e) {
    e.preventDefault();
    if (!token) return;

    setRedeemError("");
    setRedeemSuccess("");

    const amt = Number(redeemAmount);

    if (!Number.isFinite(amt) || amt <= 0 || !Number.isInteger(amt)) {
      setRedeemError("Amount must be a positive integer.");
      return;
    }

    try {
      setRedeemLoading(true);

      const res = await fetch(`${API_BASE_URL}/users/me/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: "redemption",
          amount: amt,
          remark: redeemRemark.trim() || undefined,
        }),
      });

      if (!res.ok) {
        if (res.status === 400) {
          setRedeemError(
            "You cannot redeem more points than your current balance."
          );
          return;
        }
        if (res.status === 403) {
          setRedeemError("Please verify your account first.");
          return;
        }
        const text = await res.text();
        console.error("Redemption failed:", res.status, text);
        setRedeemError("Failed to create redemption request. Please try again.");
        return;
      }

      const data = await res.json();

      setRedeemSuccess(
        `Redemption request created (Transaction ID #${data.id ?? "?"}).`
      );
      // refresh transactions
      setReloadKey((k) => k + 1);
      // reset form
      setRedeemAmount("");
      setRedeemRemark("");

      closeRedeemModal();
      setActionMessage(
        "Redemption request created. A cashier must process it to complete redemption."
      );
    } catch (err) {
      console.error(err);
      setRedeemError("Failed to create redemption request. Please try again.");
    } finally {
      setRedeemLoading(false);
    }
  }


  return (
    <div className="page page-transactions md:px-16">
      {/* Header */}
      <div className="page-header flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold mb-1">Transactions</h1>
          <p className="text-sm text-gray-500">
            Viewing past transactions for{" "}
            <strong>{user?.utorid ?? "your account"}</strong>
          </p>
        </div>
      </div>

      {/* Points balance and actions */}
      <div className="card mb-4 p-6 rounded-2xl bg-white shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">Points balance</p>
          <p className="text-3xl font-semibold text-pink-600">
            {Number(pointsBalance).toLocaleString()} pts
          </p>
          {!isVerified && (
            <p className="text-xs text-orange-600 mt-1">
              You must verify your account before transferring or redeeming
              points.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={openTransferModal}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-pink-200 text-pink-700 hover:bg-pink-50"
          >
            Transfer points
          </button>
          <button
            type="button"
            onClick={openRedeemModal}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-pink-600 text-white hover:bg-pink-700"
          >
            Redeem points
          </button>
        </div>
      </div>

      {/* Global action message */}
      {actionMessage && (
        <div className="mb-4 text-xs text-blue-700 bg-blue-50 border border-blue-100 px-4 py-2 rounded-xl">
          {actionMessage}
        </div>
      )}

      {/* Error from fetching transactions */}
      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-2 rounded-xl">
          {error}
        </div>
      )}

      {/* Filters Card */}
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
          {/* Type */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Transaction Type
            </label>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
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

          {/* Related ID */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Related ID
            </label>
            <input
              type="text"
              value={relatedId}
              onChange={(e) => {
                setRelatedId(e.target.value);
                setPage(1);
              }}
              placeholder="Must be used with type"
              disabled={!type}
              className={`w-full rounded-xl border px-3 py-2 text-sm ${
                type
                  ? "border-gray-200 bg-white"
                  : "border-gray-100 bg-gray-50 text-gray-400"
              }`}
            />
          </div>

          {/* Promotion ID */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Promotion ID
            </label>
            <input
              type="text"
              value={promotionId}
              onChange={(e) => {
                setPromotionId(e.target.value);
                setPage(1);
              }}
              placeholder="e.g. 5"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </div>

          {/* Amount and operator */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Amount Filter
            </label>
            <div className="flex gap-2">
              <select
                value={operator}
                onChange={(e) => {
                  setOperator(e.target.value);
                  setPage(1);
                }}
                className="w-24 rounded-xl border border-gray-200 px-2 py-2 text-sm bg-white"
              >
                <option value="gte">≥</option>
                <option value="lte">≤</option>
              </select>
              <input
                type="text"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setPage(1);
                }}
                placeholder="Points"
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Sort and page size */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Order by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-1.5 text-sm bg-white"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="amount-desc">Points (high → low)</option>
              <option value="amount-asc">Points (low → high)</option>
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

      {/* Transactions List */}
      <div className="card p-0 rounded-2xl bg-white shadow-sm">
        {loading ? (
          <div className="px-6 py-8 text-center text-gray-500 text-sm">
            Loading transactions...
          </div>
        ) : sortedTransactions.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500 text-sm">
            No transactions found.
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-semibold">Past Transactions</h2>
              <span className="text-xs text-gray-500">
                Showing {startIndex}–{endIndex} of {totalCount}
              </span>
            </div>

            <ul className="divide-y divide-gray-100">
              {sortedTransactions.map((tx) => (
                <li key={tx.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={
                            "inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium " +
                            getTypeBadgeClass(tx.type)
                          }
                        >
                          {formatType(tx.type)}
                        </span>
                      </div>

                      {tx.createdAt && (
                        <p className="text-xs text-gray-400 mb-0.5">
                          {formatDateTime(tx.createdAt)}
                        </p>
                      )}

                      {tx.remark && (
                        <p className="text-sm text-gray-800 mb-0.5">
                          {tx.remark}
                        </p>
                      )}

                      <p className="text-xs text-gray-500">
                        Created by{" "}
                        <span className="font-medium">{tx.createdBy}</span>
                      </p>

                      {/* Related info */}
                      {renderRelatedInfo(tx)}

                      {/* Promotions */}
                      {Array.isArray(tx.promotionIds) &&
                        tx.promotionIds.length > 0 && (
                          <p className="mt-0.5 text-xs text-gray-500">
                            Promotions: {tx.promotionIds.join(", ")}
                          </p>
                        )}

                      {/* Transaction total */}
                      {tx.type == "purchase" ?
                      <p className="mt-0.5 text-xs text-gray-500">
                        Transaction total:{" "}
                        <span className="font-medium">
                          {renderTransactionTotal(tx)}
                        </span>
                      </p>
                      : <></>
                      }
                      
                    </div>

                    <div className="text-right">
                      <div
                        className={
                          "text-base font-semibold " + getAmountClass(tx.amount)
                        }
                      >
                        {tx.amount > 0 ? "+" : ""}
                        {tx.amount} pts
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {(tx.type == 'purchase' || tx.type == 'event') ?
                            "Points earned"
                            : tx.type == 'transfer' ?
                            (tx.amount > 0 ?
                            "Points received" :
                            "Points sent"
                            ) : tx.type == 'adjustment' ?
                            "Points adjusted" 
                            : (tx.relatedId ? "Points redeemed" : "Points awaiting redemption")
                        }
                      </p>
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

      {/* TRANSFER MODAL */}
      {showTransferModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Transfer points</h2>
              <button
                type="button"
                onClick={closeTransferModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {transferError && (
              <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">
                {transferError}
              </div>
            )}
            {transferSuccess && (
              <div className="mb-3 text-xs text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded-xl">
                {transferSuccess}
              </div>
            )}

            <form onSubmit={handleSubmitTransfer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Recipient UTORid
                </label>
                <input
                  type="text"
                  value={transferRecipientUtorid}
                  onChange={(e) =>
                    setTransferRecipientUtorid(e.target.value)
                  }
                  placeholder="e.g. friend69"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Points to transfer
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Message (optional)
                </label>
                <textarea
                  rows={2}
                  value={transferRemark}
                  onChange={(e) => setTransferRemark(e.target.value)}
                  placeholder="Add a note for this transfer..."
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeTransferModal}
                  className="px-3 py-2 rounded-xl text-sm border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferLoading}
                  className={`px-4 py-2 rounded-xl text-sm font-medium ${
                    transferLoading
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-pink-600 text-white hover:bg-pink-700"
                  }`}
                >
                  {transferLoading ? "Transferring..." : "Confirm transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REDEEM MODAL */}
      {showRedeemModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Redeem points</h2>
              <button
                type="button"
                onClick={closeRedeemModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {redeemError && (
              <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">
                {redeemError}
              </div>
            )}
            {redeemSuccess && (
              <div className="mb-3 text-xs text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded-xl">
                {redeemSuccess}
              </div>
            )}

            <form onSubmit={handleSubmitRedeem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Points to redeem
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={redeemAmount}
                  onChange={(e) => setRedeemAmount(e.target.value)}
                  placeholder="e.g. 1000"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Note (optional)
                </label>
                <textarea
                  rows={2}
                  value={redeemRemark}
                  onChange={(e) => setRedeemRemark(e.target.value)}
                  placeholder="Add a note for this redemption..."
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>

              <p className="text-xs text-gray-500">
                This creates a redemption request. A cashier must process it
                before your balance actually changes.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeRedeemModal}
                  className="px-3 py-2 rounded-xl text-sm border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={redeemLoading}
                  className={`px-4 py-2 rounded-xl text-sm font-medium ${
                    redeemLoading
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-pink-600 text-white hover:bg-pink-700"
                  }`}
                >
                  {redeemLoading ? "Submitting..." : "Create request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
