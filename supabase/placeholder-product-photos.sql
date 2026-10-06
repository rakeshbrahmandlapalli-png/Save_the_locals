-- Not a migration — a one-off convenience script to set image_url on the
-- placeholder shop's demo products using freely-licensed Unsplash photos.
-- Five products (rice, toor dal, wheat flour, sunflower oil, toned milk) use
-- demo images shipped in public/products/ instead of Unsplash.
-- Curd, Salted Biscuits, Laundry Detergent, Floor Cleaner, Paneer, Garbage Bags, Iodised Salt and
-- Tea are intentionally left without a photo: the stock photos did not match the products. The app
-- shows the aisle's icon on its accent tint until accurate pack shots are added.
-- Safe to paste into the SQL Editor once; running it again just re-sets
-- the same URLs. Real shops should use their own photos via the
-- Catalogue screen or CSV import instead.

with target as (
  select id as shop_id from public.shops where slug = 'placeholder-manikonda'
),
photos (name, image_url) as (
  values
    ('Sona Masoori Rice', '/products/sona-masoori-rice.jpg'),
    ('Toned Milk', '/products/toned-milk.jpg'),
    ('Dishwash Bar', 'https://images.unsplash.com/photo-1607006344152-62699f97b42c?w=400&h=400&fit=crop&auto=format&q=80'),
    ('Toor Dal', '/products/toor-dal.jpg'),
    ('Potato Chips', 'https://images.unsplash.com/photo-1613919113640-25732ec5e61f?w=400&h=400&fit=crop&auto=format&q=80'),
    ('Butter', 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&h=400&fit=crop&auto=format&q=80'),
    ('Mixture', 'https://images.unsplash.com/photo-1675081678327-25a9b6448977?w=400&h=400&fit=crop&auto=format&q=80'),
    ('Sunflower Oil', '/products/sunflower-oil.jpg'),
    ('Wheat Flour', '/products/wheat-flour.jpg'),
    ('Bath Soap', 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=400&h=400&fit=crop&auto=format&q=80'),
    ('Peanuts', 'https://images.unsplash.com/photo-1549978113-29eb25c8177f?w=400&h=400&fit=crop&auto=format&q=80'),
    ('Ghee', 'https://images.unsplash.com/photo-1573812461383-e5f8b759d12e?w=400&h=400&fit=crop&auto=format&q=80')
)
update public.products p
set image_url = photos.image_url
from photos, target
where p.shop_id = target.shop_id and p.name = photos.name;
