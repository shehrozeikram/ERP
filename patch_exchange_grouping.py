import re

with open('server/routes/landAcquisitionRegistry.js', 'r') as f:
    content = f.read()

old_code = """  // Synthesize In Land exchange records into legal acquisition entries
  const exchangeInRows = [];
  activeExchanges.forEach((exc) => {
    (exc.inLandLines || []).forEach((inL, idx) => {
      const inMozaId = String(inL.moza?._id || inL.moza || exc.moza?._id || exc.moza || '');
      if (filter.moza && inMozaId !== String(filter.moza)) {
        return;
      }

      const inArea = normalizeArea(inL.acquiredArea);
      if (toSarsais(inArea) === 0) return;

      const regNo = inL.registryNo || `(Exch: ${exc.exchangeRef})`;
      const inteqalNo = inL.inteqalNo || '—';
      const khewatNo = inL.khewatNo || '—';
      const khasraNo = inL.khasraNo || '—';

      if (search && search.trim()) {
        const clean = search.trim().toLowerCase();
        const matches = String(exc.exchangeRef || '').toLowerCase().includes(clean) ||
          String(regNo).toLowerCase().includes(clean) ||
          String(inteqalNo).toLowerCase().includes(clean) ||
          String(khewatNo).toLowerCase().includes(clean) ||
          String(khasraNo).toLowerCase().includes(clean) ||
          String(exc.party?.name || '').toLowerCase().includes(clean);
        if (!matches) return;
      }

      const excInId = `exchange-in-${exc._id}-${idx}`;
      const matchingOutAreas = [];
      activeExchanges.forEach((e) => {
        (e.outLandLines || []).forEach((ol) => {
          const isIdMatch = ol.exchangeInId === excInId;
          const isSourceMatch = ol.sourceExchange &&
            String(ol.sourceExchange?._id || ol.sourceExchange) === String(exc._id) &&
            String(ol.khasraNo).trim() === khasraNo;
          if (isIdMatch || isSourceMatch) {
            matchingOutAreas.push(normalizeArea(ol.surrenderedArea));
          }
        });
      });
      const exchangedOutArea = addAreas(...matchingOutAreas);
      const netRemainingArea = subtractAreas(inArea, exchangedOutArea);

      exchangeInRows.push({
        _id: excInId,
        isExchangeIn: true,
        exchangeId: exc._id,
        exchangeRef: exc.exchangeRef,
        dealNo: exc.dealNo,
        registryDate: exc.exchangeDate,
        moza: inL.moza || exc.moza,
        khewatNo,
        registryNo: regNo,
        inteqalNo,
        seller: exc.party,
        purchaser: { name: 'Taj Residencia (Exchange In)' },
        dealer: null,
        totalArea: inArea,
        exchangedOutArea,
        netRemainingArea,
        lines: [{
          _id: inL._id || `in-line-${idx}`,
          khewatNo,
          khasraNo,
          khasraArea: inL.khasraArea || inArea,
          acquiredArea: inArea,
          landWithMalkiyat: inArea,
          transferPercent: 100,
          exchangedOutArea,
          netRemainingArea,
          remarks: inL.remarks || `Acquired via Land Exchange ${exc.exchangeRef}`
        }],
        registryDocAttachments: (exc.attachments || []).map((att) => ({
          ...att,
          originalName: att.originalName || `Exchange Doc (${exc.exchangeRef})`
        })),
        inteqalDocAttachments: []
      });
    });
  });"""

new_code = """  // Synthesize In Land exchange records into legal acquisition entries
  const exchangeInRows = [];
  activeExchanges.forEach((exc) => {
    const groupedLines = {};

    (exc.inLandLines || []).forEach((inL, idx) => {
      const inMozaId = String(inL.moza?._id || inL.moza || exc.moza?._id || exc.moza || '');
      if (filter.moza && inMozaId !== String(filter.moza)) {
        return;
      }

      const inArea = normalizeArea(inL.acquiredArea);
      if (toSarsais(inArea) === 0) return;

      const regNo = inL.registryNo || `(Exch: ${exc.exchangeRef})`;
      const inteqalNo = inL.inteqalNo || '—';
      const khewatNo = inL.khewatNo || '—';
      const khasraNo = inL.khasraNo || '—';

      if (search && search.trim()) {
        const clean = search.trim().toLowerCase();
        const matches = String(exc.exchangeRef || '').toLowerCase().includes(clean) ||
          String(regNo).toLowerCase().includes(clean) ||
          String(inteqalNo).toLowerCase().includes(clean) ||
          String(khewatNo).toLowerCase().includes(clean) ||
          String(khasraNo).toLowerCase().includes(clean) ||
          String(exc.party?.name || '').toLowerCase().includes(clean);
        if (!matches) return;
      }

      const excInId = `exchange-in-${exc._id}-${idx}`;
      const matchingOutAreas = [];
      activeExchanges.forEach((e) => {
        (e.outLandLines || []).forEach((ol) => {
          const isIdMatch = ol.exchangeInId === excInId;
          const isSourceMatch = ol.sourceExchange &&
            String(ol.sourceExchange?._id || ol.sourceExchange) === String(exc._id) &&
            String(ol.khasraNo).trim() === khasraNo;
          if (isIdMatch || isSourceMatch) {
            matchingOutAreas.push(normalizeArea(ol.surrenderedArea));
          }
        });
      });
      const exchangedOutArea = addAreas(...matchingOutAreas);
      const netRemainingArea = subtractAreas(inArea, exchangedOutArea);

      const groupKey = `${regNo}|${inteqalNo}`;
      if (!groupedLines[groupKey]) {
        groupedLines[groupKey] = {
          _id: `exchange-in-${exc._id}-${regNo.replace(/[^a-zA-Z0-9]/g, '')}`,
          isExchangeIn: true,
          exchangeId: exc._id,
          exchangeRef: exc.exchangeRef,
          dealNo: exc.dealNo,
          registryDate: exc.exchangeDate,
          moza: inL.moza || exc.moza,
          khewatNos: new Set(),
          registryNo: regNo,
          inteqalNo,
          seller: exc.party,
          purchaser: { name: 'Taj Residencia (Exchange In)' },
          dealer: null,
          totalArea: { kanal: 0, marla: 0, sarsai: 0 },
          exchangedOutArea: { kanal: 0, marla: 0, sarsai: 0 },
          netRemainingArea: { kanal: 0, marla: 0, sarsai: 0 },
          lines: [],
          registryDocAttachments: (exc.attachments || []).map((att) => ({
            ...att,
            originalName: att.originalName || `Exchange Doc (${exc.exchangeRef})`
          })),
          inteqalDocAttachments: []
        };
      }

      const grp = groupedLines[groupKey];
      grp.khewatNos.add(khewatNo);
      grp.totalArea = addAreas(grp.totalArea, inArea);
      grp.exchangedOutArea = addAreas(grp.exchangedOutArea, exchangedOutArea);
      grp.netRemainingArea = addAreas(grp.netRemainingArea, netRemainingArea);
      
      grp.lines.push({
        _id: inL._id || `in-line-${idx}`,
        khewatNo,
        khasraNo,
        khasraArea: inL.khasraArea || inArea,
        acquiredArea: inArea,
        landWithMalkiyat: inArea,
        transferPercent: 100,
        exchangedOutArea,
        netRemainingArea,
        remarks: inL.remarks || `Acquired via Land Exchange ${exc.exchangeRef}`
      });
    });

    Object.values(groupedLines).forEach(grp => {
      grp.khewatNo = Array.from(grp.khewatNos).join(', ');
      delete grp.khewatNos;
      exchangeInRows.push(grp);
    });
  });"""

content = content.replace(old_code, new_code)
with open('server/routes/landAcquisitionRegistry.js', 'w') as f:
    f.write(content)
print("Patch applied successfully.")
