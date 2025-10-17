import React from 'react';
import PropTypes from 'prop-types';

const ContentBlock = ({ 
  children, 
  className = "",
  variant = "default" // "default", "description", "criteria"
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case "description":
        return "bg-white p-3 rounded-lg border border-gray-200";
      case "criteria":
        return "bg-white p-3 rounded-lg border border-gray-200";
      default:
        return "bg-white rounded-lg border border-gray-200 p-4 shadow-sm";
    }
  };

  return (
    <div className={`${getVariantClasses()} ${className}`}>
      {children}
    </div>
  );
};

ContentBlock.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  variant: PropTypes.oneOf(["default", "description", "criteria"])
};

export default ContentBlock;
