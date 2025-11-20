# Barber Growth Engine

A comprehensive SaaS platform for barbershops and salons to manage bookings, track customers, automate retention campaigns, and analyze business growth.

## Features

### Dashboard
- Weekly revenue and appointment tracking
- Customer retention metrics
- Real-time alerts for inactive customers
- Quick action buttons for common tasks

### Booking System
- Calendar view with daily schedule
- Create and manage appointments
- Service and customer selection
- Appointment status tracking (scheduled, completed, cancelled)
- Two booking modes:
  - **Internal Only**: Only staff can create appointments
  - **Online Booking**: Public booking widget for customers

### Customer CRM
- Complete customer database
- Visit history and spending tracking
- Customer filtering (All, Top 10, Inactive)
- Detailed customer profiles with:
  - Contact information
  - Total visits and spending
  - Average visit interval
  - Full appointment history

### Retention Engine
Automated customer engagement flows:
- **Winback Flow**: Re-engage inactive customers
- **Freshness Reminder**: Remind customers when due for next visit
- **Thank You + Review**: Post-visit appreciation and review requests
- **Quiet Day Gap-Fill**: Fill low-occupancy days with special offers

Each flow configurable with:
- Channel selection (WhatsApp, SMS, Email)
- Custom message templates
- Follow-up messages
- Enable/disable toggles

### Analytics Dashboard
- Revenue trends over time
- Customer distribution (new vs returning)
- Retention rate tracking
- Top customer rankings
- Weekly comparison metrics
- Flexible time ranges (7 days / 30 days)

### Business Settings
- Business information management
- Booking mode configuration
- Service management (create, edit, delete)
- Google Review URL integration
- Default reminder interval settings

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS (dark mode with amber accents)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (email/password)
- **Icons**: Lucide React

## Database Schema

- **businesses**: Shop information and settings
- **services**: Services offered by each business
- **customers**: Customer profiles and statistics
- **appointments**: Booking records with service and customer details
- **retention_flows**: Automated campaign configurations
- **messages**: Message history and tracking

## Security

- Row Level Security (RLS) enabled on all tables
- Business owners can only access their own data
- Public booking widget has limited access for customer creation and appointment booking
- Automatic customer statistics updates via database triggers

## Design Philosophy

Premium barbershop aesthetic with:
- Dark theme (zinc-950 background, zinc-900 cards)
- Warm amber accent color for CTAs and highlights
- Clean, minimal interface
- Smooth transitions and hover states
- Mobile-responsive design

## Getting Started

1. Sign up for an account
2. Create your business profile
3. Add services in Settings
4. Add customers
5. Start booking appointments
6. Configure retention flows
7. Enable online booking (optional)

## Public Booking

When online booking is enabled, share your booking URL with customers:
`https://yourdomain.com/book/{business-id}`

Customers can:
- View available services
- Select date and time
- Provide contact information
- Book appointments directly

## Future Enhancements

- Multi-location support
- Team member management
- SMS/WhatsApp/Email integration
- Mobile consumer app
- Marketplace/discovery features
- Advanced reporting
- Payment processing integration
