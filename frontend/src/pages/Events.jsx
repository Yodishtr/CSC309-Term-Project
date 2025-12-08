import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function Events() {
  const { user, token, currentView } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Filters
  const [filters, setFilters] = useState({
    name: "",
    location: "",
    started: "",
    ended: "",
    showFull: false,
    published: "",
  });
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;

  useEffect(() => {
    fetchEvents();
  }, [page, filters, token]);

  const fetchEvents = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      setError("");
      
      // Build query params
      const params = new URLSearchParams();
      params.append("page", page);
      params.append("limit", limit);
      
      if (filters.name) params.append("name", filters.name);
      if (filters.location) params.append("location", filters.location);
      if (filters.started) params.append("started", filters.started);
      if (filters.ended) params.append("ended", filters.ended);
      if (filters.showFull) params.append("showFull", "true");
      if (filters.published && (currentView === "manager" || currentView === "superuser")) {
        params.append("published", filters.published);
      }

      const res = await fetch(`${API_BASE_URL}/events?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch events");
      }

      const data = await res.json();
      setEvents(data.results || []);
      setTotalCount(data.count || 0);
    } catch (err) {
      console.error("Error fetching events:", err);
      setError("Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page
  };

  const clearFilters = () => {
    setFilters({
      name: "",
      location: "",
      started: "",
      ended: "",
      showFull: false,
      published: "",
    });
    setPage(1);
  };

  const totalPages = Math.ceil(totalCount / limit);

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Events</h1>
        {(currentView === "manager" || currentView === "superuser") && (
          <Link
            to="/events/create"
            className="bg-pink-600 text-white px-6 py-2 rounded-lg hover:bg-pink-700 transition font-medium"
          >
            + Create Event
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event Name
            </label>
            <input
              type="text"
              value={filters.name}
              onChange={(e) => handleFilterChange("name", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
              placeholder="Search by name..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <input
              type="text"
              value={filters.location}
              onChange={(e) => handleFilterChange("location", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
              placeholder="Search by location..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.started}
              onChange={(e) => {
                if (e.target.value) {
                  handleFilterChange("started", e.target.value);
                  handleFilterChange("ended", "");
                } else {
                  handleFilterChange("started", "");
                }
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="">All Events</option>
              <option value="false">Upcoming</option>
              <option value="true">Started</option>
            </select>
          </div>

          {(currentView === "manager" || currentView === "superuser") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Published
              </label>
              <select
                value={filters.published}
                onChange={(e) => handleFilterChange("published", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                <option value="">All</option>
                <option value="true">Published</option>
                <option value="false">Unpublished</option>
              </select>
            </div>
          )}

          <div className="flex items-end">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.showFull}
                onChange={(e) => handleFilterChange("showFull", e.target.checked)}
                className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
              />
              <span className="text-sm font-medium text-gray-700">Show Full Events</span>
            </label>
          </div>

          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Events List */}
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading events...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <p className="text-gray-500">No events found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <Link
              key={event.id}
              to={`/events/${event.id}`}
              className="block bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-start gap-3">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {event.name}
                    </h3>
                    {(currentView === "manager" || currentView === "superuser") && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        event.published 
                          ? "bg-green-100 text-green-700" 
                          : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {event.published ? "Published" : "Draft"}
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-2 space-y-1">
                    <p className="text-gray-600 flex items-center gap-2">
                      <span className="font-medium">📍</span> {event.location}
                    </p>
                    <p className="text-gray-600 flex items-center gap-2">
                      <span className="font-medium">🗓️</span>
                      {new Date(event.startTime).toLocaleString()} - {new Date(event.endTime).toLocaleString()}
                    </p>
                    <p className="text-gray-600 flex items-center gap-2">
                      <span className="font-medium">👥</span>
                      {event.numGuests || 0}
                      {event.capacity ? ` / ${event.capacity}` : ""} attendees
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  {event.capacity && event.numGuests >= event.capacity ? (
                    <span className="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                      Full
                    </span>
                  ) : new Date(event.endTime) < new Date() ? (
                    <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                      Ended
                    </span>
                  ) : new Date(event.startTime) < new Date() ? (
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                      Ongoing
                    </span>
                  ) : (
                    <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                      Upcoming
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-gray-700">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
