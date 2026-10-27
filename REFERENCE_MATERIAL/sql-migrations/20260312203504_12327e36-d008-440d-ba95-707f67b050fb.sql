
-- Allow full access to contacts table (internal CRM, no auth)
CREATE POLICY "Allow all access to contacts" ON public.contacts FOR ALL USING (true) WITH CHECK (true);
