import { useEffect } from 'react';
import toast, { useToasterStore } from 'react-hot-toast';

/** At most 3 messages on screen; older ones close as new ones arrive (document checks send many). */
export default function ToastLimit({ max = 3 }) {
  const { toasts } = useToasterStore();
  useEffect(() => {
    toasts.filter((t) => t.visible).slice(max).forEach((t) => toast.dismiss(t.id));
  }, [toasts, max]);
  return null;
}
