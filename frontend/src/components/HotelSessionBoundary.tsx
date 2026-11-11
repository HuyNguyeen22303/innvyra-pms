import { useSyncExternalStore, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { hotelCacheScope, hotelQueryClient } from "../auth/hotelQueryCache.ts";
import { onHotelSessionReset } from "../auth/hotelSession.ts";

export function HotelSessionBoundary({ children }: { children: ReactNode }) {
  const scope = useSyncExternalStore(onHotelSessionReset, hotelCacheScope);
  return (
    <QueryClientProvider key={scope} client={hotelQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}
