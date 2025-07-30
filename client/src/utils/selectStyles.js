// Reusable styles for Select components to fix dropdown icon overlap
export const selectStyles = {
  '& .MuiSelect-select': {
    paddingRight: '32px', // Ensure space for dropdown icon
  },
  '& .MuiSelect-icon': {
    right: '8px', // Position icon properly
  }
};

// Alternative style for longer text options
export const selectStylesLongText = {
  '& .MuiSelect-select': {
    paddingRight: '40px', // More space for longer text
  },
  '& .MuiSelect-icon': {
    right: '8px', // Position icon properly
  }
};

// Style for compact selects
export const selectStylesCompact = {
  '& .MuiSelect-select': {
    paddingRight: '28px', // Less space for compact design
  },
  '& .MuiSelect-icon': {
    right: '6px', // Position icon properly
  }
}; 