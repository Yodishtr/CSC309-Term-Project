import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const { user, currentView, availableViews, logout, switchView } = useAuth();

  // determine what to show based on CURRENT VIEW (not actual role)
  const isManagerView = currentView === "manager" || currentView === "superuser";
  const isCashierView = currentView === "cashier" || isManagerView;

  const navItems = [
    { name: "Home", to: "/" },
    { name: "Events", to: "/events" },
    { name: "Transactions", to: "/transactions" },
    { name: "Promotions", to: "/promotions"}
  ];

  // add Users link for manager views
  if (isManagerView) {
    navItems.push({ name: "Users", to: "/users" });
  }

  // add Register link for cashier+ views
  if (isCashierView) {
    navItems.push({ name: "Register", to: "/register" });
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  function handleViewSwitch(newView) {
    switchView(newView);
    setViewDropdownOpen(false);
    // optionally navigate to home when switching views
    navigate("/");
  }

  // get view display name
  const getViewName = (view) => {
    const names = {
      regular: "Regular User",
      cashier: "Cashier",
      manager: "Manager",
      superuser: "Superuser",
      organizer: "Event Organizer",
    };
    return names[view] || view;
  };

  // only show view switcher if user has multiple available views
  const showViewSwitcher = availableViews && availableViews.length > 1;

  console.log("NavBar Debug:", { user, currentView, availableViews, showViewSwitcher });

  return (
    <nav className="w-full bg-white shadow-md fixed top-0 left-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        
        <Link to="/" className="text-xl font-bold text-pink-600">
          MyApp
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex space-x-6 items-center">
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className="font-medium hover:text-pink-600 transition"
            >
              {item.name}
            </Link>
          ))}

          {/* View Switcher Dropdown */}
          {showViewSwitcher && (
            <div className="relative">
              <button
                onClick={() => setViewDropdownOpen(!viewDropdownOpen)}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                <span className="text-sm font-medium text-gray-700">
                  {getViewName(currentView)}
                </span>
                <svg 
                  className={`w-4 h-4 text-gray-500 transition-transform ${viewDropdownOpen ? "rotate-180" : ""}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {viewDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border">
                  <div className="px-3 py-2 border-b">
                    <p className="text-xs text-gray-500 font-medium uppercase">Switch View</p>
                  </div>
                  {availableViews.map((view) => (
                    <button
                      key={view}
                      onClick={() => handleViewSwitch(view)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        view === currentView 
                          ? "bg-pink-50 text-pink-600 font-medium" 
                          : "text-gray-700"
                      }`}
                    >
                      {getViewName(view)}
                      {view === currentView && (
                        <span className="ml-2">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 bg-pink-600 text-white px-4 py-2 rounded-lg hover:bg-pink-700 transition"
            >
              {user?.name || user?.utorid || "Account"}
              <svg 
                className={`w-4 h-4 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border">
                <Link
                  to="/profile"
                  onClick={() => setDropdownOpen(false)}
                  className="block px-4 py-2 text-gray-700 hover:bg-pink-50 hover:text-pink-600 rounded-t-lg"
                >
                  My Profile
                </Link>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    handleLogout();
                  }}
                  className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 rounded-b-lg"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <div>X</div> : <div>Menu</div>}
        </button>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="md:hidden bg-white border-t shadow-md">
          <div className="flex flex-col px-4 py-2 space-y-1">
            {/* View Switcher in Mobile */}
            {showViewSwitcher && (
              <div className="py-2 border-b">
                <p className="text-xs text-gray-500 font-medium uppercase mb-2">Current View</p>
                <div className="space-y-1">
                  {availableViews.map((view) => (
                    <button
                      key={view}
                      onClick={() => {
                        handleViewSwitch(view);
                        setOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded text-sm ${
                        view === currentView 
                          ? "bg-pink-50 text-pink-600 font-medium" 
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {getViewName(view)}
                      {view === currentView && <span className="ml-2">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {navItems.map(item => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="py-3 font-medium border-b hover:text-pink-600"
              >
                {item.name}
              </Link>
            ))}

            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="py-3 font-medium border-b hover:text-pink-600"
            >
              My Profile
            </Link>

            <button
              onClick={() => {
                setOpen(false);
                handleLogout();
              }}
              className="py-3 text-left font-medium text-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}