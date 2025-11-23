// src/router/router.jsx
import { createBrowserRouter } from "react-router-dom";

import App from "../App";
import Login from "../pages/Login";
import AppLayout from "../layouts/AppLayout";
import PublicLayout from "../layouts/PublicLayout";
import ProtectedRoute from "../auth/ProtectedRoutes";
import Transactions from "../pages/Transactions";
import Dashboard from "../pages/Dashboard";
import Events from "../pages/Events";
import EventDetail from "../pages/EventDetail";
import EventForm from "../pages/EventForm";
import ManageGuests from "../pages/ManageGuests";
import AwardPoints from "../pages/AwardPoints";

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
                  {path: "events", element: <Events />},
                  {path: "events/create", element: <EventForm />},
                  {path: "events/:eventId", element: <EventDetail />},
                  {path: "events/:eventId/edit", element: <EventForm />},
                  {path: "events/:eventId/guests", element: <ManageGuests />},
                  {path: "events/:eventId/award-points", element: <AwardPoints />},
                  ]
                 },
            ]
        },
        { path: "login", element: <PublicLayout /> },
    ],
  },
]);

export default router;

