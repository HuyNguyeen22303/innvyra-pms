import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Button, Select, Spin, type SelectProps } from 'antd';
import type { ApiResponse, PaginatedResult } from '../types/api.types.ts';
import { useAuthStore } from '../store/authStore.ts';

export type LookupParams = { page: number; limit: number; search?: string };

type Props<T extends { id: string }> = Omit<
  SelectProps<string>,
  'options' | 'onChange' | 'onSearch' | 'filterOption' | 'showSearch' | 'loading' | 'notFoundContent'
> & {
  lookupKey: readonly unknown[];
  loadPage: (params: LookupParams, signal: AbortSignal) => Promise<ApiResponse<PaginatedResult<T>>>;
  loadSelected?: (id: string, signal: AbortSignal) => Promise<ApiResponse<T | undefined>>;
  formatOption: (item: T) => string;
  onChange?: (value: string | undefined, item: T | undefined) => void;
  autoPick?: 'first' | 'single';
};

export function PaginatedSelect<T extends { id: string }>({
  lookupKey, loadPage, loadSelected, formatOption, onChange, value, disabled, autoPick, ...props
}: Props<T>) {
  const hotelId = useAuthStore((state) => state.user?.hotelId);
  const userId = useAuthStore((state) => state.user?.id);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const initialPickDone = useRef(false);
  const [picked, setPicked] = useState<{ item: T; hotelId: typeof hotelId; userId: typeof userId }>();
  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const key = [...lookupKey, hotelId, userId];
  const query = useInfiniteQuery({
    queryKey: [...key, 'lookup', term],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => loadPage({ page: pageParam, limit: 20, search: term || undefined }, signal),
    getNextPageParam: ({ data: { pagination } }) =>
      pagination.page < pagination.totalPages ? pagination.page + 1 : undefined,
    enabled: (open || Boolean(autoPick)) && !disabled,
    retry: false,
  });
  const items = new Map(query.data?.pages.flatMap(({ data }) => data.items).map((item) => [item.id, item]));
  const cached = picked?.item.id === value && picked?.hotelId === hotelId && picked?.userId === userId
    ? picked?.item
    : undefined;
  const detail = useQuery({
    queryKey: [...key, 'selected', value],
    queryFn: ({ signal }) => loadSelected!(value!, signal),
    enabled: Boolean(value && loadSelected && !cached && !items.has(value)),
    retry: false,
  });
  const selected = value ? items.get(value) ?? cached ?? detail.data?.data : undefined;
  const firstPage = term ? undefined : query.data?.pages[0]?.data;
  useEffect(() => {
    if (!autoPick || initialPickDone.current) return;
    if (value) {
      initialPickDone.current = true;
    } else if (firstPage) {
      initialPickDone.current = true;
      const first = firstPage.items[0];
      if (first && (autoPick === 'first' || firstPage.pagination.total === 1)) {
        onChange?.(first.id, first);
      }
    }
  }, [autoPick, firstPage, onChange, value]);
  const pendingSearch = search.trim() !== term;
  const loading = pendingSearch || query.isFetching;
  const retry = (
    <Button
      size="small"
      type="link"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())}
    >
      Thử lại
    </Button>
  );
  return (
    <Select<string>
      {...props}
      value={value}
      disabled={disabled}
      showSearch={{ filterOption: false, onSearch: setSearch, searchValue: search }}
      loading={loading}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSearch('');
          setTerm('');
        }
      }}
      labelRender={({ label }) => selected ? formatOption(selected) : label ?? value}
      onChange={(next) => {
        const item = items.get(next) ?? (next === value ? selected : undefined);
        setPicked(item ? { item, hotelId, userId } : undefined);
        setSearch('');
        setTerm('');
        onChange?.(next, item);
      }}
      options={pendingSearch ? [] : [...items.values()].map((item) => ({ value: item.id, label: formatOption(item) }))}
      notFoundContent={loading ? <Spin size="small" /> : query.isError ? retry : 'Không tìm thấy kết quả'}
      popupRender={(menu) => query.isFetchNextPageError ? <>{menu}{retry}</> : menu}
      onPopupScroll={({ currentTarget }) => {
        if (
          currentTarget.scrollHeight - currentTarget.scrollTop - currentTarget.clientHeight <= 24 &&
          query.hasNextPage && !loading && !query.isFetchNextPageError
        ) void query.fetchNextPage({ cancelRefetch: false });
      }}
    />
  );
}
