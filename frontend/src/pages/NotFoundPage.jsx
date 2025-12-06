export default function NotFoundPage() {
  return (
    <div className="h-screen flex flex-col items-center justify-center text-center px-6">
      <h1 className="text-4xl font-semibold mb-2">404</h1>
      <p className="text-gray-600 mb-6">The page you are looking for does not exist.</p>
      <a
        href="/"
        className="px-4 py-2 bg-pink-600 text-white rounded-xl hover:bg-pink-700"
      >
        Go Home
      </a>
    </div>
  );
}
