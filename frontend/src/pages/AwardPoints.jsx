import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AwardPoints() {
  const { eventId } = useParams();
  const { user, token } = useAuth();
  
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [awardType, setAwardType] = useState("all"); // "all" or "single"
  const [selectedUtorid, setSelectedUtorid] = useState("");
  const [points, setPoints] = useState("");
  const [remark, setRemark] = useState("");

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
    } catch (err) {
      console.error("Error fetching event:", err);
      setError("Failed to load event");
    } finally {
      setLoading(false);
    }
  };

  const handleAwardPoints = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setActionLoading(true);

    try {
      const payload = {
        type: "event",
        amount: parseInt(points),
        remark: remark || undefined,
      };

      if (awardType === "single" && selectedUtorid) {
        payload.utorid = selectedUtorid;
      }

      const res = await fetch(`${API_BASE_URL}/events/${eventId}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to award points");
      }

      const data = await res.json();
      const numRecipients = Array.isArray(data) ? data.length : 1;
      setSuccess(`Successfully awarded ${points} points to ${numRecipients} guest(s)!`);
      setPoints("");
      setRemark("");
      setSelectedUtorid("");
      await fetchEvent();
    } catch (err) {
      console.error("Error awarding points:", err);
      setError(err.message);
    } finally {
      setActionLoading(false);
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
          You don't have permission to award points for this event.
        </div>
      </div>
    );
  }

  const guests = event?.guests || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link to={`/events/${eventId}`} className="text-pink-600 hover:text-pink-700 font-medium inline-block">
        ← Back to Event
      </Link>

      <div className="bg-white rounded-xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Award Points</h1>
        <p className="text-gray-600 mb-6">{event?.name}</p>

        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <p className="text-sm text-blue-800">
            <strong>Points Available:</strong> {event?.pointsRemain || 0} points remaining
          </p>
          <p className="text-sm text-blue-800">
            <strong>Points Awarded:</strong> {event?.pointsAwarded || 0} points already given
          </p>
          <p className="text-sm text-blue-800">
            <strong>Total Guests:</strong> {guests.length}
          </p>
        </div>

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

        {guests.length === 0 ? (
          <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg">
            No guests have RSVP'd to this event yet. Add guests before awarding points.
          </div>
        ) : (
          <form onSubmit={handleAwardPoints} className="space-y-6">
            {/* Award Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Award To
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="all"
                    checked={awardType === "all"}
                    onChange={(e) => setAwardType(e.target.value)}
                    className="text-pink-600 focus:ring-pink-500"
                  />
                  <span className="text-gray-700">All guests ({guests.length} people)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="single"
                    checked={awardType === "single"}
                    onChange={(e) => setAwardType(e.target.value)}
                    className="text-pink-600 focus:ring-pink-500"
                  />
                  <span className="text-gray-700">Single guest</span>
                </label>
              </div>
            </div>

            {/* Select Guest (if single) */}
            {awardType === "single" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Guest *
                </label>
                <select
                  value={selectedUtorid}
                  onChange={(e) => setSelectedUtorid(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value="">-- Select a guest --</option>
                  {guests.map((guest) => (
                    <option key={guest.id} value={guest.utorid}>
                      {guest.name || guest.utorid} ({guest.utorid})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Points Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Points to Award *
              </label>
              <input
                type="number"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                required
                min="1"
                max={event?.pointsRemain || 0}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="Enter points per person"
              />
              {awardType === "all" && points && (
                <p className="text-sm text-gray-600 mt-1">
                  Total: {parseInt(points) * guests.length} points will be distributed
                </p>
              )}
            </div>

            {/* Remark */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Remark (optional)
              </label>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="Add a note about this award..."
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={actionLoading}
                className="flex-1 bg-pink-600 text-white py-3 rounded-lg hover:bg-pink-700 transition font-medium disabled:opacity-50"
              >
                {actionLoading ? "Awarding..." : "Award Points"}
              </button>
              <Link
                to={`/events/${eventId}`}
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition text-center"
              >
                Cancel
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
