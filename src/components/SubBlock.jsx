import React from 'react';
import PropTypes from 'prop-types';

const SubBlock = ({ 
  value,
  onChange,
  placeholder,
  rows = 1,
  className = "",
  autoResize = true
}) => {
  // Calculate dynamic rows for textarea - only expand on Enter key
  const getTextareaRows = (text) => {
    if (!text || !text.trim()) return 1;
    const lines = text.split('\n').length;
    return Math.max(1, Math.min(lines, 6)); // Min 1 row, max 6 rows
  };

  const textareaRows = autoResize ? getTextareaRows(value) : rows;

  return (
    <div className={`text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-200 ${className}`}>
      <textarea
        value={value}
        onChange={onChange}
        className="w-full text-sm text-gray-600 bg-transparent border-none outline-none focus:ring-0 resize-none"
        rows={textareaRows}
        placeholder={placeholder}
      />
    </div>
  );
};

SubBlock.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string.isRequired,
  rows: PropTypes.number,
  className: PropTypes.string,
  autoResize: PropTypes.bool
};

export default SubBlock;
