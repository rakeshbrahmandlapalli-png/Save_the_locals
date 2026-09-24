"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useShopStaffSession } from "@/lib/use-shop-staff-session";
import { CATEGORY_ICON_OPTIONS, CategoryIcon } from "@/lib/category-icons";

type Category = { id: string; name: string; icon: string | null; sort: number };
type Product = { id: string; category_id: string | null; name: string; unit: string; price: number; image_url: string | null; in_stock: boolean; active: boolean; sort: number };
type CsvRow = { rowNumber: number; category: string; name: string; unit: string; price: number | null; imageUrl: string; inStock: boolean; errors: string[] };

export function CatalogueConsole({ slug }: { slug: string }) {
  const { supabase, email, setEmail, password, setPassword, shop, signedIn, authorised, message, setMessage, signIn, signOut } = useShopStaffSession(slug);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("general");
  const [newProduct, setNewProduct] = useState({ name: "", unit: "", price: "", category_id: "", image_url: "" });
  const [csvPreview, setCsvPreview] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async (shopId: string) => {
    const [{ data: cats, error: catError }, { data: prods, error: prodError }] = await Promise.all([
      supabase.from("categories").select("id,name,icon,sort").eq("shop_id", shopId).order("sort"),
      supabase.from("products").select("id,category_id,name,unit,price,image_url,in_stock,active,sort").eq("shop_id", shopId).order("sort"),
    ]);
    if (catError) { setMessage(catError.message); return; }
    if (prodError) { setMessage(prodError.message); return; }
    setCategories(cats ?? []);
    setProducts(prods ?? []);
  }, [setMessage, supabase]);

  useEffect(() => {
    if (!shop || !authorised) return;
    const task = window.setTimeout(() => void load(shop.id), 0);
    return () => window.clearTimeout(task);
  }, [authorised, load, shop]);

  async function addCategory(event: React.FormEvent) {
    event.preventDefault();
    if (!shop || !newCategoryName.trim()) return;
    const { error } = await supabase.from("categories").insert({ shop_id: shop.id, name: newCategoryName.trim(), icon: newCategoryIcon, sort: categories.length });
    if (error) { setMessage(error.message); return; }
    setNewCategoryName(""); setNewCategoryIcon("general");
    await load(shop.id);
  }

  async function setCategoryIcon(id: string, icon: string) {
    if (!shop) return;
    const { error } = await supabase.from("categories").update({ icon }).eq("id", id);
    if (error) { setMessage(error.message); return; }
    await load(shop.id);
  }

  async function deleteCategory(id: string) {
    if (!shop || !window.confirm("Delete this category? Its products stay, just uncategorised.")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) { setMessage(error.message); return; }
    await load(shop.id);
  }

  async function addProduct(event: React.FormEvent) {
    event.preventDefault();
    if (!shop) return;
    const price = Number(newProduct.price);
    if (!newProduct.name.trim() || !newProduct.unit.trim() || Number.isNaN(price) || price < 0) { setMessage("Fill in name, unit, and a valid price."); return; }
    const { error } = await supabase.from("products").insert({
      shop_id: shop.id,
      category_id: newProduct.category_id || null,
      name: newProduct.name.trim(),
      unit: newProduct.unit.trim(),
      price,
      image_url: newProduct.image_url.trim() || null,
      sort: products.length,
    });
    if (error) { setMessage(error.message); return; }
    setNewProduct({ name: "", unit: "", price: "", category_id: "", image_url: "" });
    await load(shop.id);
  }

  async function saveProduct(id: string, patch: Partial<Pick<Product, "name" | "unit" | "price" | "image_url">>) {
    if (!shop) return;
    const { error } = await supabase.from("products").update(patch).eq("id", id);
    if (error) { setMessage(error.message); return; }
    await load(shop.id);
  }

  async function toggleProduct(product: Product, field: "in_stock" | "active") {
    if (!shop) return;
    const { error } = await supabase.from("products").update({ [field]: !product[field] }).eq("id", product.id);
    if (error) { setMessage(error.message); return; }
    await load(shop.id);
  }

  async function deleteProduct(id: string) {
    if (!shop || !window.confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { setMessage(error.message); return; }
    await load(shop.id);
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const rows = parseCsv(await file.text());
    if (rows.length < 2) { setMessage("The CSV needs a header row and at least one item row."); return; }
    setCsvPreview(buildCsvPreview(rows));
    setMessage("");
  }

  async function importCsv() {
    if (!shop) return;
    const validRows = csvPreview.filter((row) => row.errors.length === 0);
    if (validRows.length === 0) { setMessage("No valid rows to import."); return; }
    setImporting(true);
    const byName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id] as const));
    const missingNames = Array.from(new Set(validRows.map((row) => row.category))).filter((name) => !byName.has(name.toLowerCase()));
    if (missingNames.length > 0) {
      const { data: inserted, error } = await supabase.from("categories")
        .insert(missingNames.map((name, i) => ({ shop_id: shop.id, name, sort: categories.length + i })))
        .select("id,name");
      if (error) { setMessage(error.message); setImporting(false); return; }
      for (const row of inserted ?? []) byName.set(row.name.trim().toLowerCase(), row.id);
    }
    const { error: productError } = await supabase.from("products").insert(validRows.map((row, i) => ({
      shop_id: shop.id,
      category_id: byName.get(row.category.toLowerCase()) ?? null,
      name: row.name,
      unit: row.unit,
      price: row.price,
      image_url: row.imageUrl || null,
      in_stock: row.inStock,
      sort: products.length + i,
    })));
    setImporting(false);
    if (productError) { setMessage(productError.message); return; }
    const skipped = csvPreview.length - validRows.length;
    setMessage(`Imported ${validRows.length} products.${skipped > 0 ? ` Skipped ${skipped} invalid row${skipped === 1 ? "" : "s"}.` : ""}`);
    setCsvPreview([]);
    await load(shop.id);
  }

  if (!signedIn) return <main className="mx-auto min-h-screen max-w-md px-4 py-12"><p className="text-sm font-semibold text-slate-500">Catalogue</p><h1 className="mt-2 text-3xl font-bold">Sign in to your shop</h1><form onSubmit={signIn} className="mt-8 space-y-4"><label className="block"><span className="mb-2 block text-sm font-bold">Email</span><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label className="block"><span className="mb-2 block text-sm font-bold">Password</span><input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>{message && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p>}<button className="w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white">Sign in</button></form></main>;
  if (authorised === false) return <main className="mx-auto max-w-lg px-4 py-16"><h1 className="text-2xl font-bold">Access denied</h1><p className="mt-2 text-slate-600">This account is not staff for {shop?.name}.</p><button onClick={() => void signOut()} className="mt-6 rounded-lg border px-4 py-2 font-semibold">Sign out</button></main>;
  if (!authorised || !shop) return <main className="p-8 text-center">Loading catalogue…</main>;

  const validCount = csvPreview.filter((row) => row.errors.length === 0).length;

  return <main className="mx-auto min-h-screen max-w-3xl bg-slate-50 pb-16 text-slate-950">
    <header className="sticky top-0 z-10 border-b bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Catalogue</p><h1 className="text-xl font-bold">{shop.name}</h1></div>
        <Link href={`/s/${slug}/owner`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold">Orders</Link>
      </div>
    </header>
    {message && <p className="m-4 rounded-xl bg-white p-3 text-sm text-slate-700 shadow-sm">{message}</p>}

    <section className="m-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-black">Import a price list</h2>
      <p className="mt-1 text-sm text-slate-600">A CSV with columns: category, name, unit, price, image_url (optional), in_stock (optional, defaults to yes).</p>
      <input type="file" accept=".csv" onChange={(e) => void handleFile(e)} className="mt-3 block text-sm" />
      {csvPreview.length > 0 && <div className="mt-4">
        <p className="text-sm font-semibold">{validCount} of {csvPreview.length} rows are valid.</p>
        <div className="mt-2 max-h-64 overflow-auto rounded-xl border">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100"><tr><th className="p-2">Row</th><th className="p-2">Category</th><th className="p-2">Name</th><th className="p-2">Unit</th><th className="p-2">Price</th><th className="p-2">Problem</th></tr></thead>
            <tbody>{csvPreview.map((row) => <tr key={row.rowNumber} className={row.errors.length > 0 ? "bg-red-50" : undefined}>
              <td className="p-2">{row.rowNumber}</td><td className="p-2">{row.category}</td><td className="p-2">{row.name}</td><td className="p-2">{row.unit}</td><td className="p-2">{row.price ?? "—"}</td>
              <td className="p-2 font-semibold text-red-700">{row.errors.join(", ")}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="mt-3 flex gap-2">
          <button disabled={importing || validCount === 0} onClick={() => void importCsv()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:bg-slate-300">{importing ? "Importing…" : `Import ${validCount} products`}</button>
          <button onClick={() => setCsvPreview([])} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancel</button>
        </div>
      </div>}
    </section>

    <section className="m-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-black">Categories</h2>
      <div className="mt-3 space-y-2">{categories.map((category) => (
        <div key={category.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
          <CategoryIcon icon={category.icon} className="h-5 w-5 shrink-0 text-slate-500" />
          <span className="flex-1 text-sm font-semibold">{category.name}</span>
          <select className="input w-auto py-1 text-xs" value={category.icon ?? "general"} onChange={(e) => void setCategoryIcon(category.id, e.target.value)}>
            {CATEGORY_ICON_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
          <button onClick={() => void deleteCategory(category.id)} className="text-xs font-bold text-red-600">Delete</button>
        </div>
      ))}</div>
      <form onSubmit={addCategory} className="mt-4 flex flex-wrap gap-2">
        <input className="input flex-1" placeholder="Category name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
        <select className="input w-auto" value={newCategoryIcon} onChange={(e) => setNewCategoryIcon(e.target.value)}>
          {CATEGORY_ICON_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
        </select>
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Add category</button>
      </form>
    </section>

    <section className="m-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-black">Add a product</h2>
      <form onSubmit={addProduct} className="mt-3 grid grid-cols-2 gap-2">
        <input className="input col-span-2" placeholder="Name" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
        <input className="input" placeholder="Unit, e.g. 1 kg" value={newProduct.unit} onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })} />
        <input className="input" placeholder="Price ₹" inputMode="decimal" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} />
        <input className="input col-span-2" placeholder="Photo URL (optional)" value={newProduct.image_url} onChange={(e) => setNewProduct({ ...newProduct, image_url: e.target.value })} />
        <select className="input col-span-2" value={newProduct.category_id} onChange={(e) => setNewProduct({ ...newProduct, category_id: e.target.value })}>
          <option value="">No category</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <button className="col-span-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Add product</button>
      </form>
    </section>

    <section className="m-4 space-y-3">
      {[...categories, { id: "", name: "Uncategorised", icon: null, sort: 999999 }].map((category) => {
        const items = products.filter((product) => (product.category_id ?? "") === category.id);
        if (items.length === 0) return null;
        return <div key={category.id || "uncategorised"} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-500"><CategoryIcon icon={category.icon} className="h-4 w-4" />{category.name}</h3>
          <div className="mt-3 divide-y">{items.map((product) => <ProductRow key={product.id} product={product} onSave={saveProduct} onToggle={toggleProduct} onDelete={deleteProduct} />)}</div>
        </div>;
      })}
    </section>
  </main>;
}

function ProductRow({ product, onSave, onToggle, onDelete }: {
  product: Product;
  onSave: (id: string, patch: Partial<Pick<Product, "name" | "unit" | "price" | "image_url">>) => Promise<void>;
  onToggle: (product: Product, field: "in_stock" | "active") => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [price, setPrice] = useState(String(product.price));
  const [imageUrl, setImageUrl] = useState(product.image_url ?? "");
  const priceDirty = Number(price) !== product.price;
  const imageDirty = imageUrl.trim() !== (product.image_url ?? "");

  return <div className="flex flex-wrap items-center gap-3 py-3">
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
      {product.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.image_url} alt="" className="h-full w-full object-cover" />
      )}
    </div>
    <div className="min-w-[10rem] flex-1">
      <p className="font-semibold">{product.name}</p>
      <p className="text-xs text-slate-500">{product.unit}</p>
    </div>
    <div className="flex items-center gap-1">
      <span className="text-sm text-slate-500">₹</span>
      <input className="input w-24" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
      {priceDirty && <button onClick={() => { const value = Number(price); if (!Number.isNaN(value) && value >= 0) void onSave(product.id, { price: value }); }} className="rounded-md bg-slate-900 px-2 py-1 text-xs font-bold text-white">Save</button>}
    </div>
    <div className="flex items-center gap-1">
      <input className="input w-40" placeholder="Photo URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
      {imageDirty && <button onClick={() => void onSave(product.id, { image_url: imageUrl.trim() || null })} className="rounded-md bg-slate-900 px-2 py-1 text-xs font-bold text-white">Save</button>}
    </div>
    <button onClick={() => void onToggle(product, "in_stock")} className={`rounded-md border px-2 py-1 text-xs font-bold ${product.in_stock ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-300 text-slate-500"}`}>{product.in_stock ? "In stock" : "Out of stock"}</button>
    <button onClick={() => void onToggle(product, "active")} className={`rounded-md border px-2 py-1 text-xs font-bold ${product.active ? "border-slate-300 text-slate-600" : "border-red-300 bg-red-50 text-red-700"}`}>{product.active ? "Visible" : "Hidden"}</button>
    <button onClick={() => void onDelete(product.id)} className="text-xs font-bold text-red-600">Delete</button>
  </div>;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') { if (text[i + 1] === '"') { field += '"'; i += 1; } else { inQuotes = false; } }
      else field += char;
    } else if (char === '"') inQuotes = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field); field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else field += char;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); if (row.some((cell) => cell.trim() !== "")) rows.push(row); }
  return rows;
}

function buildCsvPreview(rows: string[][]): CsvRow[] {
  const [header, ...body] = rows;
  const columnIndex = (label: string) => header.findIndex((cell) => cell.trim().toLowerCase() === label);
  const categoryIdx = columnIndex("category");
  const nameIdx = columnIndex("name");
  const unitIdx = columnIndex("unit");
  const priceIdx = columnIndex("price");
  const imageUrlIdx = columnIndex("image_url");
  const inStockIdx = columnIndex("in_stock");
  return body.map((cells, i) => {
    const category = (cells[categoryIdx] ?? "").trim();
    const name = (cells[nameIdx] ?? "").trim();
    const unit = (cells[unitIdx] ?? "").trim();
    const priceRaw = (cells[priceIdx] ?? "").trim();
    const imageUrl = imageUrlIdx >= 0 ? (cells[imageUrlIdx] ?? "").trim() : "";
    const inStockRaw = inStockIdx >= 0 ? (cells[inStockIdx] ?? "").trim().toLowerCase() : "";
    const price = priceRaw === "" ? NaN : Number(priceRaw);
    const errors: string[] = [];
    if (categoryIdx < 0 || !category) errors.push("missing category");
    if (nameIdx < 0 || !name) errors.push("missing name");
    if (unitIdx < 0 || !unit) errors.push("missing unit");
    if (priceIdx < 0 || Number.isNaN(price) || price < 0) errors.push("bad price");
    return {
      rowNumber: i + 2, category, name, unit,
      price: Number.isNaN(price) ? null : price,
      imageUrl,
      inStock: !["false", "no", "0"].includes(inStockRaw),
      errors,
    };
  });
}
