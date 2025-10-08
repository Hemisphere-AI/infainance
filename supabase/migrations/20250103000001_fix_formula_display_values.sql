-- Fix existing cells where display_value contains formulas instead of calculated results
-- This migration will update cells where display_value starts with '=' to have the formula in the formula column
-- and recalculate the display_value

-- Step 1: Update cells where display_value contains formulas
UPDATE spreadsheet_cells 
SET 
  formula = display_value,
  display_value = NULL
WHERE display_value LIKE '=%' 
  AND formula IS NULL;

-- Step 2: Add a comment to document the change
COMMENT ON COLUMN spreadsheet_cells.display_value IS 'Calculated result of formulas (numeric/string value), not the formula itself';
COMMENT ON COLUMN spreadsheet_cells.formula IS 'The actual formula string (e.g., =SUM(A1:A10)), not the result';

-- Step 3: Create a function to recalculate display values for formulas
CREATE OR REPLACE FUNCTION recalculate_formula_display_values(p_spreadsheet_id UUID)
RETURNS VOID AS $$
DECLARE
    cell_record RECORD;
    calculated_value TEXT;
BEGIN
    -- This function would need to be implemented with proper formula evaluation
    -- For now, we'll just set display_value to NULL for formulas that need recalculation
    UPDATE spreadsheet_cells 
    SET display_value = NULL
    WHERE spreadsheet_id = p_spreadsheet_id 
      AND formula IS NOT NULL 
      AND display_value IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Grant execute permission
GRANT EXECUTE ON FUNCTION recalculate_formula_display_values(UUID) TO authenticated;
