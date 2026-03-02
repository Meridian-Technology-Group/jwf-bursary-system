-- Create a function that syncs the profile role to Supabase auth.users app_metadata.
-- This ensures the JWT always reflects the current role without a manual update.
CREATE OR REPLACE FUNCTION sync_role_to_app_metadata()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', NEW.role::text)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fire on INSERT or UPDATE of the role column on profiles.
CREATE TRIGGER trg_sync_role_to_app_metadata
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_role_to_app_metadata();
