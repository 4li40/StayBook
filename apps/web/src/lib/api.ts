import { env } from "@StayBook/env/web";

type ApiErrorBody = {
  code: string;
  message: string;
  issues?: Array<{
    path: string;
    message: string;
  }>;
};

type ApiEnvelope<T> =
  | {
      data: T;
      error?: never;
    }
  | {
      data?: never;
      error: ApiErrorBody;
    };

export type Amenity = {
  id: string;
  name: string;
};

export type Room = {
  id: string;
  name: string;
  type: string;
  description: string;
  maxGuests: number;
  nightlyPrice: string;
  primaryPhotoUrl: string | null;
  amenities: Amenity[];
};

export type StaffRoom = Room & {
  active: boolean;
};

export type StaffRoomsResponse = {
  rooms: StaffRoom[];
};

export type Photo = {
  id: string;
  url: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
};

export type RoomDetail = {
  id: string;
  name: string;
  type: string;
  description: string;
  maxGuests: number;
  nightlyPrice: string;
  photos: Photo[];
  amenities: Amenity[];
};

export type ReservationStatus = "confirmed" | "cancelled";

export type Reservation = {
  id: string;
  roomId: string;
  guestId: string;
  checkInDate: string;
  checkOutDate: string;
  totalPrice: string;
  status: ReservationStatus;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  room: {
    id: string;
    name: string;
    type: string;
    maxGuests: number;
    nightlyPrice: string;
    primaryPhotoUrl: string | null;
  };
};

export type ReservationsResponse = {
  reservations: Reservation[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
};

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues: ApiErrorBody["issues"] = [],
  ) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${env.VITE_SERVER_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok) {
    const error = payload?.error;
    throw new ApiClientError(
      response.status,
      error?.code ?? "REQUEST_FAILED",
      error?.message ?? "Request failed. Try again.",
      error?.issues,
    );
  }

  if (!payload?.data) {
    throw new ApiClientError(response.status, "EMPTY_RESPONSE", "Server returned no data.");
  }

  return payload.data;
}

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    const issueText = error.issues?.map((issue) => issue.message).join(" ");
    return issueText ? `${error.message} ${issueText}` : error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Try again.";
}
