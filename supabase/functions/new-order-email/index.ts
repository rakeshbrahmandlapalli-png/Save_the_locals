declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

type WebhookPayload = { type: string; record?: { shop_id?: string; code?: string; total?: number; fulfilment?: string } };

Deno.serve(async (request) => {
  const expectedSecret = Deno.env.get("ORDER_WEBHOOK_SECRET");
  if (!expectedSecret || request.headers.get("x-webhook-secret") !== expectedSecret) return new Response("Unauthorised", { status: 401 });
  const payload = await request.json() as WebhookPayload;
  if (payload.type !== "INSERT" || !payload.record?.shop_id) return new Response("Ignored", { status: 202 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const shopResponse = await fetch(`${supabaseUrl}/rest/v1/shops?id=eq.${payload.record.shop_id}&select=name,owner_email`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const [shop] = await shopResponse.json() as Array<{ name: string; owner_email: string | null }>;
  if (!shop?.owner_email) return new Response("No owner email configured", { status: 202 });

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("ORDER_EMAIL_FROM") || "Save the Locals <onboarding@resend.dev>",
      to: [shop.owner_email],
      subject: `New order ${payload.record.code} — ${shop.name}`,
      text: `A new ${payload.record.fulfilment} order ${payload.record.code} for ₹${payload.record.total} is waiting in the owner console.`,
    }),
  });
  if (!emailResponse.ok) return new Response(await emailResponse.text(), { status: 502 });
  return new Response("Email sent", { status: 200 });
});
