import { Button } from "@StayBook/ui/components/button";
import { Input } from "@StayBook/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { CalendarDays, Search, Users } from "lucide-react";
import z from "zod";

import { calendarDateSchema, getNightCount } from "@/lib/dates";
import type { RoomsSearch } from "@/lib/queries";

export const roomsSearchFormSchema = z
  .object({
    checkInDate: calendarDateSchema,
    checkOutDate: calendarDateSchema,
    guests: z.string().min(1, "Required").refine((v) => Number(v) >= 1 && Number.isInteger(Number(v)), "At least 1 guest"),
  })
  .refine(
    (value) => getNightCount(value.checkInDate, value.checkOutDate) > 0,
    {
      message: "Check-out must be after check-in.",
      path: ["checkOutDate"],
    },
  );

type RoomsSearchFormProps = {
  defaultValues: RoomsSearch;
  onSubmit: (value: RoomsSearch) => void;
  submitDisabled?: boolean;
};

export default function RoomsSearchForm({ defaultValues, onSubmit, submitDisabled }: RoomsSearchFormProps) {
  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: roomsSearchFormSchema,
    },
    onSubmit: ({ value }) => onSubmit(value),
  });

  return (
    <form
      noValidate
      className="w-full rounded-xl border border-ghost-border bg-white/85 p-4 shadow-xl backdrop-blur-md"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <form.Field name="checkInDate">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={field.name} className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase ml-1">
                Check In
              </label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id={field.name}
                  name={field.name}
                  type="date"
                  autoComplete="off"
                  className="h-11 w-full pl-10 pr-3 bg-background border-input rounded-lg text-sm font-medium focus-visible:border-gold focus-visible:ring-1 focus-visible:ring-gold/30"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
              </div>
              {field.state.meta.errors.map((error) => (
                <p key={error?.message} className="text-[10px] text-destructive leading-none">
                  {error?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <form.Field name="checkOutDate">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={field.name} className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase ml-1">
                Check Out
              </label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id={field.name}
                  name={field.name}
                  type="date"
                  autoComplete="off"
                  className="h-11 w-full pl-10 pr-3 bg-background border-input rounded-lg text-sm font-medium focus-visible:border-gold focus-visible:ring-1 focus-visible:ring-gold/30"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
              </div>
              {field.state.meta.errors.map((error) => (
                <p key={error?.message} className="text-[10px] text-destructive leading-none">
                  {error?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <form.Field name="guests">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={field.name} className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase ml-1">
                Guests
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id={field.name}
                  name={field.name}
                  type="number"
                  min="1"
                  max="20"
                  inputMode="numeric"
                  autoComplete="off"
                  className="h-11 w-full pl-10 pr-3 bg-background border-input rounded-lg text-sm font-medium focus-visible:border-gold focus-visible:ring-1 focus-visible:ring-gold/30"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
              </div>
              {field.state.meta.errors.map((error) => (
                <p key={error?.message} className="text-[10px] text-destructive leading-none">
                  {error?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <Button
          type="submit"
          disabled={submitDisabled}
          className="h-11 w-full rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
        >
          <Search className="h-4 w-4" />
          <span>Search Rooms</span>
        </Button>
      </div>
    </form>
  );
}
