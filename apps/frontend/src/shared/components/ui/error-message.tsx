interface ErrorMessageProps {
  title: string;
  message: string;
}

export function ErrorMessage({ title, message }: ErrorMessageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-2xl font-semibold mb-4">{title}</h2>
      <p className="text-gray-600">{message}</p>
    </div>
  );
}
