"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase-browser";

export function usePlatformAdminSession() {
  const supabase = getBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [authorised, setAuthorised] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");

  const initialise = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setSignedIn(Boolean(session));
    if (!session) { setAuthorised(null); return; }
    const { data } = await supabase.from("platform_admins").select("user_id").eq("user_id", session.user.id).maybeSingle();
    setAuthorised(Boolean(data));
  }, [supabase]);

  useEffect(() => {
    const task = window.setTimeout(() => void initialise(), 0);
    return () => window.clearTimeout(task);
  }, [initialise]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setMessage(error.message); return; }
    await initialise();
  }

  async function signOut() {
    await supabase.auth.signOut();
    await initialise();
  }

  return { supabase, email, setEmail, password, setPassword, signedIn, authorised, message, setMessage, signIn, signOut };
}
