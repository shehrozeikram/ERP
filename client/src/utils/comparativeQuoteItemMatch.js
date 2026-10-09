/**
 * Match indent/requisition lines to quotation lines for Comparative Statement.
 *
 * Spec-only matching is unsafe when several lines share the same specification
 * (e.g. Keyboard + Mouse both "Branded") — that previously remapped prices and
 * made CS totals diverge from the quotation document.
 */

export const normalizeComparativeText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['′’]/g, "'")
    .replace(/[″""]/g, '"')
    .replace(/\s+/g, ' ');

export const isBlankQuoteItem = (qi) =>
  (Number(qi?.quantity) || 0) === 0 && (Number(qi?.unitPrice) || 0) === 0;

/** Line amount consistent with Quotation detail view. */
export const getQuoteLineAmount = (quoteItem) => {
  if (!quoteItem || isBlankQuoteItem(quoteItem)) return 0;
  const baseTotal = (Number(quoteItem.quantity) || 0) * (Number(quoteItem.unitPrice) || 0);
  const discount = Number(quoteItem.discount) || 0;
  const taxRate = Number(quoteItem.taxRate) || 0;
  return baseTotal - discount + ((baseTotal - discount) * taxRate) / 100;
};

const pickNonBlank = (match) => {
  if (!match || isBlankQuoteItem(match)) return null;
  return match;
};

/**
 * @param {Object} quote - quotation with items[]
 * @param {Object} item - indent item
 * @param {number} itemIndex - indent row index
 * @param {Array} indentItems - full indent items list (for ordinal disambiguation)
 */
export const getQuoteItemForIndentItem = (quote, item, itemIndex, indentItems = []) => {
  if (!quote?.items?.length) return null;

  const items = quote.items;
  const indentName = normalizeComparativeText(item?.itemName);
  const indentSpec = normalizeComparativeText(item?.description);
  const indentLabel = indentName || indentSpec;

  const nameMatches = indentLabel
    ? items
        .map((qi, idx) => ({ qi, idx }))
        .filter(({ qi }) => {
          const qDesc = normalizeComparativeText(qi?.description);
          const qSpec = normalizeComparativeText(qi?.specification);
          return (
            (qDesc && (qDesc === indentLabel || (indentName && qDesc === indentName))) ||
            (qSpec && (qSpec === indentLabel || (indentName && qSpec === indentName)))
          );
        })
    : [];

  // 1) Prefer item-name match (unique, or disambiguated by index / same-name ordinal)
  if (nameMatches.length === 1) {
    return pickNonBlank(nameMatches[0].qi);
  }
  if (nameMatches.length > 1 && itemIndex != null) {
    const atSameIndex = nameMatches.find((m) => m.idx === itemIndex);
    if (atSameIndex) {
      const picked = pickNonBlank(atSameIndex.qi);
      if (picked) return picked;
    }

    const sameNameIndentOrdinal =
      indentItems.slice(0, itemIndex + 1).filter((it) => {
        const n = normalizeComparativeText(it?.itemName) || normalizeComparativeText(it?.description);
        return n && (n === indentLabel || (indentName && n === indentName));
      }).length - 1;
    if (sameNameIndentOrdinal >= 0 && sameNameIndentOrdinal < nameMatches.length) {
      const picked = pickNonBlank(nameMatches[sameNameIndentOrdinal].qi);
      if (picked) return picked;
    }
  }

  // 2) Name + specification together (handles renamed/partial descriptions)
  if (indentName && indentSpec) {
    const byNameAndSpec = items.find((qi) => {
      const qDesc = normalizeComparativeText(qi?.description);
      const qSpec = normalizeComparativeText(qi?.specification);
      const nameOk = qDesc === indentName || qSpec === indentName;
      const specOk = qSpec === indentSpec || qDesc === indentSpec;
      return nameOk && specOk;
    });
    const picked = pickNonBlank(byNameAndSpec);
    if (picked) return picked;
  }

  // 3) Specification-only ONLY when unique among quote lines
  if (indentSpec) {
    const specMatches = items
      .map((qi, idx) => ({ qi, idx }))
      .filter(({ qi }) => {
        const qDesc = normalizeComparativeText(qi?.description);
        const qSpec = normalizeComparativeText(qi?.specification);
        return (qDesc && qDesc === indentSpec) || (qSpec && qSpec === indentSpec);
      });
    if (specMatches.length === 1) {
      return pickNonBlank(specMatches[0].qi);
    }
    if (specMatches.length > 1 && itemIndex != null) {
      const atSameIndex = specMatches.find((m) => m.idx === itemIndex);
      if (atSameIndex) {
        const picked = pickNonBlank(atSameIndex.qi);
        if (picked) return picked;
      }
      const sameSpecOrdinal =
        indentItems.slice(0, itemIndex + 1).filter((it) => {
          const spec = normalizeComparativeText(it?.description);
          return spec && spec === indentSpec;
        }).length - 1;
      if (sameSpecOrdinal >= 0 && sameSpecOrdinal < specMatches.length) {
        const picked = pickNonBlank(specMatches[sameSpecOrdinal].qi);
        if (picked) return picked;
      }
    }
  }

  // 4) Same index as indent row
  if (itemIndex != null && itemIndex < items.length) {
    return pickNonBlank(items[itemIndex]);
  }

  return null;
};

/**
 * Sum of matched line amounts for one quotation across indent items.
 * Falls back to quotation subtotal/total when nothing matched.
 */
export const getComparativeQuoteVisibleTotal = (quote, indentItems = [], quotations = []) => {
  const visibleTotal = (indentItems || []).reduce((sum, item, itemIndex) => {
    const isQuoted = (quotations || []).some(
      (q) => getQuoteItemForIndentItem(q, item, itemIndex, indentItems) != null
    );
    if (!isQuoted) return sum;
    const quoteItem = getQuoteItemForIndentItem(quote, item, itemIndex, indentItems);
    if (!quoteItem) return sum;
    return sum + getQuoteLineAmount(quoteItem);
  }, 0);

  if (visibleTotal > 0) return visibleTotal;
  return Number(quote?.subtotal) || Number(quote?.totalAmount) || 0;
};

export const getComparativeQuoteGrandTotal = (quote, indentItems = [], quotations = []) => {
  const visibleTotal = getComparativeQuoteVisibleTotal(quote, indentItems, quotations);
  const hasLineMatch = (indentItems || []).some((item, itemIndex) =>
    getQuoteItemForIndentItem(quote, item, itemIndex, indentItems)
  );
  const discountAmount = Number(quote?.discountAmount) || 0;
  // visibleTotal / subtotal are pre-discount; stored totalAmount is usually post-discount
  const usedStoredTotalOnly = !hasLineMatch && !quote?.subtotal && Number(quote?.totalAmount);
  if (usedStoredTotalOnly) return Math.max(0, Number(quote.totalAmount) || 0);
  return Math.max(0, visibleTotal - discountAmount);
};
