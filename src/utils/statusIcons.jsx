import React from 'react';
import { CheckSquare, Square, X, HelpCircle, AlertTriangle } from 'lucide-react';

/**
 * Centralized status icon system for consistent display across all components
 * This ensures all status icons use the same styling and behavior
 */

export const getStatusIcon = (status, size = 'w-4 h-4') => {
  const baseClasses = `${size} transition-colors`;
  
  switch (status) {
    case 'passed':
      return <CheckSquare className={`${baseClasses} text-blue-600`} />;
    case 'failed':
      return <X className={`${baseClasses} text-red-600`} />;
    case 'unknown':
      return <HelpCircle className={`${baseClasses} text-orange-500`} />;
    case 'warning':
      return <AlertTriangle className={`${baseClasses} text-orange-500`} />;
    case 'open':
    case 'active':
    default:
      return <Square className={`${baseClasses} text-blue-600`} />;
  }
};

/**
 * Get status icon with custom size
 * @param {string} status - The status value
 * @param {string} size - Tailwind size classes (e.g., 'w-4 h-4', 'w-5 h-5')
 * @returns {React.Element} The status icon component
 */
export const getStatusIconWithSize = (status, size) => {
  return getStatusIcon(status, size);
};

/**
 * Status configuration object for reference
 */
export const STATUS_CONFIG = {
  passed: {
    icon: CheckSquare,
    color: 'text-blue-600',
    label: 'Passed',
    description: 'Check meets all acceptance criteria'
  },
  failed: {
    icon: X,
    color: 'text-red-600',
    label: 'Failed',
    description: 'Check does not meet acceptance criteria'
  },
  unknown: {
    icon: HelpCircle,
    color: 'text-orange-500',
    label: 'Unknown',
    description: 'Analysis is inconclusive'
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-orange-500',
    label: 'Warning',
    description: 'Check has concerns or minor issues'
  },
  open: {
    icon: Square,
    color: 'text-blue-600',
    label: 'Open',
    description: 'Check is not yet analyzed'
  },
  active: {
    icon: Square,
    color: 'text-blue-600',
    label: 'Active',
    description: 'Check is active but not yet analyzed'
  }
};
