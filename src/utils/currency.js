exports.formatNaira = (amount) => {
  if (isNaN(amount)) amount = 0;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2
  }).format(amount);
};
