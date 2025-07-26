/**
 * Format currency for Indonesian Rupiah
 * @param {number} amount - The amount to format
 * @param {boolean} removeSpace - Whether to remove space between Rp and number
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, removeSpace = true) => {
    const formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
    
    // Remove the space between Rp and the number if requested
    return removeSpace ? formatted.replace(/\s/g, '') : formatted;
};

export default formatCurrency;