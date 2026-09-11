import { useEffect } from 'react';

type Props = {
  message: string | null;
  label?: string;
};

export function ErrorFooter({ message, label }: Props) {
  useEffect(() => {
    if (message) {
      console.error(`[${label ?? 'Error'}]`, message);
    }
  }, [label, message]);

  if (!message) return null;

  return (
    <div className="error-footer" role="alert">
      <pre>{message}</pre>
    </div>
  );
}
