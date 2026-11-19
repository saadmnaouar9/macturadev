"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertAuth } from "@/lib/auth";

export async function markNotificationsSeen() {
  const auth = await assertAuth();
  await db.membership.update({ where: { id: auth.membershipId }, data: { notificationsSeenAt: new Date() } });
  revalidatePath("/", "layout");
}
