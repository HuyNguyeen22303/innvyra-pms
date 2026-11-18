import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore.ts';
import { hotelClock } from '../utils/hotelDate.ts';

export function useHotelClock() {
  const timezone = useAuthStore((state) => state.user?.hotel?.timezone);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return hotelClock(timezone, now);
}
