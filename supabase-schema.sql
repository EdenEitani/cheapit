-- Run this in the Supabase SQL editor

-- Bookings table
create table bookings (
  id uuid default gen_random_uuid() primary key,
  hotel_name text not null,
  hotel_city text not null,
  check_in date not null,
  check_out date not null,
  room_description text not null,
  guests integer not null default 2,
  price_paid numeric not null,
  currency text not null default 'USD',
  platform text,
  breakfast_included boolean default false,
  cancellation_deadline timestamptz,
  watch_platforms text[] default array['booking.com','expedia.com','hotels.com'],
  active boolean default true,
  created_at timestamptz default now()
);

-- Price checks log
create table price_checks (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid references bookings(id) on delete cascade,
  checked_at timestamptz default now(),
  price_found numeric,
  room_description_found text,
  platform_found text,
  url text,
  is_cheaper boolean
);

-- Alerts log
create table alerts (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid references bookings(id) on delete cascade,
  price_check_id uuid references price_checks(id),
  sent_at timestamptz default now(),
  telegram_message text
);

-- Indexes for common queries
create index on price_checks(booking_id, checked_at desc);
create index on alerts(booking_id, sent_at desc);
