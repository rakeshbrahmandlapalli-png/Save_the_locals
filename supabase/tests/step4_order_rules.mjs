import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const slug = "placeholder-manikonda";
const rice = "30000000-0000-0000-0000-000000000001";
const salt = "30000000-0000-0000-0000-000000000005";
const suffix = String(Date.now()).slice(-8);
const tamperPhone = `8${suffix}0`;
const limitPhone = `9${suffix}0`;

function report(ok, message) {
  console.log(`${ok ? "PASS" : "FAIL"} ${message}`);
  if (!ok) process.exitCode = 1;
}

async function place(phone, items) {
  return supabase.rpc("place_order", {
    shop_slug: slug,
    items,
    customer: { name: "Step 4 test", phone, notes: "Automated acceptance test" },
    fulfilment: "pickup",
    address: "",
    payment_method: "cod",
    source: "step4-test",
  });
}

const tampered = await place(tamperPhone, [{ product_id: rice, qty: 1, price: 1 }]);
if (tampered.error) throw tampered.error;
const status = await supabase.rpc("order_status", { shop_slug: slug, code: tampered.data, phone: tamperPhone });
const actualTotal = Number(status.data?.[0]?.total);
report(actualTotal === 360, `tampered browser price ₹1 ignored; database total ₹${actualTotal}`);

const below = await place(`7${suffix}0`, [{ product_id: salt, qty: 1 }]);
report(Boolean(below.error?.message.includes("below the shop minimum")), `below-minimum order refused: ${below.error?.message ?? "accepted"}`);

for (let attempt = 1; attempt <= 5; attempt += 1) {
  const result = await place(limitPhone, [{ product_id: rice, qty: 1 }]);
  if (result.error) throw new Error(`Order ${attempt} unexpectedly failed: ${result.error.message}`);
}
const sixth = await place(limitPhone, [{ product_id: rice, qty: 1 }]);
report(Boolean(sixth.error?.message.includes("Order limit reached")), `sixth order refused: ${sixth.error?.message ?? "accepted"}`);
