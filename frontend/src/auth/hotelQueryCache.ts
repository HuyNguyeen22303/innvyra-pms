import axios from "axios";
import { QueryClient } from "@tanstack/react-query";
import { hotelSessionGeneration, onHotelSessionReset } from "./hotelSession.ts";

const createClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: (count, error) => !axios.isCancel(error) && count < 1,
      },
      mutations: { retry: false },
    },
  });
let current = createClient();
onHotelSessionReset(() => {
  const previous = current;
  current = createClient();
  void previous.cancelQueries();
  previous.clear();
});
export const hotelQueryClient = () => current;
export const hotelCacheScope = () => hotelSessionGeneration();
