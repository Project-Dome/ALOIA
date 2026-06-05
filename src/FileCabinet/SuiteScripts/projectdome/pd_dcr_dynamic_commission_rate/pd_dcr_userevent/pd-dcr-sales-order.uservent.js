/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'N/runtime', 'N/log', 'N/format'], 
(record, search, runtime, log, format) => {

  // Mapeamento do select do cadastro (cliente) -> percentual numérico (exibido como % no campo percent)
  const CUSTOMER_RATE_MAP = {
    1: 5,   // 5%
    2: 10   // 10%
  };

  const TYPE = 'salesorder';
  const FIELD_BODY_TARGET_RATE = 'custbody_aae_customer_comission_rate';     // destino
  const FIELD_BODY_DATE = 'custbody_aae_cust_po_receipt';                    // data para regra fds/feriado
  const FIELD_ENTITY = 'entity';                                             // cliente (Customer)
  const CUSTOMER_FIELD_RATE = 'custentity_aae_comission_rates';              // select no cliente

  function isValidContext(type, ctx) {
    const okTypes = [ctx.UserEventType.CREATE, ctx.UserEventType.EDIT, ctx.UserEventType.XEDIT];
    return okTypes.includes(type);
  }

  function normalizeToDate(val) {
    if (!val) return null;
    if (val instanceof Date) return val;
    try { return format.parse({ value: val, type: format.Type.DATE }); } catch (e) { return null; }
  }

  function isWeekend(jsDate) {
    if (!jsDate) return false;
    const d = jsDate.getDay(); // 0=Dom,6=Sáb
    return d === 0 || d === 6;
  }

  function isHoliday(jsDate) {
    if (!jsDate) return false;
    // Pesquisa “no dia” usando o campo de data do RT
    const dateStr = format.format({ value: jsDate, type: format.Type.DATE });
    const s = search.create({
      type: 'customrecord_pd_hld_holidays',
      filters: [['custrecord_pd_hld_holiday', 'on', dateStr]],
      columns: ['internalid']
    });
    const res = s.run().getRange({ start: 0, end: 1 });
    return !!(res && res.length);
  }

  function readCustomerRate(customerId) {
    if (!customerId) return 0;
    const res = search.lookupFields({
      type: search.Type.CUSTOMER,
      id: customerId,
      columns: [CUSTOMER_FIELD_RATE]
    });
    const sel = res && res[CUSTOMER_FIELD_RATE];
    // Em alguns casos o lookup pode trazer um array de objetos {value,text} ou só o ID
    const id = Array.isArray(sel) ? (sel[0]?.value || sel[0]) : sel;
    return CUSTOMER_RATE_MAP[id] || 0;
  }

  function afterSubmit(context) {
    try {
      if (!isValidContext(context.type, context)) return;
      const rec = context.newRecord;
      if (rec.type !== TYPE) return;

      const customerId = rec.getValue({ fieldId: FIELD_ENTITY });
      const dateVal = rec.getValue({ fieldId: FIELD_BODY_DATE });
      const jsDate = normalizeToDate(dateVal);

      const baseRate = readCustomerRate(customerId); // 5 ou 10 (ou 0)
      let multiplier = 1;
      if (isWeekend(jsDate) || isHoliday(jsDate)) multiplier = 2;

      const finalRate = baseRate * multiplier; // grava como 5/10/20 (percent field mostra 5%,10%,20%)

      // Grava sem reabrir a transação
      record.submitFields({
        type: TYPE,
        id: rec.id,
        values: { [FIELD_BODY_TARGET_RATE]: finalRate },
        options: { enableSourcing: false, ignoreMandatoryFields: true }
      });

      log.audit('SO Commission', { soId: rec.id, baseRate, multiplier, finalRate, date: jsDate });

    } catch (e) {
      log.error('SO Commission - afterSubmit error', e);
    }
  }

  return { afterSubmit };
});
