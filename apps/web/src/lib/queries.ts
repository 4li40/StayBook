import { queryOptions } from "@tanstack/react-query";

import {
  apiRequest,
  buildStaffReservationsQuery,
  buildStaffRoomsQuery,
  type AvailabilityResponse,
  type BookedDatesResponse,
  type ReservationDerivedState,
  type ReservationResponse,
  type ReservationsResponse,
  type StaffAmenitiesResponse,
  type StaffReservationFilters,
  type StaffReservationsResponse,
  type StaffRoomFilters,
  type StaffRoomsResponse,
  type Room,
  type RoomDetail,
} from "@/lib/api";

export type RoomsSearch = {
  checkInDate: string;
  checkOutDate: string;
  guests: string;
};

export type RoomAvailabilitySearch = RoomsSearch & {
  roomId: string;
};

export type MyReservationFilters = {
  page: number;
  pageSize: number;
  state?: ReservationDerivedState | "all";
};

type RoomsResponse = {
  rooms: Room[];
};

const normalizeRoomsSearch = (search: RoomsSearch) => ({
  checkInDate: search.checkInDate,
  checkOutDate: search.checkOutDate,
  guests: search.guests,
});

const normalizeStaffRoomFilters = (filters: StaffRoomFilters = {}) => ({
  status: filters.status ?? null,
  type: filters.type ?? null,
  amenityId: filters.amenityId ?? null,
  search: filters.search ?? null,
});

const normalizeStaffReservationFilters = (
  filters: StaffReservationFilters,
) => ({
  page: filters.page ?? 1,
  pageSize: filters.pageSize ?? 20,
  roomId: filters.roomId ?? null,
  status: filters.status ?? null,
  state: filters.state ?? null,
  dateFrom: filters.dateFrom ?? null,
  dateTo: filters.dateTo ?? null,
});

export const roomKeys = {
  all: ["rooms"] as const,
  lists: () => [...roomKeys.all, "list"] as const,
  list: (search: RoomsSearch) =>
    [...roomKeys.lists(), normalizeRoomsSearch(search)] as const,
  details: () => [...roomKeys.all, "detail"] as const,
  detail: (roomId: string) => [...roomKeys.details(), roomId] as const,
  availability: (search: RoomAvailabilitySearch) =>
    [
      ...roomKeys.all,
      "availability",
      {
        roomId: search.roomId,
        checkInDate: search.checkInDate,
        checkOutDate: search.checkOutDate,
        guests: search.guests,
      },
    ] as const,
  bookedDates: (roomId: string, month: string) =>
    [...roomKeys.all, "booked-dates", roomId, month] as const,
};

export const reservationKeys = {
  all: ["reservations"] as const,
  mine: () => [...reservationKeys.all, "mine"] as const,
  myList: (filters: MyReservationFilters) =>
    [
      ...reservationKeys.mine(),
      {
        page: filters.page,
        pageSize: filters.pageSize,
        state: filters.state ?? "all",
      },
    ] as const,
  myDetail: (reservationId: string) =>
    [...reservationKeys.mine(), "detail", reservationId] as const,
};

export const staffRoomKeys = {
  all: ["staff", "rooms"] as const,
  lists: () => [...staffRoomKeys.all, "list"] as const,
  list: (filters: StaffRoomFilters = {}) =>
    [...staffRoomKeys.lists(), normalizeStaffRoomFilters(filters)] as const,
};

export const staffAmenityKeys = {
  all: ["staff", "amenities"] as const,
};

export const staffReservationKeys = {
  all: ["staff", "reservations"] as const,
  lists: () => [...staffReservationKeys.all, "list"] as const,
  list: (filters: StaffReservationFilters) =>
    [
      ...staffReservationKeys.lists(),
      normalizeStaffReservationFilters(filters),
    ] as const,
};

export function roomsQueryOptions(search: RoomsSearch) {
  const normalized = normalizeRoomsSearch(search);
  const query = new URLSearchParams(normalized);

  return queryOptions({
    queryKey: roomKeys.list(normalized),
    queryFn: ({ signal }) =>
      apiRequest<RoomsResponse>(`/api/rooms?${query}`, { signal }),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function roomQueryOptions(roomId: string) {
  return queryOptions({
    queryKey: roomKeys.detail(roomId),
    queryFn: ({ signal }) =>
      apiRequest<RoomDetail>(`/api/rooms/${roomId}`, { signal }),
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function roomAvailabilityQueryOptions(search: RoomAvailabilitySearch) {
  const query = new URLSearchParams({
    checkInDate: search.checkInDate,
    checkOutDate: search.checkOutDate,
    guests: search.guests,
  });

  return queryOptions({
    queryKey: roomKeys.availability(search),
    queryFn: ({ signal }) =>
      apiRequest<AvailabilityResponse>(
        `/api/rooms/${search.roomId}/availability?${query}`,
        { signal },
      ),
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function roomBookedDatesQueryOptions(roomId: string, month: string) {
  return queryOptions({
    queryKey: roomKeys.bookedDates(roomId, month),
    queryFn: ({ signal }) =>
      apiRequest<BookedDatesResponse>(
        `/api/rooms/${roomId}/booked-dates?month=${month}`,
        { signal },
      ),
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function myReservationsQueryOptions(filters: MyReservationFilters) {
  const stateParam = filters.state && filters.state !== "all"
    ? `&state=${filters.state}`
    : "";

  return queryOptions({
    queryKey: reservationKeys.myList(filters),
    queryFn: ({ signal }) =>
      apiRequest<ReservationsResponse>(
        `/api/reservations/me?page=${filters.page}&pageSize=${filters.pageSize}${stateParam}`,
        { signal },
      ),
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function myReservationQueryOptions(reservationId: string) {
  return queryOptions({
    queryKey: reservationKeys.myDetail(reservationId),
    queryFn: ({ signal }) =>
      apiRequest<ReservationResponse>(
        `/api/reservations/me/${reservationId}`,
        { signal },
      ),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function staffRoomsQueryOptions(filters: StaffRoomFilters = {}) {
  return queryOptions({
    queryKey: staffRoomKeys.list(filters),
    queryFn: ({ signal }) =>
      apiRequest<StaffRoomsResponse>(
        `/api/staff/rooms${buildStaffRoomsQuery(filters)}`,
        { signal },
      ),
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function staffAmenitiesQueryOptions() {
  return queryOptions({
    queryKey: staffAmenityKeys.all,
    queryFn: ({ signal }) =>
      apiRequest<StaffAmenitiesResponse>("/api/staff/amenities", { signal }),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function staffReservationsQueryOptions(
  filters: StaffReservationFilters,
) {
  return queryOptions({
    queryKey: staffReservationKeys.list(filters),
    queryFn: ({ signal }) =>
      apiRequest<StaffReservationsResponse>(
        `/api/staff/reservations${buildStaffReservationsQuery(filters)}`,
        { signal },
      ),
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
