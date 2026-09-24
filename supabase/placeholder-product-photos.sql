-- Not a migration — a one-off convenience script to set image_url on the
-- placeholder shop's demo products using freely-licensed Unsplash photos.
-- Safe to paste into the SQL Editor once; running it again just re-sets
-- the same URLs. Real shops should use their own photos via the
-- Catalogue screen or CSV import instead.

with target as (
  select id as shop_id from public.shops where slug = 'placeholder-manikonda'
),
photos (name, image_url) as (
  values
    ('Sona Masoori Rice', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=400&fit=crop&auto=format&q=80'),
    ('Toned Milk', 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&h=400&fit=crop&auto=format&q=80'),
    ('Salted Biscuits', 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&h=400&fit=crop&auto=format&q=80'),
    ('Dishwash Bar', 'https://images.unsplash.com/photo-1607006344152-62699f97b42c?w=400&h=400&fit=crop&auto=format&q=80'),
    ('Toor Dal', 'https://images.unsplash.com/photo-1612257416648-ee7a6c533b4f?w=400&h=400&fit=crop&auto=format&q=80'),
    ('Laundry Detergent', 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=400&h=400&fit=crop&auto=format&q=80'),
    ('Curd', 'https://images.unsplash.com/photo-1627308594190-a057cd4bfac8?w=400&h=400&fit=crop&auto=format&q=80'),
    ('Potato Chips', 'https://images.unsplash.com/photo-1613919113640-25732ec5e61f?w=400&h=400&fit=crop&auto=format&q=80'),
    ('Floor Cleaner', 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=400&h=400&fit=crop&auto=format&q=80'),
    ('Butter', 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&h=400&fit=crop&auto=format&q=80'),
    ('Mixture', 'https://images.unsplash.com/photo-1675081678327-25a9b6448977?w=400&h=400&fit=crop&auto=format&q=80'),
    ('Sunflower Oil', 'https://images.unsplash.com/photo-1552592074-ea7a91b851b3?w=400&h=400&fit=crop&auto=format&q=80'),
    ('Wheat Flour', 'https://images.unsplash.com/photo-1627485937980-221c88ac04f9?w=400&h=400&fit=crop&auto=format&q=80'),
    ('Paneer', 'https://images.unsplash.com/photo-1551881192-002e02ad3d87?w=400&h=400&fit=crop&auto=format&q=80'),
    ('Bath Soap', 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=400&h=400&fit=crop&auto=format&q=80'),
    ('Peanuts', 'https://images.unsplash.com/photo-1549978113-29eb25c8177f?w=400&h=400&fit=crop&auto=format&q=80'),
    ('Garbage Bags', 'https://images.unsplash.com/photo-1606037150583-fb842a55bae7?w=400&h=400&fit=crop&auto=format&q=80'),
    ('Tea', 'https://images.unsplash.com/photo-1567922045116-2a00fae2ed03?w=400&h=400&fit=crop&auto=format&q=80'),
    ('Ghee', 'https://images.unsplash.com/photo-1573812461383-e5f8b759d12e?w=400&h=400&fit=crop&auto=format&q=80'),
    ('Iodised Salt', 'https://images.unsplash.com/photo-1518110925495-5fe2fda0442c?w=400&h=400&fit=crop&auto=format&q=80')
)
update public.products p
set image_url = photos.image_url
from photos, target
where p.shop_id = target.shop_id and p.name = photos.name;
