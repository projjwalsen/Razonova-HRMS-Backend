import { z } from "zod";

export const featureSchema = z.record(
    z.string(),
    z.object({
        enabled: z.boolean(),
        max: z.number().optional(),
    })
)