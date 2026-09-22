"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase-browser";

export type StaffShop = { id: string; name: string; phone: string };

export function useShopStaffSession(slug: string) {
  const supabase = getBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shop, setShop] = useState<StaffShop | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [authorised, setAuthorised] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");

  const initialise = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setSignedIn(Boolean(session));
    if (!session) { setAuthorised(null); return; }
    const { data: foundShop } = await supabase.from("shops").select("id,name,phone").eq("slug", slug).single();
    if (!foundShop) { setMessage("Shop not found."); return; }
    const { data: membership } = await supabase.from("shop_staff").select("role").eq("shop_id", foundShop.id).maybeSingle();
    if (!membership) { setShop(foundShop); setAuthorised(false); return; }
    setShop(foundShop); setAuthorised(true);
  }, [slug, supabase]);

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

  return { supabase, email, setEmail, password, setPassword, shop, signedIn, authorised, message, setMessage, signIn, signOut, initialise };
}
