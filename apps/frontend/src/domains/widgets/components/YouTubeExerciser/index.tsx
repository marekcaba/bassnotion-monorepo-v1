import { useState } from 'react';

interface YouTubeExerciserProps {
  userId: string;
}

export function YouTubeExerciser({
  // userId will be used in the future API implementation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userId,
}: YouTubeExerciserProps) {
  const [url, setUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUrlSubmit = async () => {
    try {
      setIsProcessing(true);
      setError(null);
      // TODO: Replace with actual API call using userId
      await new Promise((resolve) => {
        setTimeout(() => {
          // Placeholder for API processing
          resolve(undefined);
        }, 1000);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter YouTube URL"
          className="flex-1 px-4 py-2 border rounded"
          disabled={isProcessing}
        />
        <button
          onClick={() => void handleUrlSubmit()}
          disabled={!url || isProcessing}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {isProcessing ? 'Processing...' : 'Extract Exercises'}
        </button>
      </div>
      {error && <div className="text-red-500 text-sm">{error}</div>}
    </div>
  );
}
