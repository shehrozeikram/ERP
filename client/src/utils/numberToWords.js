/** Convert amount to words (Pakistani Rupees). */
export function numberToWords(num) {
  if (!num || Number(num) === 0) return 'Zero Rupees Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  const convert = (n) => {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ` ${ones[n % 10]}` : '');
    if (n < 1000) return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${convert(n % 100)}` : ''}`;
    if (n < 100000) return `${convert(Math.floor(n / 1000))} Thousand${n % 1000 ? ` ${convert(n % 1000)}` : ''}`;
    if (n < 10000000) return `${convert(Math.floor(n / 100000))} Lakh${n % 100000 ? ` ${convert(n % 100000)}` : ''}`;
    return `${convert(Math.floor(n / 10000000))} Crore${n % 10000000 ? ` ${convert(n % 10000000)}` : ''}`;
  };

  const amount = Math.floor(Number(num) || 0);
  const paise = Math.round((Number(num) - amount) * 100);

  let result = `${convert(amount)} Rupees`;
  if (paise > 0) {
    result += ` and ${convert(paise)} Paise`;
  }
  result += ' Only';

  return result;
}
