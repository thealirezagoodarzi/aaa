/**
 * Supabase Database Client & Reactive Laboratory State Engine
 * Includes Full SQL Schema DDL, RLS Policies, Realtime PubSub, and Persistent Mock/Live Storage
 */

import { 
  UserProfile, 
  Customer, 
  CustomerPaymentRecord,
  TrashCustomerItem,
  TestReport, 
  AccountingRecord, 
  Invoice,
  EquipmentCalibration,
  TechnicianDispatch,
  EnvironmentalLog,
  LabMediaItem,
  SmsLog,
  SmsEvent
} from '../types';
import { LAB_IMAGES } from '../assets/images';

export const SUPABASE_SQL_SCHEMA = `-- ==============================================================================
-- SAMANEH JAME AZMAYESHGAH BETON (CONCRETE TESTING LABORATORY)
-- COMPLETE SUPABASE POSTGRESQL DATABASE SCHEMA & ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. User Roles Enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'operator', 'customer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Profiles Table (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'customer',
    phone TEXT,
    customer_id UUID,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Customers Table (Contractors, Engineering Firms & Project Owners)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name TEXT NOT NULL,
    representative_name TEXT NOT NULL,
    economic_code TEXT,
    national_id TEXT,
    phone TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    address TEXT NOT NULL,
    project_names TEXT[] NOT NULL DEFAULT '{}',
    balance BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link profile customer_id to customers table
ALTER TABLE public.profiles 
    DROP CONSTRAINT IF EXISTS fk_profiles_customer,
    ADD CONSTRAINT fk_profiles_customer FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

-- 5. Test Reports Table (Concrete Samples, Slump, Breaking Tests & GPS)
CREATE TABLE IF NOT EXISTS public.test_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_no TEXT UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    customer_name TEXT NOT NULL,
    project_name TEXT NOT NULL,
    sample_location TEXT NOT NULL,
    concrete_grade TEXT NOT NULL DEFAULT 'C25',
    target_strength_mpa NUMERIC(5,2) NOT NULL DEFAULT 25.0,
    mold_type TEXT NOT NULL DEFAULT 'cube_150' CHECK (mold_type IN ('cube_150', 'cylinder_150_300')),
    slump_mm NUMERIC(5,2) NOT NULL,
    water_cement_ratio NUMERIC(4,3) NOT NULL DEFAULT 0.45,
    cement_type TEXT NOT NULL,
    sampling_date_jalali TEXT NOT NULL,
    sampling_date_gregorian DATE NOT NULL DEFAULT CURRENT_DATE,
    sampling_time TEXT NOT NULL,
    truck_batch_no TEXT,
    curing_method TEXT NOT NULL DEFAULT 'حوضچه آب آهک ۲۳ درجه',
    
    -- 7-Day Breaking Test
    breaking_7d_load_kn NUMERIC(8,2),
    breaking_7d_strength_mpa NUMERIC(6,2),
    break_date_7d_jalali TEXT,
    
    -- 28-Day Breaking Test
    breaking_28d_load_kn NUMERIC(8,2),
    breaking_28d_strength_mpa NUMERIC(6,2),
    break_date_28d_jalali TEXT,
    
    -- Compliance & Approval Status
    is_passed BOOLEAN DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    operator_id UUID NOT NULL REFERENCES public.profiles(id),
    operator_name TEXT NOT NULL,
    approved_by_id UUID REFERENCES public.profiles(id),
    approved_by_name TEXT,
    approval_date_jalali TEXT,
    approval_notes TEXT,
    
    -- Photographic Evidence & GPS
    photos TEXT[] DEFAULT '{}',
    coordinates JSONB DEFAULT '{"lat": 35.6892, "lng": 51.3890}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_no TEXT UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    customer_name TEXT NOT NULL,
    project_name TEXT NOT NULL,
    amount BIGINT NOT NULL,
    tax_amount BIGINT NOT NULL DEFAULT 0,
    discount_amount BIGINT NOT NULL DEFAULT 0,
    total_amount BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'cancelled')),
    issue_date_jalali TEXT NOT NULL,
    due_date_jalali TEXT NOT NULL,
    paid_at TIMESTAMPTZ,
    payment_method TEXT,
    payment_receipt_url TEXT,
    items JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Accounting Records Table
CREATE TABLE IF NOT EXISTS public.accounting_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category TEXT NOT NULL,
    amount BIGINT NOT NULL,
    jalali_date TEXT NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    reference_no TEXT,
    description TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_records ENABLE ROW LEVEL SECURITY;

-- Helper functions to check role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.current_user_customer_id()
RETURNS UUID AS $$
  SELECT customer_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 8.1 Profiles Policies
CREATE POLICY "Admins can manage all profiles"
    ON public.profiles FOR ALL
    USING (public.current_user_role() = 'admin');

CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- 8.2 Customers Policies
CREATE POLICY "Admins full access on customers"
    ON public.customers FOR ALL
    USING (public.current_user_role() = 'admin');

CREATE POLICY "Operators can view and insert customers"
    ON public.customers FOR SELECT
    USING (public.current_user_role() IN ('admin', 'operator'));

CREATE POLICY "Operators can insert new customers"
    ON public.customers FOR INSERT
    WITH CHECK (public.current_user_role() IN ('admin', 'operator'));

CREATE POLICY "Customers can view own company record"
    ON public.customers FOR SELECT
    USING (id = public.current_user_customer_id());

-- 8.3 Test Reports Policies (CRITICAL WORKFLOW CONSTRAINTS)
CREATE POLICY "Admins full CRUD on test reports"
    ON public.test_reports FOR ALL
    USING (public.current_user_role() = 'admin');

CREATE POLICY "Operators can view all test reports"
    ON public.test_reports FOR SELECT
    USING (public.current_user_role() = 'operator');

CREATE POLICY "Operators can insert pending reports only"
    ON public.test_reports FOR INSERT
    WITH CHECK (
        public.current_user_role() = 'operator' 
        AND status = 'pending'
    );

CREATE POLICY "Customers can ONLY view their OWN APPROVED test reports"
    ON public.test_reports FOR SELECT
    USING (
        public.current_user_role() = 'customer'
        AND customer_id = public.current_user_customer_id()
        AND status = 'approved'
    );

-- 8.4 Invoices Policies
CREATE POLICY "Admins full access to invoices"
    ON public.invoices FOR ALL
    USING (public.current_user_role() = 'admin');

CREATE POLICY "Operators can view invoices"
    ON public.invoices FOR SELECT
    USING (public.current_user_role() = 'operator');

CREATE POLICY "Customers can view their own invoices"
    ON public.invoices FOR SELECT
    USING (
        public.current_user_role() = 'customer'
        AND customer_id = public.current_user_customer_id()
    );

-- 8.5 Accounting Records Policies
CREATE POLICY "Admins full access to accounting records"
    ON public.accounting_records FOR ALL
    USING (public.current_user_role() = 'admin');

-- ==============================================================================
-- 9. SUPABASE REALTIME REPLICATION ENABLEMENT
-- ==============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.test_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.accounting_records;

-- ==============================================================================
-- 10. SUPABASE STORAGE BUCKETS (Concrete Photos & Test PDFs)
-- ==============================================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('concrete-photos', 'concrete-photos', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('lab-certificates', 'lab-certificates', false);
`;

// Export all initial static seed data from initialData.ts (eliminates circular dependency)
export * from "./initialData";


// Export Pure VPS Server-Authoritative Storage Engine (Zero localStorage)
export { ConcreteLabStorage, labDb } from "./ConcreteLabStorage";
