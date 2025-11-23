import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function ManageGuests() {
  const { eventId } = useParams();
  const { user, token } = useAuth();
  
  const [event, setEvent] = useState(null);
  const [guests, setGuests] = useState([]);
  const [utorid, setUtorid] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchEvent();
  }, [eventId, token]);

  const fetchEvent = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/events/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to fetch event");

      const data = await res.json();
      setEvent(data);
      setGuests(data.guests || []);
    } catch (err) {
      console.error("Error fetching event:", err);
      setError("Failed to load event");
    } finally {
      setLoading(false);
    }
  };

  const handleAddGuest = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setActionLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/events/${eventId}/guests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ utorid }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add guest");
      }

      setSuccess(`Successfully added ${utorid} to the event`);
      setUtorid("");
      await fetchEvent();
    } catch (err) {
      console.error("Error adding guest:", err);
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveGuest = async (guestId) => {
    if (!confirm("Are you sure you want to remove this guest?")) return;
    
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`${API_BASE_URL}/events/${eventId}/guests/${guestId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove guest");
      }

      setSuccess("Guest removed successfully");
      await fetchEvent();
    } catch (err) {
      console.error("Error removing guest:", err);
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const isManager = user?.role === "manager" || user?.role === "superuser";
  const isOrganizer = event?.organizers?.some(o => o.utorid === user?.utorid);
  const canManage = isManager || isOrganizer;

  if (!canManage) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          You don't have permission to manage guests for this event.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link to={`/events/${eventId}`} className="text-pink-600 hover:text-pink-700 font-medium inline-block">
        ← Back to Event
      </Link>

      <div className="bg-white rounded-xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Manage Guests</h1>
        <p className="text-gray-600 mb-6">{event?.name}</p>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-4">
            {success}
          </div>
        )}

        {/* Add Guest Form */}
        <div className="mb-8 pb-8 border-b">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Guest</h2>
          <form onSubmit={handleAddGuest} className="flex gap-3">
            <input
              type="text"
              value={utorid}
              onChange={(e) => setUtorid(e.target.value)}
              placeholder="Enter UTORid"
              required
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <button
              type="submit"
              disabled={actionLoading}
              className="px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition font-medium disabled:opacity-50"
            >
              {actionLoading ? "Adding..." : "Add Guest"}
            </button>
          </form>
        </div>

        {/* Guest List */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Current Guests ({guests.length})
            {event?.capacity && ` / ${event.capacity}`}
          </h2>

          {guests.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No guests yet</p>
          ) : (
            <div className="space-y-2">
              {guests.map((guest) => (
                <div
                  key={guest.id}
                  className="flex justify-between items-center p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium text-gray-900">{guest.name || "N/A"}</p>
                    <p className="text-sm text-gray-600">{guest.utorid}</p>
                  </div>
                  {isManager && (
                    <button
                      onClick={() => handleRemoveGuest(guest.id)}
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-sm font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
