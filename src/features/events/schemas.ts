import { z } from "zod";

export const createEventSchema = z
  .object({
    calendarId: z.string().uuid(),
    title: z.string().trim().min(1, "Dê um título ao evento.").max(500),
    description: z.string().trim().max(5000).optional(),
    location: z.string().trim().max(500).optional(),
    startsAt: z.string().min(1, "Informe o início."),
    endsAt: z.string().min(1, "Informe o fim."),
    allDay: z.boolean().default(false),
    timezone: z.string().trim().optional(),
    attendeeEmails: z.array(z.string().email()).max(50).default([]),
    addMeet: z.boolean().default(false),
  })
  .refine((input) => new Date(input.endsAt) > new Date(input.startsAt), {
    message: "O fim precisa ser depois do início.",
    path: ["endsAt"],
  });

export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = z
  .object({
    eventId: z.string().uuid(),
    title: z.string().trim().min(1, "Dê um título ao evento.").max(500).optional(),
    description: z.string().trim().max(5000).optional(),
    location: z.string().trim().max(500).optional(),
    startsAt: z.string().min(1).optional(),
    endsAt: z.string().min(1).optional(),
    allDay: z.boolean().optional(),
    timezone: z.string().trim().optional(),
    attendeeEmails: z.array(z.string().email()).max(50).optional(),
  })
  .refine((input) => !input.startsAt || !input.endsAt || new Date(input.endsAt) > new Date(input.startsAt), {
    message: "O fim precisa ser depois do início.",
    path: ["endsAt"],
  });

export type UpdateEventInput = z.infer<typeof updateEventSchema>;
