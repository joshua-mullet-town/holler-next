export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-yellow-500 to-orange-600 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-black mb-4">🤠 Whoops, partner!</h1>
        <p className="text-xl text-black mb-4">This page done wandered off</p>
        <a href="/" className="text-blue-600 underline">Head back to the Holler</a>
      </div>
    </div>
  )
}