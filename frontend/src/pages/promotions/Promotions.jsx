import { useAuth } from "../../auth/AuthContext";
import UserPromotions from "./UserPromotions";
import ManagerPromotions from "./ManagerPromotions";
import CashierPromotions from "./CashierPromotions";

export default function PromotionsPage() {
  const { currentView } = useAuth();

  // Managers and superusers get the management view
  if (currentView === "manager" || currentView === "superuser") {
    return <ManagerPromotions />;
  }
  else if (currentView === "cashier") {
    return <CashierPromotions />
  }

  // Everyone else just sees available promos
  return <UserPromotions />;
}
