/**
 * Supabase Page Example — Next.js App Router.
 *
 * Migration reference for future Next.js frontend.
 * ⚠️ This file is NOT used by the current Fastify backend.
 *
 * @module utils/supabase/page
 */

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export default async function Page() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: todos } = await supabase.from("todos").select();

  return (
    <ul>
      {todos?.map((todo) => (
        <li key={todo.id}>{todo.name}</li>
      ))}
    </ul>
  );
}
