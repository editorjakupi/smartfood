export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Privacy</h1>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-gray-700 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none">
        <p>
          SmartFood stores your logged food entries, goals and settings to show your daily summary,
          streak and recommendations. Data is stored in a database (local or cloud depending on deployment).
        </p>
        <p>
          We send images for classification (local CNN or cloud Vision) and food names to nutrition databases
          (e.g. Open Food Facts) to fetch nutrition info. Chat uses a language model (e.g. Groq) for recommendations.
        </p>
        <p>
          We do not share your data with third parties for advertising. You can clear history or delete your
          profile at any time in settings. Deleting your profile permanently removes all your data.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Last updated: {new Date().toLocaleDateString('en-US')}
        </p>
      </div>
    </div>
  )
}
