import { Outlet } from "react-router-dom";

// main page, wraps all pages of the app

export default function App() {
  return (
    <div className="min-h-screen bg-slate-100">
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
