-- Optimized Database Schema
-- This schema removes deprecated fields and optimizes for performance
-- Removes: raw_value column, renames number_format to formatting, removes data field

-- ============================================================================
-- PART 1: Remove raw_value column and rename number_format to formatting
-- ============================================================================

-- Step 1: Add formatting column if it doesn't exist
ALTER TABLE spreadsheet_cells ADD COLUMN IF NOT EXISTS formatting TEXT;

-- Step 2: Copy data from number_format to formatting (if number_format still exists)
UPDATE spreadsheet_cells 
SET formatting = number_format 
WHERE number_format IS NOT NULL AND formatting IS NULL;

-- Step 3: Drop the raw_value column (deprecated)
ALTER TABLE spreadsheet_cells DROP COLUMN IF EXISTS raw_value;

-- Step 4: Drop the number_format column (renamed to formatting)
ALTER TABLE spreadsheet_cells DROP COLUMN IF EXISTS number_format;

-- Step 5: Add comment for formatting column
COMMENT ON COLUMN spreadsheet_cells.formatting IS 'Cell formatting string (e.g., "$#,##0.00", "mm/dd/yyyy", "0.00%")';

-- ============================================================================
-- PART 2: Remove data field from spreadsheets table
-- ============================================================================

-- Step 6: Remove the data column from spreadsheets table
-- This improves performance and enforces the use of spreadsheet_cells table
ALTER TABLE spreadsheets DROP COLUMN IF EXISTS data;

-- Step 7: Add comment to document the change
COMMENT ON TABLE spreadsheets IS 'Spreadsheet metadata only. Cell data is stored in spreadsheet_cells table for optimal performance.';

-- ============================================================================
-- PART 3: Performance optimizations
-- ============================================================================

-- Step 8: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_spreadsheet_cells_formatting ON spreadsheet_cells(formatting) WHERE formatting IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_spreadsheet_cells_spreadsheet_id ON spreadsheet_cells(spreadsheet_id);
CREATE INDEX IF NOT EXISTS idx_spreadsheet_cells_row_col ON spreadsheet_cells(spreadsheet_id, row_index, col_index);
CREATE INDEX IF NOT EXISTS idx_spreadsheet_cells_updated_at ON spreadsheet_cells(updated_at);

-- ============================================================================
-- PART 4: Utility functions
-- ============================================================================

-- Step 9: Create function to get cell data without raw_value
CREATE OR REPLACE FUNCTION get_cell_data_simplified(p_spreadsheet_id UUID)
RETURNS TABLE(
    row_index INTEGER,
    col_index INTEGER,
    formula TEXT,
    display_value TEXT,
    cell_type TEXT,
    formatting TEXT,
    decimal_places INTEGER,
    is_currency BOOLEAN,
    is_percentage BOOLEAN,
    currency_symbol TEXT,
    is_date BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sc.row_index,
        sc.col_index,
        sc.formula,
        sc.display_value,
        sc.cell_type,
        sc.formatting,
        sc.decimal_places,
        sc.is_currency,
        sc.is_percentage,
        sc.currency_symbol,
        sc.is_date
    FROM spreadsheet_cells sc
    WHERE sc.spreadsheet_id = p_spreadsheet_id
    ORDER BY sc.row_index, sc.col_index;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Create function to get spreadsheet data from cells table
CREATE OR REPLACE FUNCTION get_spreadsheet_data(p_spreadsheet_id UUID)
RETURNS JSONB AS $$
DECLARE
    result_data JSONB := '[]'::jsonb;
    r INTEGER;
    c INTEGER;
    max_row INTEGER := 0;
    max_col INTEGER := 0;
    cell_record RECORD;
BEGIN
    -- Determine max row and column to build a dense array
    SELECT MAX(row_index), MAX(col_index)
    INTO max_row, max_col
    FROM spreadsheet_cells
    WHERE spreadsheet_id = p_spreadsheet_id;

    IF max_row IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    -- Initialize a 2D array of appropriate size
    FOR r IN 0..max_row LOOP
        result_data := jsonb_set(result_data, ARRAY[r]::text[], '[]'::jsonb, TRUE);
        FOR c IN 0..max_col LOOP
            result_data := jsonb_set(result_data, ARRAY[r, c]::text[], '{}'::jsonb, TRUE);
        END LOOP;
    END LOOP;

    -- Fill the array with actual cell data
    FOR cell_record IN SELECT * FROM spreadsheet_cells WHERE spreadsheet_id = p_spreadsheet_id
    LOOP
        result_data := jsonb_set(
            result_data,
            ARRAY[cell_record.row_index, cell_record.col_index]::text[],
            jsonb_build_object(
                'value', COALESCE(cell_record.formula, cell_record.display_value),
                'cellType', cell_record.cell_type,
                'formatting', cell_record.formatting,
                'decimalPlaces', cell_record.decimal_places,
                'isCurrency', cell_record.is_currency,
                'isPercentage', cell_record.is_percentage,
                'currencySymbol', cell_record.currency_symbol,
                'isDate', cell_record.is_date
            )
        );
    END LOOP;

    RETURN result_data;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 5: Backward compatibility views
-- ============================================================================

-- Step 11: Create view for backward compatibility
CREATE OR REPLACE VIEW spreadsheet_cells_legacy AS
SELECT 
    id,
    spreadsheet_id,
    row_index,
    col_index,
    formula,
    display_value,
    display_value as raw_value, -- Map display_value to raw_value for compatibility
    cell_type,
    formatting as number_format, -- Map formatting to number_format for compatibility
    decimal_places,
    is_currency,
    is_percentage,
    currency_symbol,
    is_date,
    created_at,
    updated_at
FROM spreadsheet_cells;

-- Step 12: Create view for spreadsheets with data
CREATE OR REPLACE VIEW spreadsheets_with_data AS
SELECT 
    s.*,
    get_spreadsheet_data(s.id) as data
FROM spreadsheets s;

-- ============================================================================
-- PART 6: Permissions
-- ============================================================================

-- Step 13: Grant necessary permissions
GRANT SELECT ON spreadsheet_cells_legacy TO authenticated;
GRANT SELECT ON spreadsheets_with_data TO authenticated;
GRANT EXECUTE ON FUNCTION get_cell_data_simplified(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_spreadsheet_data(UUID) TO authenticated;

-- ============================================================================
-- PART 7: Final comments
-- ============================================================================

-- Step 14: Add final comments
COMMENT ON TABLE spreadsheet_cells IS 'Optimized cell storage: raw_value deprecated (use display_value), number_format renamed to formatting';
COMMENT ON TABLE spreadsheets IS 'Spreadsheet metadata only. Cell data is stored in spreadsheet_cells table for optimal performance.';

-- Step 15: Verify the changes
SELECT 
    'Migration completed successfully' as status,
    COUNT(*) as total_cells
FROM spreadsheet_cells;
