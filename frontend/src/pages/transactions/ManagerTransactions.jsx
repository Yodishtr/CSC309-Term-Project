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

const SUSPICIOUS_OPTIONS = [
  { value: "", label: "Any" },
  { value: "true", label: "Suspicious only" },
  { value: "false", label: "Non-suspicious" },
];

const PAGE_SIZE_OPTIONS = [5, 10, 20];

export default function ManagerTransactions() {
  const { token, user } = useAuth();

  const isManagerOrHigher =
    user?.role === "manager" || user?.role === "superuser";

  const isCashierOrHigher =
    user?.role === "cashier" ||
    user?.role === "manager" ||
    user?.role === "superuser";

  // List and filters 
  const [transactions, setTransactions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");

  // filters
  const [nameOrUtorid, setNameOrUtorid] = useState("");
  const [createdByFilter, setCreatedByFilter] = useState("");
  const [suspiciousFilter, setSuspiciousFilter] = useState("");
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

  const [eventNameMap, setEventNameMap] = useState({});
  const [userMap, setUserMap] = useState({});
  const [utoridToIdMap, setUtoridToIdMap] = useState({});


  // Global message 
  const [globalMessage, setGlobalMessage] = useState("");

  // Cashier modals
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [customerUtorid, setCustomerUtorid] = useState("");
  const [purchaseSpent, setPurchaseSpent] = useState("");
  const [purchaseRemark, setPurchaseRemark] = useState("");
  const [purchasePromotionInput, setPurchasePromotionInput] = useState("");
  const [purchasePromotionIds, setPurchasePromotionIds] = useState([]);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");
  const [purchaseSuccess, setPurchaseSuccess] = useState("");
  const [createdPurchase, setCreatedPurchase] = useState(null);

  const [showRedemptionModal, setShowRedemptionModal] = useState(false);
  const [redemptionId, setRedemptionId] = useState("");
  const [redemptionLoading, setRedemptionLoading] = useState(false);
  const [redemptionError, setRedemptionError] = useState("");
  const [redemptionSuccess, setRedemptionSuccess] = useState("");
  const [processedRedemption, setProcessedRedemption] = useState(null);

  // Adjustment modal
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustTargetTx, setAdjustTargetTx] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustRemark, setAdjustRemark] = useState("");
  const [adjustPromotionInput, setAdjustPromotionInput] = useState("");
  const [adjustPromotionIds, setAdjustPromotionIds] = useState([]);
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState("");
  const [adjustSuccess, setAdjustSuccess] = useState("");
  const [createdAdjustment, setCreatedAdjustment] = useState(null);

  function resetGlobalMessage() {
    setGlobalMessage("");
  }

  // Fetch ALL transactions
  useEffect(() => {
    if (!token) return;

    async function fetchTransactions() {
      try {
        setLoading(true);
        setListError("");

        const params = new URLSearchParams();

        if (nameOrUtorid.trim() !== "") {
          params.append("name", nameOrUtorid.trim());
        }
        if (createdByFilter.trim() !== "") {
          params.append("createdBy", createdByFilter.trim());
        }
        if (suspiciousFilter) {
          params.append("suspicious", suspiciousFilter);
        }

        if (type) params.append("type", type);

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

        const url = `${API_BASE_URL}/transactions?${params.toString()}`;

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
        setTransactions(data.results);
        setTotalCount(data.count ?? 0);
      } catch (err) {
        console.error("Error fetching transactions:", err);
        setListError("Unable to load transactions. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchTransactions();
  }, [
    token,
    nameOrUtorid,
    createdByFilter,
    suspiciousFilter,
    type,
    relatedId,
    promotionId,
    amount,
    operator,
    page,
    limit,
  ]);


  // Logic for changing suspicious status
  async function handleToggleSuspicious(tx) {
  if (!token) return;
  if (!isManagerOrHigher) {
    setGlobalMessage("Only managers or superusers can change suspicious status.");
    return;
  }

  const newValue = !tx.suspicious;

  try {
    const res = await fetch(
      `${API_BASE_URL}/transactions/${tx.id}/suspicious`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ suspicious: newValue }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("Toggle suspicious failed:", res.status, text);
      setGlobalMessage("Failed to update suspicious status.");
      return;
    }

    const data = await res.json(); 

    setTransactions((prev) =>
      prev.map((t) =>
        t.id === tx.id ? { ...t, suspicious: data.suspicious ?? newValue } : t
      )
    );

    setGlobalMessage(
      `Transaction #${tx.id} marked as ${
        newValue ? "suspicious" : "not suspicious"
      }.`
    );
  } catch (err) {
    console.error(err);
    setGlobalMessage("Failed to update suspicious status.");
  }
}


  // Fetch event names and user utorids for related info
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
                if (res.status === 403 || res.status === 404) {
                  setEventNameMap((prev) => ({ ...prev, [id]: null }));
                }
                return;
              }

              const data = await res.json();
              setEventNameMap((prev) => ({
                ...prev,
                [id]: data.name,
              }));
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
              setUtoridToIdMap((prev) => ({ ...prev, [data.utorid]: id }));

            } catch (e) {
              console.error("Failed to fetch user", id, e);
            }
          })
      );
    }

    fetchEventsAndUsers();
  }, [transactions, token, eventNameMap, userMap]);

  // Sorting
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

  console.log("sorted", sortedTransactions)

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const startIndex = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const endIndex = Math.min(totalCount, page * limit);

  function handleClearFilters() {
    setNameOrUtorid("");
    setCreatedByFilter("");
    setSuspiciousFilter("");
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

  // Helpers

  function formatType(t) {
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
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

  // Transaction total
  function renderTransactionTotal(tx) {
    if (tx.type === "purchase" && tx.spent != null) {
      return `$${tx.spent.toFixed(2)}`;
    }
    if (tx.type === "redemption" && tx.redeemed != null) {
      return `${tx.redeemed} pts`;
    }
    return "—";
  }

  function renderRelatedInfo(tx) {
    const rid = tx.relatedId;

    // Redemption
    if (tx.type === "redemption" && rid == null) {
      return (
        <p className="text-xs text-gray-500 mt-0.5">
          Redemption status:{" "}
          <span className="font-medium">
            Not processed yet. Transaction ID:{" "}
            <span className="font-semibold">{tx.id}</span>
          </span>
        </p>
      );
    }

    if (rid == null) {
      return null;
    }

    const ridStr = String(rid);

    if (tx.type === "event") {
      const eventName = eventNameMap[ridStr];

      if (eventName === null) {
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

      return (
        <p className="text-xs text-gray-500 mt-0.5">
          Event: {title}
        </p>
      );
    }

    if (tx.type === "adjustment") {
      return (
        <p className="text-xs text-gray-500 mt-0.5">
          Adjusting Transaction #{ridStr}
        </p>
      );
    }

    if (tx.type === "transfer") {
      const otherUtorid = userMap[ridStr] || `User #${ridStr}`;
      const direction = tx.amount < 0 ? "To" : "From";
      return (
        <p className="text-xs text-gray-500 mt-0.5">
          {direction} <span className="font-medium">{otherUtorid}</span>
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

  // Cashier actions: open and close modals

  function openPurchaseModal() {
    resetGlobalMessage();
    setPurchaseError("");
    setPurchaseSuccess("");

    if (!isCashierOrHigher) {
      setGlobalMessage(
        "You must be a cashier, manager, or superuser to create purchases."
      );
      return;
    }
    setShowPurchaseModal(true);
  }

  function closePurchaseModal() {
    setShowPurchaseModal(false);
  }

  function openRedemptionModal() {
    resetGlobalMessage();
    setRedemptionError("");
    setRedemptionSuccess("");

    if (!isCashierOrHigher) {
      setGlobalMessage(
        "You must be a cashier, manager, or superuser to process redemptions."
      );
      return;
    }
    setShowRedemptionModal(true);
  }

  function closeRedemptionModal() {
    setShowRedemptionModal(false);
  }

  // Purchase promotions helpers

  function addPurchasePromotionId() {
    setPurchaseError("");
    setPurchaseSuccess("");

    const trimmed = purchasePromotionInput.trim();
    if (!trimmed) return;

    const idNum = Number(trimmed);
    if (!Number.isInteger(idNum) || idNum < 0) {
      setPurchaseError("Promotion ID must be a non-negative integer.");
      return;
    }

    if (purchasePromotionIds.includes(idNum)) {
      setPurchaseError("This promotion ID has already been added.");
      return;
    }

    setPurchasePromotionIds((prev) => [...prev, idNum]);
    setPurchasePromotionInput("");
  }

  function removePurchasePromotionId(id) {
    setPurchaseError("");
    setPurchaseSuccess("");
    setPurchasePromotionIds((prev) => prev.filter((p) => p !== id));
  }

  // Submit a purchase
  async function handleSubmitPurchase(e) {
    e.preventDefault();
    setPurchaseError("");
    setPurchaseSuccess("");
    resetGlobalMessage();
    setCreatedPurchase(null);

    if (!token) {
      setPurchaseError("You are not logged in.");
      return;
    }
    if (!isCashierOrHigher) {
      setPurchaseError(
        "You do not have permission to create purchase transactions."
      );
      return;
    }

    const utorid = customerUtorid.trim();
    const spentNum = Number(purchaseSpent);

    if (!utorid) {
      setPurchaseError("Customer UTORid is required.");
      return;
    }
    if (!Number.isFinite(spentNum) || spentNum <= 0) {
      setPurchaseError("Amount spent must be a positive number.");
      return;
    }

    try {
      setPurchaseLoading(true);

      const body = {
        utorid,
        type: "purchase",
        spent: spentNum,
      };

      if (purchaseRemark.trim()) {
        body.remark = purchaseRemark.trim();
      }
      if (purchasePromotionIds.length > 0) {
        body.promotionIds = purchasePromotionIds;
      }

      const res = await fetch(`${API_BASE_URL}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        if (res.status === 404) {
          setPurchaseError("Customer not found. Please check the UTORid.");
          return;
        }
        if (res.status === 400) {
          setPurchaseError(
            "Unable to create purchase. One or more promotion IDs may be invalid, expired, or already used."
          );
          return;
        }
        const text = await res.text();
        console.error("Purchase creation failed:", res.status, text);
        setPurchaseError(
          "Failed to create purchase transaction. Please try again."
        );
        return;
      }

      const data = await res.json();
      setCreatedPurchase(data);
      setPurchaseSuccess(
        `Purchase created successfully. Customer earned ${data.earned ?? 0} pts.`
      );

      setPurchaseSpent("");
      setPurchaseRemark("");
      setPurchasePromotionIds([]);
      setPurchasePromotionInput("");

      setShowPurchaseModal(false);
      setGlobalMessage(
        `Purchase created for ${data.utorid}. Earned ${data.earned ?? 0} pts.`
      );
    } catch (err) {
      console.error(err);
      setPurchaseError(
        "Failed to create purchase transaction. Please try again."
      );
    } finally {
      setPurchaseLoading(false);
    }
  }

  // Submit a redemption 
  async function handleSubmitRedemption(e) {
    e.preventDefault();
    setRedemptionError("");
    setRedemptionSuccess("");
    resetGlobalMessage();
    setProcessedRedemption(null);

    if (!token) {
      setRedemptionError("You are not logged in.");
      return;
    }
    if (!isCashierOrHigher) {
      setRedemptionError(
        "You do not have permission to process redemption transactions."
      );
      return;
    }

    const trimmedId = redemptionId.trim();
    if (!trimmedId) {
      setRedemptionError("Please enter a transaction ID.");
      return;
    }

    try {
      setRedemptionLoading(true);

      const res = await fetch(
        `${API_BASE_URL}/transactions/${encodeURIComponent(
          trimmedId
        )}/processed`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ processed: true }),
        }
      );

      if (!res.ok) {
        if (res.status === 400) {
          setRedemptionError(
            "Unable to process this transaction. It may not be a redemption or has already been processed."
          );
          return;
        }
        const text = await res.text();
        console.error("Process redemption failed:", res.status, text);
        setRedemptionError(
          "Failed to process redemption request. Please try again."
        );
        return;
      }

      const data = await res.json();
      setProcessedRedemption(data);
      setRedemptionSuccess(
        `Redemption processed successfully for ${data.utorid}. Redeemed ${
          data.redeemed ?? data.amount ?? "?"
        } pts.`
      );

      setRedemptionId("");
      setShowRedemptionModal(false);
      setGlobalMessage(
        `Redemption transaction #${data.id} processed. ${
          data.redeemed ?? "Points"
        } deducted from user balance.`
      );
    } catch (err) {
      console.error(err);
      setRedemptionError(
        "Failed to process redemption request. Please try again."
      );
    } finally {
      setRedemptionLoading(false);
    }
  }

  // Adjustment actions 

  function openAdjustmentModalFor(tx) {
    resetGlobalMessage();
    setAdjustError("");
    setAdjustSuccess("");
    setCreatedAdjustment(null);

    if (!isManagerOrHigher) {
      setGlobalMessage("Only managers or superusers can create adjustments.");
      return;
    }

    setAdjustTargetTx(tx);
    setAdjustAmount("");
    setAdjustRemark("");
    setAdjustPromotionIds([]);
    setAdjustPromotionInput("");
    setShowAdjustmentModal(true);
  }

  function closeAdjustmentModal() {
    setShowAdjustmentModal(false);
  }

  function addAdjustPromotionId() {
    setAdjustError("");
    setAdjustSuccess("");

    const trimmed = adjustPromotionInput.trim();
    if (!trimmed) return;

    const idNum = Number(trimmed);
    if (!Number.isInteger(idNum) || idNum < 0) {
      setAdjustError("Promotion ID must be a non-negative integer.");
      return;
    }

    if (adjustPromotionIds.includes(idNum)) {
      setAdjustError("This promotion ID has already been added.");
      return;
    }

    setAdjustPromotionIds((prev) => [...prev, idNum]);
    setAdjustPromotionInput("");
  }

  function removeAdjustPromotionId(id) {
    setAdjustError("");
    setAdjustSuccess("");
    setAdjustPromotionIds((prev) => prev.filter((p) => p !== id));
  }

  // Submit: create adjustment 
  async function handleSubmitAdjustment(e) {
    e.preventDefault();
    setAdjustError("");
    setAdjustSuccess("");
    resetGlobalMessage();
    setCreatedAdjustment(null);

    if (!token) {
      setAdjustError("You are not logged in.");
      return;
    }
    if (!isManagerOrHigher) {
      setAdjustError("Only managers or superusers can create adjustments.");
      return;
    }

    if (!adjustTargetTx) {
      setAdjustError("No target transaction selected.");
      return;
    }

    const utorid = adjustTargetTx.utorid;
    const relatedId = adjustTargetTx.id;
    const amountNum = Number(adjustAmount);

    if (!Number.isFinite(amountNum) || amountNum === 0) {
      setAdjustError("Adjustment amount must be a non-zero number.");
      return;
    }

    try {
      setAdjustLoading(true);

      const body = {
        utorid,
        type: "adjustment",
        amount: amountNum,
        relatedId,
      };

      if (adjustRemark.trim()) {
        body.remark = adjustRemark.trim();
      }
      if (adjustPromotionIds.length > 0) {
        body.promotionIds = adjustPromotionIds;
      }

      const res = await fetch(`${API_BASE_URL}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        if (res.status === 404) {
          setAdjustError("User or related transaction not found.");
          return;
        }
        if (res.status === 400) {
          setAdjustError(
            "Unable to create adjustment. Please check the amount and promotions."
          );
          return;
        }
        const text = await res.text();
        console.error("Adjustment creation failed:", res.status, text);
        setAdjustError(
          "Failed to create adjustment transaction. Please try again."
        );
        return;
      }

      const data = await res.json();
      setCreatedAdjustment(data);
      setAdjustSuccess(
        `Adjustment created for ${data.utorid}: ${data.amount} pts (related to transaction #${data.relatedId}).`
      );

      setShowAdjustmentModal(false);
      setGlobalMessage(
        `Adjustment created: ${data.amount} pts for ${data.utorid} (transaction #${data.id}).`
      );
    } catch (err) {
      console.error(err);
      setAdjustError(
        "Failed to create adjustment transaction. Please try again."
      );
    } finally {
      setAdjustLoading(false);
    }
  }


  return (
    <div className="page page-transactions md:px-16">
      {/* Header */}
      <div className="page-header flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold mb-1">
            Manager – Transactions
          </h1>
          <p className="text-sm text-gray-500">
            Viewing all transactions. Logged in as{" "}
            <strong>{user?.utorid ?? user?.name ?? "manager"}</strong>.
          </p>
        </div>
      </div>

      {/* Role warning */}
      {!isManagerOrHigher && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-2 rounded-xl">
          You do not have manager permissions. Some actions on this page will be
          disabled.
        </div>
      )}

      {/* Global message */}
      {globalMessage && (
        <div className="mb-4 text-xs text-blue-700 bg-blue-50 border border-blue-100 px-4 py-2 rounded-xl">
          {globalMessage}
        </div>
      )}

      {/* Action buttons */}
      <div className="card p-4 rounded-2xl bg-white shadow-sm mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Manager actions</h2>
          <p className="text-xs text-gray-500">
            Create purchases, process redemption requests, and make adjustments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openPurchaseModal}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-pink-600 text-white hover:bg-pink-700"
          >
            Create purchase
          </button>
          <button
            type="button"
            onClick={openRedemptionModal}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-pink-200 text-pink-700 hover:bg-pink-50"
          >
            Process redemption request
          </button>
        </div>
      </div>

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
          {/* Name or utorid */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Customer name / UTORid
            </label>
            <input
              type="text"
              value={nameOrUtorid}
              onChange={(e) => {
                setNameOrUtorid(e.target.value);
                setPage(1);
              }}
              placeholder="Name or UTORid"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </div>

          {/* Created by */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Created by (UTORid)
            </label>
            <input
              type="text"
              value={createdByFilter}
              onChange={(e) => {
                setCreatedByFilter(e.target.value);
                setPage(1);
              }}
              placeholder="Cashier / creator UTORid"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </div>

          {/* Suspicious */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Suspicious
            </label>
            <select
              value={suspiciousFilter}
              onChange={(e) => {
                setSuspiciousFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
            >
              {SUSPICIOUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

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

      {/* Error */}
      {listError && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-2 rounded-xl">
          {listError}
        </div>
      )}

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
              <h2 className="text-base font-semibold">All Transactions</h2>
              <span className="text-xs text-gray-500">
                Showing {startIndex}–{endIndex} of {totalCount}
              </span>
            </div>

            <ul className="divide-y divide-gray-100">
              {sortedTransactions.map((tx) => 
              (
                <li key={tx.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={
                            "inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium " +
                            getTypeBadgeClass(tx.type)
                          }
                        >
                          {formatType(tx.type)}
                        </span>
                        <span className="text-xs text-gray-400">
                          Transaction #{tx.id}
                        </span>
                        {tx.suspicious && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[11px] font-semibold">
                            Suspicious
                          </span>
                        )}
                      </div>

                      {tx.date && (
                        <p className="text-xs text-gray-400 mb-0.5">
                          {formatDateTime(tx.date)}
                        </p>
                      )}

                      <p className="text-sm text-gray-500 mb-0.5">
                        Customer:{" "}
                        <Link className="font-medium hover:underline text-pink-600" to={`/users/${utoridToIdMap[tx.utorid]}`}>{tx.utorid}</Link>
                      </p>

                      {tx.remark && (
                        <p className="text-sm text-gray-800 mb-0.5">
                          {tx.remark}
                        </p>
                      )}

                      <p className="text-xs text-gray-500">
                        Created by{" "}
                        <Link className="font-medium text-pink-600 hover:underline" to={`/users/${utoridToIdMap[tx.createdBy]}`}>{tx.createdBy}</Link>
                      </p>

                      {tx.type == "event" ? 
                      <p className="text-xs text-gray-500">
                        Event ID:{" "}
                        <Link className="font-medium text-pink-600 hover:underline" to={`/events/${tx.eventId}`}>{tx.eventId}</Link>
                      </p>
                      : <></>
                      }

                      {/* Related info  */}
                      {renderRelatedInfo(tx)}

                      {/* Promotions */}
                      {Array.isArray(tx.promotionIds) &&
                        tx.promotionIds.length > 0 && (
                          <p className="mt-0.5 text-xs text-gray-500">
                            Promotions: {tx.promotionIds.join(", ")}
                          </p>
                        )}

                      {/* Transaction total */}
                      { tx.type == "purchase" ?
                        <p className="mt-0.5 text-xs text-gray-500">
                            Transaction total:{" "}
                            <span className="font-medium">
                            {renderTransactionTotal(tx)}
                            </span>
                        </p>
                        : <></>
                      }
                      

                      {/* Manager-only: Make adjustment */}
                      {isManagerOrHigher && (
                        <button
                          type="button"
                          onClick={() => openAdjustmentModalFor(tx)}
                          className="mt-2 inline-flex items-center px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          Make adjustment
                        </button>
                      )}
                      {isManagerOrHigher && (
                        <button
                            type="button"
                            onClick={() => handleToggleSuspicious(tx)}
                            className="mt-2 ml-2 inline-flex items-center px-3 py-1.5 rounded-xl border text-xs
                            border-red-200 text-red-700 hover:bg-red-50"
                        >
                            {tx.suspicious ? "Clear suspicious" : "Mark suspicious"}
                        </button>
                      )}
                    </div>

                    <div className="text-right">
                      <div
                        className={
                          "text-base font-semibold " +
                          getAmountClass(tx.points ?? 0)
                        }
                      >
                        {tx.redeemed ?? tx.sent ?? tx.received ?? tx.rewarded ?? tx.amount } pts
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {tx.type === "purchase"
                          ? "Points earned"
                          : tx.type === "redemption"
                          ? "Points redeemed"
                          : tx.type === "transfer"
                          ? ( tx.received ?
                            "Points received" :
                            "Points sent"
                            )
                          : tx.type === "adjustment"
                          ? "Adjustment"
                          : "Points earned"}
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

      {/* PURCHASE MODAL */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Create purchase</h2>
              <button
                type="button"
                onClick={closePurchaseModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {purchaseError && (
              <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">
                {purchaseError}
              </div>
            )}

            <form onSubmit={handleSubmitPurchase} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Customer UTORid
                </label>
                <input
                  type="text"
                  value={customerUtorid}
                  onChange={(e) => setCustomerUtorid(e.target.value)}
                  placeholder="e.g. johndoe1"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Amount spent ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={purchaseSpent}
                  onChange={(e) => setPurchaseSpent(e.target.value)}
                  placeholder="e.g. 19.99"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Base rate: 1 point per $0.25 (rounded), plus any valid
                  promotions. Automatic promotions are applied automatically.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  One-time promotions to apply
                </label>

                {purchasePromotionIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {purchasePromotionIds.map((id) => (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-pink-50 text-pink-700 border border-pink-200"
                      >
                        Promo #{id}
                        <button
                          type="button"
                          onClick={() => removePurchasePromotionId(id)}
                          className="text-pink-500 hover:text-pink-700"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={purchasePromotionInput}
                    onChange={(e) => setPurchasePromotionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addPurchasePromotionId();
                      }
                    }}
                    placeholder="Promotion ID, e.g. 42"
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={addPurchasePromotionId}
                    className="px-3 py-2 rounded-xl text-sm font-medium border border-pink-200 text-pink-700 hover:bg-pink-50"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Remark (optional)
                </label>
                <textarea
                  rows={2}
                  value={purchaseRemark}
                  onChange={(e) => setPurchaseRemark(e.target.value)}
                  placeholder="Any notes about this purchase..."
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closePurchaseModal}
                  className="px-3 py-2 rounded-xl text-sm border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={purchaseLoading}
                  className={`px-4 py-2 rounded-xl text-sm font-medium ${
                    purchaseLoading
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-pink-600 text-white hover:bg-pink-700"
                  }`}
                >
                  {purchaseLoading ? "Creating..." : "Create purchase"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REDEMPTION MODAL */}
      {showRedemptionModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Process redemption</h2>
              <button
                type="button"
                onClick={closeRedemptionModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {redemptionError && (
              <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">
                {redemptionError}
              </div>
            )}

            <form onSubmit={handleSubmitRedemption} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Redemption transaction ID
                </label>
                <input
                  type="text"
                  value={redemptionId}
                  onChange={(e) => setRedemptionId(e.target.value)}
                  placeholder="e.g. 124"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">
                  This is the transaction ID of the redemption request the user
                  created.
                </p>
              </div>

              <p className="text-xs text-gray-500">
                When you process a redemption, the user&apos;s points will be
                deducted and the transaction will be marked as completed.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeRedemptionModal}
                  className="px-3 py-2 rounded-xl text-sm border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={redemptionLoading}
                  className={`px-4 py-2 rounded-xl text-sm font-medium ${
                    redemptionLoading
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-pink-600 text-white hover:bg-pink-700"
                  }`}
                >
                  {redemptionLoading ? "Processing..." : "Process redemption"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADJUSTMENT MODAL */}
      {showAdjustmentModal && adjustTargetTx && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Make adjustment</h2>
              <button
                type="button"
                onClick={closeAdjustmentModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {adjustError && (
              <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">
                {adjustError}
              </div>
            )}

            <form onSubmit={handleSubmitAdjustment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Adjusting transaction
                </label>
                <p className="text-xs text-gray-600">
                  Transaction #{adjustTargetTx.id} &mdash; {formatType(adjustTargetTx.type)} for{" "}
                  <span className="font-medium">{adjustTargetTx.utorid}</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Adjustment amount (points)
                </label>
                <input
                  type="number"
                  step="1"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="Use positive to add points, negative to remove"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Example: <code>-40</code> will deduct 40 points from the
                  user&apos;s balance.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Promotions to apply (optional)
                </label>

                {adjustPromotionIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {adjustPromotionIds.map((id) => (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-pink-50 text-pink-700 border border-pink-200"
                      >
                        Promo #{id}
                        <button
                          type="button"
                          onClick={() => removeAdjustPromotionId(id)}
                          className="text-pink-500 hover:text-pink-700"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={adjustPromotionInput}
                    onChange={(e) => setAdjustPromotionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addAdjustPromotionId();
                      }
                    }}
                    placeholder="Promotion ID, e.g. 42"
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={addAdjustPromotionId}
                    className="px-3 py-2 rounded-xl text-sm font-medium border border-pink-200 text-pink-700 hover:bg-pink-50"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Remark (optional)
                </label>
                <textarea
                  rows={2}
                  value={adjustRemark}
                  onChange={(e) => setAdjustRemark(e.target.value)}
                  placeholder="Why is this adjustment being made?"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeAdjustmentModal}
                  className="px-3 py-2 rounded-xl text-sm border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustLoading}
                  className={`px-4 py-2 rounded-xl text-sm font-medium ${
                    adjustLoading
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-pink-600 text-white hover:bg-pink-700"
                  }`}
                >
                  {adjustLoading ? "Creating..." : "Create adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

