'use client'
 
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-yellow-500 to-orange-600 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-black mb-4">🤠 Somethin' went wrong!</h1>
        <p className="text-xl text-black mb-4">Don't worry, we'll get this sorted</p>
        <button
          onClick={() => reset()}
          className="bg-black text-orange-400 px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}