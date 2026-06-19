import { Button } from "@StayBook/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@StayBook/ui/components/card";
import { Checkbox } from "@StayBook/ui/components/checkbox";
import { Input } from "@StayBook/ui/components/input";
import { Label } from "@StayBook/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@StayBook/ui/components/select";
import { Skeleton } from "@StayBook/ui/components/skeleton";
import { Textarea } from "@StayBook/ui/components/textarea";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  BedDouble,
  Check,
  CircleOff,
  ListFilter,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ApiClientError,
  apiRequest,
  getErrorMessage,
  type StaffRoom,
  type StaffRoomFilters,
  type StaffRoomInput,
  type StaffRoomResponse,
  type StaffRoomStatus,
} from "@/lib/api";
import { formatCents } from "@/lib/format";
import {
  roomKeys,
  staffAmenitiesQueryOptions,
  staffAmenityKeys,
  staffRoomKeys,
  staffRoomsQueryOptions,
} from "@/lib/queries";

export const Route = createFileRoute("/_staff/staff")({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData({
        ...staffRoomsQueryOptions({}),
        revalidateIfStale: true,
      }),
      queryClient.ensureQueryData({
        ...staffAmenitiesQueryOptions(),
        revalidateIfStale: true,
      }),
    ]),
  component: RouteComponent,
});

type PhotoFormState = {
  url: string;
  altText: string;
  isPrimary: boolean;
};

type RoomFormState = {
  name: string;
  type: string;
  description: string;
  maxGuests: string;
  nightlyPrice: string;
  amenityIds: string[];
  photos: PhotoFormState[];
};

type FieldErrors = Partial<Record<keyof RoomFormState | "form", string>>;

const emptyRoomForm: RoomFormState = {
  name: "",
  type: "",
  description: "",
  maxGuests: "2",
  nightlyPrice: "",
  amenityIds: [],
  photos: [],
};

function roomToForm(room: StaffRoom): RoomFormState {
  return {
    name: room.name,
    type: room.type,
    description: room.description,
    maxGuests: String(room.maxGuests),
    nightlyPrice: String(room.nightlyPrice / 100),
    amenityIds: room.amenities.map((amenity) => amenity.id),
    photos: room.photos.map((photo) => ({
      url: photo.url,
      altText: photo.altText ?? "",
      isPrimary: photo.isPrimary,
    })),
  };
}

function toPayload(form: RoomFormState): StaffRoomInput {
  return {
    name: form.name.trim(),
    type: form.type.trim(),
    description: form.description.trim(),
    maxGuests: Number(form.maxGuests),
    nightlyPrice: Math.round(Number(form.nightlyPrice.replace(",", ".")) * 100),
    amenityIds: form.amenityIds,
    photos: form.photos
      .map((photo) => ({
        url: photo.url.trim(),
        altText: photo.altText.trim() || undefined,
        isPrimary: photo.isPrimary,
      }))
      .filter((photo) => photo.url.length > 0),
  };
}

function collectFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ApiClientError)) {
    return {};
  }

  return (error.issues ?? []).reduce<FieldErrors>((fieldErrors, issue) => {
    const field = issue.path.split(".")[0] as keyof RoomFormState;

    if (field in emptyRoomForm && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }

    return fieldErrors;
  }, {});
}

type RoomFilterForm = {
  status: string;
  type: string;
  amenityId: string;
  search: string;
};

type RoomFilterFieldErrors = Partial<
  Record<keyof RoomFilterForm | "form", string>
>;

const emptyRoomFilterForm: RoomFilterForm = {
  status: "",
  type: "",
  amenityId: "",
  search: "",
};

const statusOptions: Array<{ value: StaffRoomStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

function toRoomFilters(form: RoomFilterForm): StaffRoomFilters {
  const status = form.status as StaffRoomFilters["status"];
  return {
    status: statusOptions.some((option) => option.value === status) ? status : undefined,
    type: form.type.trim() || undefined,
    amenityId: form.amenityId || undefined,
    search: form.search.trim() || undefined,
  };
}

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [actionRoomId, setActionRoomId] = useState<string | null>(null);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<RoomFormState>(emptyRoomForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [filterForm, setFilterForm] = useState<RoomFilterForm>(emptyRoomFilterForm);
  const [appliedFilters, setAppliedFilters] = useState<StaffRoomFilters>({});
  const [filterErrors, setFilterErrors] = useState<RoomFilterFieldErrors>({});
  const roomsQuery = useQuery(staffRoomsQueryOptions(appliedFilters));
  const amenitiesQuery = useQuery(staffAmenitiesQueryOptions());
  const rooms = roomsQuery.data?.rooms ?? [];
  const amenities = amenitiesQuery.data?.amenities ?? [];
  const isLoading = roomsQuery.isPending || amenitiesQuery.isPending;
  const errorMessage =
    roomsQuery.error || amenitiesQuery.error
      ? getErrorMessage(roomsQuery.error ?? amenitiesQuery.error)
      : null;

  const activeCount = useMemo(
    () => rooms.reduce((count, room) => count + (room.active ? 1 : 0), 0),
    [rooms],
  );
  const inactiveCount = rooms.length - activeCount;
  const knownRoomTypes = useMemo(
    () => Array.from(new Set(rooms.map((room) => room.type))).sort(),
    [rooms],
  );
  const staffUser = session.data?.user;
  const editingRoom = editingRoomId
    ? rooms.find((room) => room.id === editingRoomId)
    : null;

  const hasActiveFilters = Boolean(
    appliedFilters.status ||
      appliedFilters.type ||
      appliedFilters.amenityId ||
      appliedFilters.search,
  );

  if (!staffUser) {
    return null;
  }

  function updateFilterField<Key extends keyof RoomFilterForm>(
    key: Key,
    value: RoomFilterForm[Key],
  ) {
    setFilterForm((current) => ({ ...current, [key]: value }));
    setFilterErrors((current) => ({
      ...current,
      [key]: undefined,
      form: undefined,
    }));
  }

  function applyFilters() {
    setFilterErrors({});
    setAppliedFilters(toRoomFilters(filterForm));
  }

  function resetFilters() {
    setFilterForm(emptyRoomFilterForm);
    setFilterErrors({});
    setAppliedFilters({});
  }

  function updateForm<Key extends keyof RoomFormState>(
    key: Key,
    value: RoomFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
  }

  function startCreate() {
    setEditingRoomId(null);
    setForm(emptyRoomForm);
    setFieldErrors({});
    setIsFormOpen(true);
  }

  function closeForm() {
    if (isSaving) {
      return;
    }

    setIsFormOpen(false);
    setEditingRoomId(null);
    setForm(emptyRoomForm);
    setFieldErrors({});
  }

  function startEdit(room: StaffRoom) {
    setEditingRoomId(room.id);
    setForm(roomToForm(room));
    setFieldErrors({});
    setIsFormOpen(true);
  }

  function toggleAmenity(amenityId: string, checked: boolean) {
    updateForm(
      "amenityIds",
      checked
        ? [...form.amenityIds, amenityId]
        : form.amenityIds.filter((id) => id !== amenityId),
    );
  }

  function addPhoto() {
    updateForm("photos", [
      ...form.photos,
      {
        url: "",
        altText: "",
        isPrimary: form.photos.length === 0,
      },
    ]);
  }

  function updatePhoto(index: number, nextPhoto: Partial<PhotoFormState>) {
    updateForm(
      "photos",
      form.photos.map((photo, photoIndex) =>
        photoIndex === index ? { ...photo, ...nextPhoto } : photo,
      ),
    );
  }

  function removePhoto(index: number) {
    const nextPhotos = form.photos.filter((_, photoIndex) => photoIndex !== index);
    if (nextPhotos.length > 0 && !nextPhotos.some((photo) => photo.isPrimary)) {
      nextPhotos[0] = { ...nextPhotos[0], isPrimary: true };
    }
    updateForm("photos", nextPhotos);
  }

  function setPrimaryPhoto(index: number) {
    updateForm(
      "photos",
      form.photos.map((photo, photoIndex) => ({
        ...photo,
        isPrimary: photoIndex === index,
      })),
    );
  }

  async function saveRoom() {
    setIsSaving(true);
    setFieldErrors({});

    try {
      const payload = toPayload(form);
      const path = editingRoomId
        ? `/api/staff/rooms/${editingRoomId}`
        : "/api/staff/rooms";
      const method = editingRoomId ? "PATCH" : "POST";

      await apiRequest<StaffRoomResponse>(path, {
        method,
        body: JSON.stringify(payload),
      });

      toast.success(editingRoomId ? "Room updated." : "Room created.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: staffRoomKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: roomKeys.all }),
      ]);
      setIsFormOpen(false);
      setEditingRoomId(null);
      setForm(emptyRoomForm);
    } catch (error) {
      setFieldErrors({
        ...collectFieldErrors(error),
        form: getErrorMessage(error),
      });
      toast.error(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function setRoomActive(room: StaffRoom, active: boolean) {
    const confirmed = window.confirm(
      `${active ? "Reactivate" : "Deactivate"} ${room.name}?`,
    );

    if (!confirmed) {
      return;
    }

    setActionRoomId(room.id);

    try {
      await apiRequest<StaffRoomResponse>(
        `/api/staff/rooms/${room.id}/${active ? "reactivate" : "deactivate"}`,
        { method: "POST" },
      );
      toast.success(active ? "Room reactivated." : "Room deactivated.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: staffRoomKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: roomKeys.all }),
      ]);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setActionRoomId(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-heading text-foreground tracking-tight text-balance">
            Staff Inventory
          </h1>
          <p className="text-sm text-muted-foreground">
            Welcome, {staffUser.name}. Create, edit, pause, and restore room inventory.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: staffRoomKeys.lists() });
              void queryClient.invalidateQueries({ queryKey: staffAmenityKeys.all });
            }}
            disabled={isLoading || roomsQuery.isFetching || amenitiesQuery.isFetching}
          >
            <RefreshCw data-icon="inline-start" />
            Refresh
          </Button>
          <Button type="button" onClick={startCreate}>
            <Plus data-icon="inline-start" />
            Add Room
          </Button>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="gap-1">
            <CardDescription>Total Rooms</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{rooms.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="gap-1">
            <CardDescription>Active Rooms</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{activeCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="gap-1">
            <CardDescription>Inactive Rooms</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{inactiveCount}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
          <CardDescription>
            Narrow rooms by status, type, amenity, or name.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters();
            }}
          >
            {filterErrors.form ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {filterErrors.form}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-status">Status</Label>
                <Select
                  value={filterForm.status}
                  onValueChange={(value) =>
                    updateFilterField("status", String(value ?? ""))
                  }
                >
                  <SelectTrigger id="filter-status" className="w-full">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All statuses</SelectItem>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-type">Type</Label>
                <Select
                  value={filterForm.type}
                  onValueChange={(value) =>
                    updateFilterField("type", String(value ?? ""))
                  }
                >
                  <SelectTrigger id="filter-type" className="w-full">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All types</SelectItem>
                    {knownRoomTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-amenity">Amenity</Label>
                <Select
                  value={filterForm.amenityId}
                  onValueChange={(value) =>
                    updateFilterField("amenityId", String(value ?? ""))
                  }
                >
                  <SelectTrigger id="filter-amenity" className="w-full">
                    <SelectValue placeholder="All amenities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All amenities</SelectItem>
                    {amenities.map((amenity) => (
                      <SelectItem key={amenity.id} value={amenity.id}>
                        {amenity.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-search">Search</Label>
                <Input
                  id="filter-search"
                  type="text"
                  value={filterForm.search}
                  onChange={(event) =>
                    updateFilterField("search", event.target.value)
                  }
                  placeholder="Room name or type"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={isLoading}>
                <ListFilter data-icon="inline-start" />
                Apply Filters
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={resetFilters}
                disabled={isLoading || !hasActiveFilters}
              >
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isFormOpen ? (
        <div
          className="fixed inset-0 flex items-start justify-center overflow-y-auto bg-background/80 px-4 py-8 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="room-form-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeForm();
            }
          }}
        >
          <Card className="max-h-[calc(100vh-4rem)] w-full max-w-2xl overflow-hidden shadow-lg">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <CardTitle id="room-form-title">
                    {editingRoom ? "Edit Room" : "Add Room"}
                  </CardTitle>
                  <CardDescription>
                    {editingRoom
                      ? `Editing ${editingRoom.name}`
                      : "Create a staff-managed room record."}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={closeForm}
                  disabled={isSaving}
                  aria-label="Close room form"
                >
                  <X />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="max-h-[calc(100vh-11rem)] overflow-y-auto">
            <form
              className="flex flex-col gap-5"
              onSubmit={(event) => {
                event.preventDefault();
                saveRoom();
              }}
            >
              {fieldErrors.form ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {fieldErrors.form}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="room-name">Name</Label>
                  <Input
                    id="room-name"
                    value={form.name}
                    onChange={(event) => updateForm("name", event.target.value)}
                    aria-invalid={Boolean(fieldErrors.name)}
                    placeholder="Deluxe King Suite"
                  />
                  {fieldErrors.name ? (
                    <p className="text-xs text-destructive">{fieldErrors.name}</p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="room-type">Type</Label>
                  <Input
                    id="room-type"
                    value={form.type}
                    onChange={(event) => updateForm("type", event.target.value)}
                    aria-invalid={Boolean(fieldErrors.type)}
                    placeholder="suite"
                  />
                  {fieldErrors.type ? (
                    <p className="text-xs text-destructive">{fieldErrors.type}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="room-description">Description</Label>
                <Textarea
                  id="room-description"
                  value={form.description}
                  onChange={(event) => updateForm("description", event.target.value)}
                  aria-invalid={Boolean(fieldErrors.description)}
                  placeholder="Room highlights and guest-facing details"
                />
                {fieldErrors.description ? (
                  <p className="text-xs text-destructive">{fieldErrors.description}</p>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="room-capacity">Capacity</Label>
                  <Input
                    id="room-capacity"
                    type="number"
                    min="1"
                    max="20"
                    inputMode="numeric"
                    value={form.maxGuests}
                    onChange={(event) => updateForm("maxGuests", event.target.value)}
                    aria-invalid={Boolean(fieldErrors.maxGuests)}
                  />
                  {fieldErrors.maxGuests ? (
                    <p className="text-xs text-destructive">{fieldErrors.maxGuests}</p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="room-price">Nightly Price</Label>
                  <Input
                    id="room-price"
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={form.nightlyPrice}
                    onChange={(event) => updateForm("nightlyPrice", event.target.value)}
                    aria-invalid={Boolean(fieldErrors.nightlyPrice)}
                    placeholder="199.00"
                  />
                  {fieldErrors.nightlyPrice ? (
                    <p className="text-xs text-destructive">{fieldErrors.nightlyPrice}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>Amenities</Label>
                  <span className="text-xs text-muted-foreground">
                    {form.amenityIds.length} selected
                  </span>
                </div>
                {amenities.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {amenities.map((amenity) => {
                      const checked = form.amenityIds.includes(amenity.id);

                      return (
                        <label
                          key={amenity.id}
                          className="flex min-h-8 items-center gap-2 rounded-lg border border-border/70 px-2.5 py-1.5 text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => toggleAmenity(amenity.id, value === true)}
                          />
                          <span className="truncate">{amenity.name}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Seed amenities before assigning them to rooms.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>Photos</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addPhoto}>
                    <Plus data-icon="inline-start" />
                    Add Photo
                  </Button>
                </div>

                {form.photos.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                    Add at least one URL to show this room visually in staff tools and guest search.
                  </p>
                ) : null}

                {form.photos.map((photo, index) => (
                  <div key={index} className="flex flex-col gap-2 rounded-lg border border-border/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={photo.isPrimary}
                          onCheckedChange={() => setPrimaryPhoto(index)}
                        />
                        Primary
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removePhoto(index)}
                        aria-label="Remove photo"
                      >
                        <X />
                      </Button>
                    </div>
                    {photo.url.trim() ? (
                      <div className="aspect-[16/9] overflow-hidden rounded-lg bg-muted">
                        <img
                          src={photo.url.trim()}
                          alt={photo.altText.trim() || "Room photo preview"}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : null}
                    <Input
                      value={photo.url}
                      onChange={(event) => updatePhoto(index, { url: event.target.value })}
                      placeholder="https://example.com/room.jpg"
                      aria-invalid={Boolean(fieldErrors.photos)}
                    />
                    <Input
                      value={photo.altText}
                      onChange={(event) => updatePhoto(index, { altText: event.target.value })}
                      placeholder="Alt text"
                    />
                  </div>
                ))}

                {fieldErrors.photos ? (
                  <p className="text-xs text-destructive">{fieldErrors.photos}</p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" disabled={isSaving}>
                  <Save data-icon="inline-start" />
                  {isSaving ? "Saving..." : editingRoom ? "Save Room" : "Create Room"}
                </Button>
                <Button type="button" variant="outline" onClick={closeForm} disabled={isSaving}>
                  <X data-icon="inline-start" />
                  {editingRoom ? "Cancel Edit" : "Cancel"}
                </Button>
              </div>
            </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <section className="flex flex-col gap-4" aria-live="polite">
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <Card key={index}>
                <CardHeader>
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))
          : null}

          {!isLoading && rooms.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-lg border border-border/60 bg-muted/30 p-10 text-center">
              <BedDouble aria-hidden="true" className="size-10 text-muted-foreground" />
              <div className="flex flex-col gap-1.5">
                <h2 className="font-heading text-lg text-foreground">No Rooms Found</h2>
                <p className="text-sm text-muted-foreground">
                  {hasActiveFilters
                    ? "Try adjusting or resetting the filters."
                    : "Use Add Room to create the first room."}
                </p>
              </div>
            </div>
          ) : null}

          {!isLoading
            ? rooms.map((room) => (
                <Card key={room.id}>
                  <CardHeader>
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex min-w-0 flex-col gap-4 sm:flex-row">
                        <div className="flex aspect-[4/3] w-full shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted sm:w-40">
                          {room.primaryPhotoUrl ? (
                            <img
                              src={room.primaryPhotoUrl}
                              alt={room.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <BedDouble aria-hidden="true" className="text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex min-w-0 flex-col gap-1.5">
                          <CardTitle>{room.name}</CardTitle>
                          <CardDescription className="capitalize">
                            {room.type} · up to {room.maxGuests} guests ·{" "}
                            {formatCents(room.nightlyPrice)} / night
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex w-fit items-center gap-1.5 rounded-lg border border-border/70 px-2.5 py-1 text-sm">
                        {room.active ? (
                          <Check aria-hidden="true" className="text-primary" />
                        ) : (
                          <CircleOff aria-hidden="true" className="text-muted-foreground" />
                        )}
                        <span className="font-medium">{room.active ? "Active" : "Inactive"}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4 text-sm">
                    <p className="line-clamp-2 text-muted-foreground">{room.description}</p>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <p className="mb-1 text-xs text-muted-foreground">Photos</p>
                        <p className="font-medium tabular-nums">{room.photos.length}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-muted-foreground">Amenities</p>
                        <p className="font-medium tabular-nums">{room.amenities.length}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-muted-foreground">Primary Image</p>
                        <p className="truncate font-medium">
                          {room.primaryPhotoUrl ? "Configured" : "Missing"}
                        </p>
                      </div>
                    </div>

                    {room.amenities.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {room.amenities.slice(0, 8).map((amenity) => (
                          <span
                            key={amenity.id}
                            className="rounded-lg bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                          >
                            {amenity.name}
                          </span>
                        ))}
                        {room.amenities.length > 8 ? (
                          <span className="rounded-lg bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                            +{room.amenities.length - 8}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </CardContent>
                  <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" onClick={() => startEdit(room)}>
                      <Pencil data-icon="inline-start" />
                      Edit
                    </Button>
                    {room.active ? (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => setRoomActive(room, false)}
                        disabled={actionRoomId === room.id}
                      >
                        <Trash2 data-icon="inline-start" />
                        {actionRoomId === room.id ? "Working..." : "Deactivate"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setRoomActive(room, true)}
                        disabled={actionRoomId === room.id}
                      >
                        <RotateCcw data-icon="inline-start" />
                        {actionRoomId === room.id ? "Working..." : "Reactivate"}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))
            : null}
      </section>
    </main>
  );
}
