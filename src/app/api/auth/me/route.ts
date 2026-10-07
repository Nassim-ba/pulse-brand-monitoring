import { getCurrentUser } from "@/lib/auth";
import { withUser } from "@/lib/context";

export const GET = () => withUser(async () => Response.json({ user: await getCurrentUser() }));
