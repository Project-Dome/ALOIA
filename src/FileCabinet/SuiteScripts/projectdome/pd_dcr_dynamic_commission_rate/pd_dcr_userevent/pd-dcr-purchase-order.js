/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'N/runtime', 'N/log', 'N/format'],
(record, search, runtime, log, format) => {

  // Mapeamento do select do cadastro (funcionário) -> percentual numérico
  const EMP_RATE_MAP = {
    1: 5,   // 5%
    2: 10   // 10%
  };

  const TYPE = 'purchaseorder';
  const SUBLISTS = ['item']; // adicionar 'expense' se aplicável
  const LINE_FIELD_EMP = 'custcol_aae_buyer_purchase_order';      // funcionário (Employee) por linha
  const LINE_FIELD_DATE = 'custcol_aae_cust_po_receipt';          // data referência por linha
  const LINE_FIELD_TARGET_RATE = 'custcol_aae_employee_comission_rate'; // destino por linha
  const EMP_FIELD_RATE = 'custentity_aae_comission_rates';        // select no Employee

  function isValidContext(type, ctx) {
    const ok = [ctx.UserEventType.CREATE, ctx.UserEventType.EDIT, ctx.UserEventType.XEDIT];
    return ok.includes(type);
  }

  function normalizeToDate(val) {
    if (!val) return null;
    if (val instanceof Date) return val;
    try { return format.parse({ value: val, type: format.Type.DATE }); } catch (e) { return null; }
  }

  function isWeekend(jsDate) {
    if (!jsDate) return false;
    const d = jsDate.getDay();
    return d === 0 || d === 6;
  }

  function isHoliday(jsDate) {
    if (!jsDate) return false;
    const dateStr = format.format({ value: jsDate, type: format.Type.DATE });
    const s = search.create({
      type: 'customrecord_pd_hld_holidays',
      filters: [['custrecord_pd_hld_holiday', 'on', dateStr]],
      columns: ['internalid']
    });
    const res = s.run().getRange({ start: 0, end: 1 });
    return !!(res && res.length);
  }

  function readEmployeeRate(employeeId) {
    if (!employeeId) return 0;
    const res = search.lookupFields({
      type: search.Type.EMPLOYEE,
      id: employeeId,
      columns: [EMP_FIELD_RATE]
    });
    const sel = res && res[EMP_FIELD_RATE];
    const id = Array.isArray(sel) ? (sel[0]?.value || sel[0]) : sel;
    return EMP_RATE_MAP[id] || 0;
  }

  function afterSubmit(context) {
    try {
      if (!isValidContext(context.type, context)) return;
      const newRec = context.newRecord;
      if (newRec.type !== TYPE) return;

      // Precisamos carregar a PO para conseguir escrever nas linhas
      const po = record.load({ type: TYPE, id: newRec.id, isDynamic: false });

      SUBLISTS.forEach(sublistId => {
        const lineCount = po.getLineCount({ sublistId }) || 0;

        for (let i = 0; i < lineCount; i++) {
          try {
            const employeeId = po.getSublistValue({ sublistId, fieldId: LINE_FIELD_EMP, line: i });
            const dateVal = po.getSublistValue({ sublistId, fieldId: LINE_FIELD_DATE, line: i });

            // Se não houver funcionário OU data, podemos optar por zerar ou pular — aqui vamos pular
            if (!employeeId || !dateVal) continue;

            const jsDate = normalizeToDate(dateVal);
            const baseRate = readEmployeeRate(employeeId); // 5 ou 10 ou 0

            let multiplier = 1;
            if (isWeekend(jsDate) || isHoliday(jsDate)) multiplier = 1;

            const finalRate = baseRate * multiplier; // 5/10/20 etc.

            po.setSublistValue({
              sublistId,
              fieldId: LINE_FIELD_TARGET_RATE,
              line: i,
              value: finalRate
            });

          } catch (lineErr) {
            log.error('PO Commission - line error', { line: i, sublistId, err: lineErr });
          }
        }
      });

      po.save({ enableSourcing: false, ignoreMandatoryFields: true });

      log.audit('PO Commission', { poId: newRec.id });

    } catch (e) {
      log.error('PO Commission - afterSubmit error', e);
    }
  }

  return { afterSubmit };
});
