// src/pages/transactions/TransactionsPage.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import RegularTransactions from "./RegularTransactions";
import CashierTransactions from "./CashierTransactions";
import ManagerTransactions from "./ManagerTransactions";

export default function Transactions() {
  const { user, loading, currentView } = useAuth();
  const navigate = useNavigate();

  // redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <div>Loading...</div>;
  }

  // Decide which subpage to show based on currentView
  if (currentView === "cashier") {
    return <CashierTransactions />;
  }

  if (currentView === "manager" || currentView === "superuser") {
    return <ManagerTransactions />;
  }

  // defualt to the regular user view
  return <RegularTransactions />;
}