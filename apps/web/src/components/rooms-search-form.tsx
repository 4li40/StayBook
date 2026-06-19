import { Button } from "@StayBook/ui/components/button";
import { Input } from "@StayBook/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { Search } from "lucide-react";
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
      className="w-full max-w-4xl flex flex-col md:flex-row items-stretch gap-2 md:gap-0 rounded-2xl md:rounded-full border border-ghost-border bg-card p-2 md:pl-6 md:pr-2 shadow-xs transition-all hover:shadow-[0_8px_30px_rgba(26,43,60,0.04)] focus-within:border-gold focus-within:ring-1 focus-within:ring-gold/30"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.Field name="checkInDate">
        {(field) => (
          <div className="flex flex-1 flex-col justify-center px-4 py-2 md:py-1 text-left">
            <label htmlFor={field.name} className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-0.5">
              Check In
            </label>
            <Input
              id={field.name}
              name={field.name}
              type="date"
              autoComplete="off"
              className="h-auto border-0 p-0 text-foreground bg-transparent focus-visible:ring-0 focus-visible:border-transparent focus-visible:ring-offset-0 focus-visible:outline-none placeholder:text-muted-foreground/50 md:text-sm font-medium w-full cursor-pointer"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={field.state.meta.errors.length > 0}
            />
            {field.state.meta.errors.map((error) => (
              <p key={error?.message} className="text-[10px] text-destructive mt-0.5 leading-none">
                {error?.message}
              </p>
            ))}
          </div>
        )}
      </form.Field>

      <div className="hidden md:block w-px bg-border/60 my-2" />

      <form.Field name="checkOutDate">
        {(field) => (
          <div className="flex flex-1 flex-col justify-center px-4 py-2 md:py-1 text-left">
            <label htmlFor={field.name} className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-0.5">
              Check Out
            </label>
            <Input
              id={field.name}
              name={field.name}
              type="date"
              autoComplete="off"
              className="h-auto border-0 p-0 text-foreground bg-transparent focus-visible:ring-0 focus-visible:border-transparent focus-visible:ring-offset-0 focus-visible:outline-none placeholder:text-muted-foreground/50 md:text-sm font-medium w-full cursor-pointer"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={field.state.meta.errors.length > 0}
            />
            {field.state.meta.errors.map((error) => (
              <p key={error?.message} className="text-[10px] text-destructive mt-0.5 leading-none">
                {error?.message}
              </p>
            ))}
          </div>
        )}
      </form.Field>

      <div className="hidden md:block w-px bg-border/60 my-2" />

      <form.Field name="guests">
        {(field) => (
          <div className="flex md:w-[160px] flex-col justify-center px-4 py-2 md:py-1 text-left">
            <label htmlFor={field.name} className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-0.5">
              Guests
            </label>
            <Input
              id={field.name}
              name={field.name}
              type="number"
              min="1"
              max="20"
              inputMode="numeric"
              autoComplete="off"
              className="h-auto border-0 p-0 text-foreground bg-transparent focus-visible:ring-0 focus-visible:border-transparent focus-visible:ring-offset-0 focus-visible:outline-none placeholder:text-muted-foreground/50 md:text-sm font-medium w-full"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={field.state.meta.errors.length > 0}
            />
            {field.state.meta.errors.map((error) => (
              <p key={error?.message} className="text-[10px] text-destructive mt-0.5 leading-none">
                {error?.message}
              </p>
            ))}
          </div>
        )}
      </form.Field>

      <div className="flex items-center justify-center p-1">
        <Button type="submit" className="h-12 w-full md:w-12 md:rounded-full bg-primary text-primary-foreground hover:bg-primary/95 flex items-center justify-center gap-2 md:p-0 transition-transform active:scale-95 cursor-pointer font-sans" disabled={submitDisabled}>
          <Search className="h-4 w-4" />
          <span className="md:hidden font-medium text-sm">Search Rooms</span>
        </Button>
      </div>
    </form>
  );
}
