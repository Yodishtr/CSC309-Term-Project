// src/router/router.jsx
import { createBrowserRouter } from "react-router-dom";

import App from "../App";
import Login from "../pages/Login";
import AppLayout from "../layouts/AppLayout";
import PublicLayout from "../layouts/PublicLayout";


const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <AppLayout /> },
      { path: "login", element: <PublicLayout /> },
    ],
  },
]);

export default router;

