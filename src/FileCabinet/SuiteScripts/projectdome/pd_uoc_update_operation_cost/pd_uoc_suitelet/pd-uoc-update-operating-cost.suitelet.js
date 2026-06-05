/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/record','N/search','N/log'], (record, search, log) => {

  const FIELD_MAP = [
    { poField: 'custcol_aee_freight_cost_vendor_ap',   soField: 'custcol_aee_freight_cost_vendor_ar' },
    { poField: 'custcol_aae_hazmat_aog_other_fees_ap', soField: 'custcol_aae_hazmat_aog_other_fees_ar' },
  ];

  const LINK_PO_ON_LINE = 'custcol_aae_purchaseorder';
  const LINE_REF_FIELD  = 'custcol_pd_cso_line_reference'; // <— NOVO: referência única de linha

  function json(ctx, payload) {
    ctx.response.setHeader({ name: 'Content-Type', value: 'application/json' });
    ctx.response.write(JSON.stringify(payload));
  }

  function asRecordType(recType) {
    if (recType === 'invoice') return record.Type.INVOICE;
    return record.Type.SALES_ORDER;
  }

  function asSearchType(recType) {
    if (recType === 'invoice') return search.Type.INVOICE;
    return search.Type.SALES_ORDER;
  }

  function numOrZero(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }

  function onRequest(ctx) {
    if (ctx.request.method !== 'GET') {
      return json(ctx, { success:false, message:'Use GET.' });
    }

    const recTypeParam = (ctx.request.parameters.recType || 'salesorder').toLowerCase();
    const recIdParam   = ctx.request.parameters.recId;
    const recId        = parseInt(recIdParam, 10);

    if (!recId || Number.isNaN(recId)) {
      return json(ctx, { success:false, message:`Invalid recId parameter: "${recIdParam}"` });
    }

    try {
      // existence/permission check
      try {
        search.lookupFields({ type: asSearchType(recTypeParam), id: recId, columns: ['tranid'] });
      } catch (lkErr) {
        log.error('lookupFields failed', { recType: recTypeParam, recId, lkErr });
        return json(ctx, { success:false, message:`${recTypeParam} ${recId} not found or insufficient permissions.` });
      }

      let trnRec;
      try {
        trnRec = record.load({ type: asRecordType(recTypeParam), id: recId, isDynamic: false });
      } catch (loadErr) {
        log.error('record.load failed', { recType: recTypeParam, recId, loadErr });
        return json(ctx, { success:false, message:`Failed to load ${recTypeParam} ${recId}: ${loadErr.message || loadErr}` });
      }

      const isInvoice = (recTypeParam === 'invoice');
      const lineCount = trnRec.getLineCount({ sublistId: 'item' });

      let updated = 0;
      let matched = 0;

      // Para propagação p/ SO quando for invoice:
      const invLineResults = []; // [{ key: <lineRef|orderline>, by: 'ref'|'orderline', values: {...} }]

      const poCache = {};
      // Controle “fallback por item” (só se NÃO houver line reference na linha)
      const poUsedIndexByItem = {}; // { [poId]: { [itemId]: Set(indexes) } }

      function ensurePoUsage(poId, itemId) {
        if (!poUsedIndexByItem[poId]) poUsedIndexByItem[poId] = {};
        if (!poUsedIndexByItem[poId][itemId]) poUsedIndexByItem[poId][itemId] = new Set();
      }

      // Índices auxiliares por PO: lineRef -> j
      const poIndexByRef = {}; // { [poId]: { [ref]: j } }

      function buildPoRefIndex(poId, poRec) {
        if (poIndexByRef[poId]) return;
        const map = {};
        const cnt = poRec.getLineCount({ sublistId: 'item' });
        for (let j = 0; j < cnt; j++) {
          const ref = poRec.getSublistValue({ sublistId:'item', fieldId: LINE_REF_FIELD, line:j });
          if (ref) map[String(ref)] = j;
        }
        poIndexByRef[poId] = map;
      }

      for (let i = 0; i < lineCount; i++) {
        const rawPoId = trnRec.getSublistValue({ sublistId:'item', fieldId: LINK_PO_ON_LINE, line: i });
        if (!rawPoId) continue;

        const poIdNum = parseInt(rawPoId, 10);
        if (!poIdNum || Number.isNaN(poIdNum)) {
          log.audit('Non-numeric PO id on line', { recType: recTypeParam, recId, line: i, rawPoId });
          continue;
        }

        // carrega/cacha PO
        if (!poCache[poIdNum]) {
          try {
            poCache[poIdNum] = record.load({ type: record.Type.PURCHASE_ORDER, id: poIdNum, isDynamic: false });
          } catch (poErr) {
            log.error('record.load PO failed', { poId: poIdNum, poErr });
            continue;
          }
        }
        const poRec = poCache[poIdNum];

        // 1) Tenta casar por referência única de linha
        const lineRef = trnRec.getSublistValue({ sublistId:'item', fieldId: LINE_REF_FIELD, line:i });
        let matchedPoLine = -1;
        if (lineRef) {
          buildPoRefIndex(poIdNum, poRec);
          const idx = poIndexByRef[poIdNum][String(lineRef)];
          if (typeof idx === 'number') matchedPoLine = idx;
        }

        // 2) Fallback: casar por item sem cruzar linhas (apenas se NÃO houver lineRef)
        if (matchedPoLine === -1 && !lineRef) {
          const itemId = trnRec.getSublistValue({ sublistId:'item', fieldId:'item', line:i });
          if (!itemId) continue;

          ensurePoUsage(poIdNum, itemId);
          const used = poUsedIndexByItem[poIdNum][itemId];

          const poLineCount = poRec.getLineCount({ sublistId: 'item' });
          for (let j = 0; j < poLineCount; j++) {
            const poItemId = poRec.getSublistValue({ sublistId:'item', fieldId:'item', line:j });
            if (Number(poItemId) !== Number(itemId)) continue;
            if (used.has(j)) continue;
            matchedPoLine = j;
            used.add(j);
            break;
          }
        }

        if (matchedPoLine === -1) {
          log.audit('No PO line match for transaction line', { recType: recTypeParam, recId, poId: poIdNum, line: i, lineRef });
          continue;
        }

        matched++;

        // Copia campos: null/empty/NaN => 0
        let lineTouched = false;
        const valuesWritten = {};

        for (const map of FIELD_MAP) {
          const rawFrom = poRec.getSublistValue({ sublistId:'item', fieldId: map.poField, line: matchedPoLine });
          const fromVal = numOrZero(rawFrom); // força zero
          const toField = map.soField;

          const oldRaw = trnRec.getSublistValue({ sublistId:'item', fieldId: toField, line:i });
          const oldVal = numOrZero(oldRaw);

          if (oldVal !== fromVal) {
            trnRec.setSublistValue({ sublistId:'item', fieldId: toField, line:i, value: fromVal });
            lineTouched = true;
          }
          valuesWritten[toField] = fromVal; // final value (mesmo que igual)
        }

        if (lineTouched) updated++;

        if (isInvoice) {
          // Preferir propagar para SO por referência; fallback: orderline
          const orderline = trnRec.getSublistValue({ sublistId:'item', fieldId:'orderline', line:i });
          if (lineRef) {
            invLineResults.push({ key: String(lineRef), by: 'ref', values: valuesWritten });
          } else if (orderline) {
            invLineResults.push({ key: parseInt(orderline, 10), by: 'orderline', values: valuesWritten });
          }
        }
      }

      // Salva a transação principal somente se houve alteração
      try {
        if (updated > 0) trnRec.save({ ignoreMandatoryFields: true });
      } catch (saveErr) {
        log.error('Save failed', { recType: recTypeParam, recId, saveErr });
        return json(ctx, { success:false, message:`Failed to save ${recTypeParam} ${recId}: ${saveErr.message || saveErr}` });
      }

      // Propagar p/ Sales Order se for INVOICE
      let soUpdatedLines = 0;
      if (isInvoice && invLineResults.length > 0) {
        const soId = trnRec.getValue('createdfrom');
        if (soId) {
          let soRec;
          try {
            search.lookupFields({ type: search.Type.SALES_ORDER, id: soId, columns: ['tranid'] });
            soRec = record.load({ type: record.Type.SALES_ORDER, id: soId, isDynamic: false });
          } catch (e) {
            log.error('Could not load source Sales Order for propagation', { soId, e });
          }

          if (soRec) {
            const soLineCount = soRec.getLineCount({ sublistId: 'item' });

            // Índices para lookup na SO
            const soIndexByRef = {};        // ref -> index
            const soIndexByLineNumber = {}; // line -> index

            for (let s = 0; s < soLineCount; s++) {
              const lineNo = parseInt(soRec.getSublistValue({ sublistId:'item', fieldId:'line', line:s }), 10);
              if (Number.isFinite(lineNo)) soIndexByLineNumber[lineNo] = s;

              const soRef = soRec.getSublistValue({ sublistId:'item', fieldId: LINE_REF_FIELD, line:s });
              if (soRef) soIndexByRef[String(soRef)] = s;
            }

            for (const r of invLineResults) {
              let idx = null;
              if (r.by === 'ref' && soIndexByRef.hasOwnProperty(r.key)) {
                idx = soIndexByRef[r.key];
              } else if (r.by === 'orderline' && soIndexByLineNumber.hasOwnProperty(r.key)) {
                idx = soIndexByLineNumber[r.key];
              }
              if (idx == null) continue;

              let touched = false;
              for (const map of FIELD_MAP) {
                const toField = map.soField;
                const fromVal = numOrZero(r.values[toField]);

                const oldRaw = soRec.getSublistValue({ sublistId:'item', fieldId: toField, line: idx });
                const oldVal = numOrZero(oldRaw);

                if (oldVal !== fromVal) {
                  soRec.setSublistValue({ sublistId:'item', fieldId: toField, line: idx, value: fromVal });
                  touched = true;
                }
              }
              if (touched) soUpdatedLines++;
            }

            if (soUpdatedLines > 0) {
              try {
                soRec.save({ ignoreMandatoryFields: true });
              } catch (soSaveErr) {
                log.error('Failed saving propagated Sales Order', { soId, soSaveErr });
              }
            }
          }
        }
      }

      const alreadyUpToDate = matched > 0 && updated === 0;
      return json(ctx, {
        success: true,
        updatedLines: updated,
        matchedLines: matched,
        alreadyUpToDate,
        soUpdatedLines
      });

    } catch (e) {
      log.error('Suitelet error (catch-all)', { recType: ctx.request.parameters.recType, recId: ctx.request.parameters.recId, e });
      return json(ctx, { success:false, message:`${e.name || 'Error'}: ${e.message || e}` });
    }
  }

  return { onRequest };
});
