// src/pages/transactions/CashierTransactions.jsx
import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function CashierTransactions() {
  const { token, user } = useAuth();

  const isCashierOrHigher =
    user?.role === "cashier" ||
    user?.role === "manager" ||
    user?.role === "superuser";

  // Global messages
  const [globalMessage, setGlobalMessage] = useState("");

  // Purchase modal state
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [customerUtorid, setCustomerUtorid] = useState("");
  const [spent, setSpent] = useState("");
  const [remark, setRemark] = useState("");
  const [promotionInput, setPromotionInput] = useState("");
  const [promotionIds, setPromotionIds] = useState([]);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");
  const [purchaseSuccess, setPurchaseSuccess] = useState("");
  const [createdPurchase, setCreatedPurchase] = useState(null);

  // Redemption modal state
  const [showRedemptionModal, setShowRedemptionModal] = useState(false);
  const [redemptionId, setRedemptionId] = useState("");
  const [redemptionLoading, setRedemptionLoading] = useState(false);
  const [redemptionError, setRedemptionError] = useState("");
  const [redemptionSuccess, setRedemptionSuccess] = useState("");
  const [processedRedemption, setProcessedRedemption] = useState(null);

  function resetGlobalMessage() {
    setGlobalMessage("");
  }

  // OPEN/CLOSE MODALS

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

  // PROMOTION HELPERS

  function addPromotionId() {
    setPurchaseError("");
    setPurchaseSuccess("");

    const trimmed = promotionInput.trim();
    if (!trimmed) return;

    const idNum = Number(trimmed);
    if (!Number.isInteger(idNum) || idNum < 0) {
      setPurchaseError("Promotion ID must be a non-negative integer.");
      return;
    }

    if (promotionIds.includes(idNum)) {
      setPurchaseError("This promotion ID has already been added.");
      return;
    }

    setPromotionIds((prev) => [...prev, idNum]);
    setPromotionInput("");
  }

  function removePromotionId(id) {
    setPurchaseError("");
    setPurchaseSuccess("");
    setPromotionIds((prev) => prev.filter((p) => p !== id));
  }

  // SUBMIT: CREATE PURCHASE

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
    const spentNum = Number(spent);

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

      if (remark.trim()) {
        body.remark = remark.trim();
      }
      if (promotionIds.length > 0) {
        body.promotionIds = promotionIds;
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

      setSpent("");
      setRemark("");
      setPromotionIds([]);
      setPromotionInput("");

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

  //  SUBMIT: PROCESS REDEMPTION 

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
            "Unable to process this transaction. It may not be a redemption, it may have already been processed, or the user may not have a sufficient point balance"
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
        `Redemption processed successfully for ${data.utorid}. Redeemed ${data.redeemed ?? data.amount ?? "?"} pts.`
      );

      setRedemptionId("");
      setShowRedemptionModal(false);
      setGlobalMessage(
        `Redemption transaction #${data.id} processed. ${data.redeemed ?? "Points"} deducted from user balance.`
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

  // RENDER 

  return (
    <div className="page page-transactions md:px-16">
      {/* Header */}
      <div className="page-header flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold mb-1">
            Cashier – Transactions
          </h1>
          <p className="text-sm text-gray-500">
            Logged in as{" "}
            <strong>{user?.utorid ?? user?.name ?? "cashier"}</strong>
          </p>
        </div>
      </div>

      {/* Role info */}
      {!isCashierOrHigher && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-2 rounded-xl">
          You do not have permission to perform cashier actions. This view is
          for cashiers, managers, and superusers.
        </div>
      )}

      {/* Global message */}
      {globalMessage && (
        <div className="mb-4 text-xs text-blue-700 bg-blue-50 border border-blue-100 px-4 py-2 rounded-xl">
          {globalMessage}
        </div>
      )}

      {/* Main action card */}
      <div className="card p-6 rounded-2xl bg-white shadow-sm max-w-2xl">

        <div className="flex flex-wrap gap-3">
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

        {createdPurchase && (
          <div className="mt-5 border-t border-gray-100 pt-4 text-sm">
            <h3 className="text-sm font-semibold mb-2">
              Last created purchase
            </h3>
            <p className="text-gray-700">
              <span className="font-medium">Transaction ID:</span>{" "}
              {createdPurchase.id}
            </p>
            <p className="text-gray-700">
              <span className="font-medium">Customer:</span>{" "}
              {createdPurchase.utorid}
            </p>
            <p className="text-gray-700">
              <span className="font-medium">Spent:</span>{" "}
              {createdPurchase.spent?.toFixed
                ? `$${createdPurchase.spent.toFixed(2)}`
                : `$${createdPurchase.spent}`}
            </p>
            <p className="text-gray-700">
              <span className="font-medium">Points earned:</span>{" "}
              {createdPurchase.earned ?? 0} pts
            </p>
            {Array.isArray(createdPurchase.promotionIds) &&
              createdPurchase.promotionIds.length > 0 && (
                <p className="text-gray-700">
                  <span className="font-medium">Promotions applied:</span>{" "}
                  {createdPurchase.promotionIds.join(", ")}
                </p>
              )}
            {createdPurchase.remark && (
              <p className="text-gray-700">
                <span className="font-medium">Remark:</span>{" "}
                {createdPurchase.remark}
              </p>
            )}
          </div>
        )}

        {processedRedemption && (
          <div className="mt-5 border-t border-gray-100 pt-4 text-sm">
            <h3 className="text-sm font-semibold mb-2">
              Last processed redemption
            </h3>
            <p className="text-gray-700">
              <span className="font-medium">Transaction ID:</span>{" "}
              {processedRedemption.id}
            </p>
            <p className="text-gray-700">
              <span className="font-medium">Customer:</span>{" "}
              {processedRedemption.utorid}
            </p>
            <p className="text-gray-700">
              <span className="font-medium">Redeemed:</span>{" "}
              {processedRedemption.redeemed ??
                processedRedemption.amount ??
                "?"}{" "}
              pts
            </p>
            <p className="text-gray-700">
              <span className="font-medium">Processed by:</span>{" "}
              {processedRedemption.processedBy}
            </p>
            {processedRedemption.remark && (
              <p className="text-gray-700">
                <span className="font-medium">Remark:</span>{" "}
                {processedRedemption.remark}
              </p>
            )}
          </div>
        )}
      </div>

      {/*  PURCHASE MODAL  */}
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
            {purchaseSuccess && (
              <div className="mb-3 text-xs text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded-xl">
                {purchaseSuccess}
              </div>
            )}

            <form onSubmit={handleSubmitPurchase} className="space-y-4">
              {/* Customer UTORid */}
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

              {/* Spent */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Amount spent ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={spent}
                  onChange={(e) => setSpent(e.target.value)}
                  placeholder="e.g. 19.99"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Base rate: 1 point per $0.25 (rounded), plus any valid
                  promotions. Automatic promotions are applied automatically.
                </p>
              </div>

              {/* Promotions */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  One-time promotions to apply
                </label>

                {promotionIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {promotionIds.map((id) => (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-pink-50 text-pink-700 border border-pink-200"
                      >
                        Promo #{id}
                        <button
                          type="button"
                          onClick={() => removePromotionId(id)}
                          className="text-pink-500 hover:text-pink-700"
                          aria-label={`Remove promotion ${id}`}
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
                    value={promotionInput}
                    onChange={(e) => setPromotionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addPromotionId();
                      }
                    }}
                    placeholder="Promotion ID, e.g. 42"
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={addPromotionId}
                    className="px-3 py-2 rounded-xl text-sm font-medium border border-pink-200 text-pink-700 hover:bg-pink-50"
                  >
                    Add
                  </button>
                </div>

                <p className="text-xs text-gray-400 mt-1">
                  Enter IDs of valid <span className="font-medium">one-time</span>{" "}
                  promotions. The backend will verify they exist, are active,
                  meet minimum spending, and haven&apos;t been used by this
                  customer.
                </p>
              </div>

              {/* Remark */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Remark (optional)
                </label>
                <textarea
                  rows={2}
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
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
            {redemptionSuccess && (
              <div className="mb-3 text-xs text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded-xl">
                {redemptionSuccess}
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
    </div>
  );
}
