import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function EventDetail() {
  const { eventId } = useParams();
  const { user, token, currentView } = useAuth();
  const navigate = useNavigate();
  
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [isAttending, setIsAttending] = useState(false);

    function formatICSDate(date) {
    // Format: YYYYMMDDTHHMMSSZ
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  }

  function escapeICS(text = "") {
    return String(text)
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  }

  function generateICSContent(event) {
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `SUMMARY:${escapeICS(event.name)}`,
      `DESCRIPTION:${escapeICS(event.description || "")}`,
      `LOCATION:${escapeICS(event.location || "")}`,
      `DTSTART:${formatICSDate(start)}`,
      `DTEND:${formatICSDate(end)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ];

    return lines.join("\r\n");
  }

  function handleAddToCalendar() {
    if (!event) return;

    const icsContent = generateICSContent(event);
    const blob = new Blob([icsContent], {
      type: "text/calendar;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `event-${eventId}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }


  useEffect(() => {
    fetchEvent();
  }, [eventId, token]);

  const fetchEvent = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      setError("");
      
      const res = await fetch(`${API_BASE_URL}/events/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 404) {
          setError("Event not found");
        } else {
          throw new Error("Failed to fetch event");
        }
        return;
      }

      const data = await res.json();
      setEvent(data);
      
      // Check if user is attending
      if (data.guests && user) {
        setIsAttending(data.guests.some(g => g.utorid === user.utorid));
      }
    } catch (err) {
      console.error("Error fetching event:", err);
      setError("Failed to load event");
    } finally {
      setLoading(false);
    }
  };

  const handleRSVP = async () => {
    if (!user || !token) return;
    
    try {
      setActionLoading(true);
      setError("");
      
      const res = await fetch(`${API_BASE_URL}/events/${eventId}/guests/me`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to RSVP");
      }

      // Refresh event data
      await fetchEvent();
      alert("Successfully RSVP'd to the event!");
    } catch (err) {
      console.error("Error RSVP:", err);
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRSVP = async () => {
    if (!user || !token) return;
    
    try {
      setActionLoading(true);
      setError("");
      
      const res = await fetch(`${API_BASE_URL}/events/${eventId}/guests/me`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cancel RSVP");
      }

      // Refresh event data
      await fetchEvent();
      alert("RSVP cancelled successfully");
    } catch (err) {
      console.error("Error cancelling RSVP:", err);
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!confirm("Are you sure you want to delete this event?")) return;
    
    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE_URL}/events/${eventId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete event");
      }

      alert("Event deleted successfully");
      navigate("/events");
    } catch (err) {
      console.error("Error deleting event:", err);
      setError(err.message);
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <p className="text-gray-500">Loading event...</p>
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          {error}
        </div>
        <Link to="/events" className="text-pink-600 hover:text-pink-700 mt-4 inline-block">
          ← Back to Events
        </Link>
      </div>
    );
  }

  if (!event) return null;

  const isManager = user.role === "manager" || user.role === "superuser";
  const isOrganizer = event.organizers?.some(o => o.utorid === user.utorid);
  const canManage = isManager || isOrganizer;
  const isEnded = new Date(event.endTime) < new Date();
  const isStarted = new Date(event.startTime) < new Date();
  const isFull = event.capacity && event.guests && event.guests.length >= event.capacity;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <Link to="/events" className="text-pink-600 hover:text-pink-700 font-medium">
          ← Back to Events
        </Link>
        <div className="flex gap-2">
          {canManage && (
            <>
              <Link
                to={`/events/${eventId}/edit`}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Edit
              </Link>
              {isManager && !event.published && (
                <button
                  onClick={handleDeleteEvent}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Event Details Card */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-3xl font-bold text-gray-900">{event.name}</h1>
          {isManager && (
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              event.published ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
            }`}>
              {event.published ? "Published" : "Draft"}
            </span>
          )}
        </div>

        <p className="text-gray-700 text-lg mb-6">{event.description}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📍</span>
              <div>
                <p className="text-sm text-gray-500">Location</p>
                <p className="font-medium text-gray-900">{event.location}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-2xl">🗓️</span>
              <div>
                <p className="text-sm text-gray-500">Start Time</p>
                <p className="font-medium text-gray-900">
                  {new Date(event.startTime).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-2xl">⏰</span>
              <div>
                <p className="text-sm text-gray-500">End Time</p>
                <p className="font-medium text-gray-900">
                  {new Date(event.endTime).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl">👥</span>
              <div>
                <p className="text-sm text-gray-500">Capacity</p>
                <p className="font-medium text-gray-900">
                  {event.guests?.length || event.numGuests || 0}
                  {event.capacity ? ` / ${event.capacity}` : " attendees"}
                </p>
              </div>
            </div>

            {canManage && (
              <>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🎁</span>
                  <div>
                    <p className="text-sm text-gray-500">Points</p>
                    <p className="font-medium text-gray-900">
                      {event.pointsRemain || 0} remaining / {event.pointsAwarded || 0} awarded
                    </p>
                  </div>
                </div>
              </>
            )}

            <div className="flex items-start gap-3">
              <span className="text-2xl">
                {isEnded ? "🔚" : isStarted ? "▶️" : "⏳"}
              </span>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className={`font-medium ${
                  isEnded ? "text-gray-600" : isStarted ? "text-blue-600" : "text-green-600"
                }`}>
                  {isEnded ? "Ended" : isStarted ? "Ongoing" : "Upcoming"}
                </p>
              </div>
            </div>
          </div>

        <button
          type="button"
          onClick={handleAddToCalendar}
          className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition font-medium"
        >
          📅 Add to Calendar
        </button>
        </div>

        {/* Organizers */}
        {event.organizers && event.organizers.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="font-semibold text-gray-900 mb-3">Organizers</h3>
            <div className="flex flex-wrap gap-2">
              {event.organizers.map((org) => (
                <span
                  key={org.id}
                  className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                >
                  {org.name || org.utorid}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* RSVP Button for Regular Users */}
        {user.role === "regular" && event.published && !isEnded && (
          <div className="mt-8 pt-6 border-t">
            {isAttending ? (
              <div className="space-y-3">
                <p className="text-green-600 font-medium flex items-center gap-2">
                  ✓ You are attending this event
                </p>
                <button
                  onClick={handleCancelRSVP}
                  disabled={actionLoading}
                  className="px-6 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition font-medium disabled:opacity-50"
                >
                  {actionLoading ? "Processing..." : "Cancel RSVP"}
                </button>
              </div>
            ) : (
              <button
                onClick={handleRSVP}
                disabled={actionLoading || isFull}
                className="px-8 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? "Processing..." : isFull ? "Event Full" : "RSVP to this Event"}
              </button>
            )}
          </div>
        )}

        {/* Management Actions */}
        {canManage && (
          <div className="mt-8 pt-6 border-t space-y-4">
            <h3 className="font-semibold text-gray-900">Management Actions</h3>
            <div className="flex flex-wrap gap-3">
              <Link
                to={`/events/${eventId}/guests`}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Manage Guests
              </Link>
              <Link
                to={`/events/${eventId}/award-points`}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                Award Points
              </Link>
              {isManager && (
                <Link
                  to={`/events/${eventId}/organizers`}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  Manage Organizers
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Guest List for Managers/Organizers */}
        {canManage && event.guests && event.guests.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="font-semibold text-gray-900 mb-3">
              Attendees ({event.guests.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
              {event.guests.map((guest) => (
                <div
                  key={guest.id}
                  className="px-3 py-2 bg-gray-50 rounded-lg text-sm"
                >
                  {guest.name || guest.utorid}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
