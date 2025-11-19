import { useState } from "react";
import { Link } from "react-router-dom";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  const navItems = [
    { name: "Home", to: "/" },
    { name: "Events", to: "/events" },
    { name: "Transactions", to: "/transactions" },
  ];

  return (
    <nav className="w-full bg-white shadow-md fixed top-0 left-0 z-50">
      {/* Navbar container */}
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        
        {/* Logo */}
        <Link to="/" className="text-xl font-bold text-pink-600">
          MyApp
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex space-x-8">
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className="font-medium hover:text-pink-600 transition"
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* Mobile Hamburger */}
        <button
          className="md:hidden"
          onClick={() => setOpen(!open)}
        >
          {open ? <div>X</div> : <div>Menu</div>}
        </button>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="md:hidden bg-white border-t shadow-md">
          <div className="flex flex-col px-4 py-2 space-y-2">
            {navItems.map(item => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="py-2 font-medium border-b last:border-none hover:text-pink-600"
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
