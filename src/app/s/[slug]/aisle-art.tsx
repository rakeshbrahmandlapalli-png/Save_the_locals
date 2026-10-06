import { CategoryIcon } from "@/lib/category-icons";

/** Original lightweight aisle illustrations. No product brands or packaging claims. */
export function AisleArt({ name, icon }: { name: string; icon: string | null }) {
  const type = /staple|rice|pantry/i.test(name) ? "staples" : /dairy|milk/i.test(name) ? "dairy" : /snack/i.test(name) ? "snacks" : /home|clean/i.test(name) ? "home" : "other";
  const colours = { staples: "#edf4d8", dairy: "#e2f1f8", snacks: "#fff0dc", home: "#e0f3e8", other: "#eef3ef" };
  return (
    <span className="aisle-art" style={{ background: colours[type] }} aria-hidden="true">
      {type === "other" ? <CategoryIcon icon={icon} className="h-8 w-8 text-brand" /> : (
        <svg viewBox="0 0 100 88" fill="none">
          <ellipse cx="50" cy="76" rx="34" ry="5" fill="#243D2B" opacity=".08" />
          {type === "staples" && <>
            <path d="M20 22h33l6 45q-23 13-45 0z" fill="#D9B87C" />
            <path d="M20 22h33v8H20z" fill="#BA925A" />
            <rect x="24" y="39" width="22" height="20" rx="4" fill="#FFF8E8" />
            <path d="M35 43v12m0-5-5-4m5 8 5-4" stroke="#639252" strokeWidth="2" strokeLinecap="round" />
            <path d="M45 55q20-16 40 0v3H45z" fill="#FFFDF2" />
            <path d="M44 58h42q-3 18-21 18T44 58" fill="#579260" />
            <path d="m55 50 2-1m5-1 2-1m6 3 2-1m-10 5 2-1" stroke="#D9CFAD" strokeWidth="2" strokeLinecap="round" />
          </>}
          {type === "dairy" && <>
            <path d="M27 21h17v10l6 9v33H21V40l6-9z" fill="white" stroke="#B9D6DF" strokeWidth="1.5" />
            <rect x="26" y="17" width="19" height="7" rx="2" fill="#428CAB" />
            <rect x="23" y="44" width="25" height="18" rx="2" fill="#A2DAEE" />
            <path d="M64 35h15l6 10v29H57V45z" fill="#FCFCF9" stroke="#C7DBDE" strokeWidth="1.5" />
            <path d="M64 35h15l-6-9H61z" fill="#65A97E" />
            <path d="M57 46h28v12H57z" fill="#91CAA2" />
            <path d="m35 48-4 6a5 5 0 0 0 9 0z" fill="white" />
          </>}
          {type === "snacks" && <>
            <path d="M28 15h40l-3 14 5 43H26l5-43z" fill="#F2BC43" />
            <path d="M28 15h40v6H28zM26 67h44v5H26z" fill="#D8912C" />
            <circle cx="48" cy="43" r="15" fill="#FFEDAB" />
            <ellipse cx="45" cy="42" rx="6" ry="9" transform="rotate(-30 45 42)" fill="#E3A035" />
            <ellipse cx="53" cy="46" rx="6" ry="9" transform="rotate(30 53 46)" fill="#F6C95F" />
            <circle cx="76" cy="63" r="11" fill="#C58F53" />
            <circle cx="71" cy="61" r="2" fill="#74512F" /><circle cx="79" cy="58" r="2" fill="#74512F" /><circle cx="78" cy="68" r="2" fill="#74512F" />
          </>}
          {type === "home" && <>
            <path d="M47 15h28v7H59v8H47z" fill="#246B58" />
            <path d="M69 19h9v9l-9-6z" fill="#246B58" />
            <path d="M48 30h12l9 12v30H40V42z" fill="#6EBA91" />
            <rect x="43" y="46" width="23" height="16" rx="3" fill="#F2FFF5" />
            <path d="m54 49-4 6a4 4 0 0 0 8 0z" fill="#378E61" />
            <rect x="19" y="49" width="16" height="25" rx="3" fill="#E3B848" />
            <path d="M20 49v-9m4 9V38m4 11V39m4 10v-8" stroke="#BD9340" strokeWidth="2.5" />
          </>}
        </svg>
      )}
    </span>
  );
}
