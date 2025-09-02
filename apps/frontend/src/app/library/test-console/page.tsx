'use client';

logger.info('🔥 library/test-console: Top level log');

export default function LibraryTestConsolePage() {
  logger.info('🔥 library/test-console: Component body');

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Library Test Console</h1>
      <p>
        This is a test page inside the library folder to check if console logs
        work here.
      </p>
      <p className="mt-4 text-gray-600">
        Check browser console for messages starting with 🔥
      </p>
    </div>
  );
}
