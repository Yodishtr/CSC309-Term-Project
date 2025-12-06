// src/router/router.jsx
import { createBrowserRouter } from "react-router-dom";

import App from "../App";
import Login from "../pages/Login";
import AppLayout from "../layouts/AppLayout";
import PublicLayout from "../layouts/PublicLayout";
import ProtectedRoute from "../auth/ProtectedRoutes";
import Transactions from "../pages/transactions/Transactions";
import Dashboard from "../pages/Dashboard";
import Events from "../pages/Events";
import EventDetail from "../pages/EventDetail";
import EventForm from "../pages/EventForm";
import ManageGuests from "../pages/ManageGuests";
import AwardPoints from "../pages/AwardPoints";
import Profile from "../pages/Profile";
import ForgotPassword from "../pages/ForgotPassword";
import ResetPassword from "../pages/ResetPassword";
import Users from "../pages/Users";
import UserDetail from "../pages/UserDetail";
import Register from "../pages/Register";
import Promotions from "../pages/promotions/Promotions";
import NewPromotion from "../pages/promotions/NewPromotion";
import EditPromotion from "../pages/promotions/EditPromotion";
import NotFoundPage from "../pages/NotFoundPage";


const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [ 
        {element: <ProtectedRoute/>, children:
            [
                { element: <AppLayout />, children:
                  [
                  {index: true, element: <Dashboard />},
                  {path: "transactions", element: <Transactions />},
                  {path: "profile", element: <Profile />},
                  {path: "events", element: <Events />},
                  {path: "events/create", element: <EventForm />},
                  {path: "events/:eventId", element: <EventDetail />},
                  {path: "events/:eventId/edit", element: <EventForm />},
                  {path: "events/:eventId/guests", element: <ManageGuests />},
                  {path: "events/:eventId/award-points", element: <AwardPoints />},
                  {path: "users", element: <Users />},
                  {path: "users/:userId", element: <UserDetail />},
                  {path: "register", element: <Register />},
                  {path: "promotions", element: <Promotions/>},
                  {path: "promotions/new", element: <NewPromotion />},
                  {path: "promotions/edit/:promotionId", element: <EditPromotion />},
                  { path: "*", element: <NotFoundPage /> },
                  ]
                 },
            ]
        },
        { path: "login", element: <PublicLayout /> },
        { path: "forgot-password", element: <ForgotPassword /> },
        { path: "reset-password/:token", element: <ResetPassword /> },
        { path: "*", element: <NotFoundPage /> }, 
    ],
  },
]);

export default router;

