/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/record','N/search'], (record, search) => {

    function onRequest(ctx) {
      const req = ctx.request;
      const res = ctx.response;
      res.setHeader({ name: 'Content-Type', value: 'application/json; charset=utf-8' });
  
      try {
        if (req.method !== 'GET') {
          res.write(JSON.stringify({ success: false, error: 'Invalid method. Use GET.' }));
          return;
        }
  
        const id = req.parameters.id;
        if (!id) {
          res.write(JSON.stringify({ success: false, error: 'Missing requisition id.' }));
          return;
        }
  
        // Segurança extra: bloquear se estiver Fully Ordered
        try {
          const data = search.lookupFields({
            type: 'purchaserequisition',
            id,
            columns: ['status']
          });
          const st = (data.status && data.status[0] && data.status[0].text) || '';
          if (/fully\s*ordered/i.test(st)) {
            res.write(JSON.stringify({ success: false, error: 'Requisition is Fully Ordered and cannot be deleted.' }));
            return;
          }
        } catch (_) {}
  
        record.delete({ type: 'purchaserequisition', id });
        res.write(JSON.stringify({ success: true }));
      } catch (e) {
        res.write(JSON.stringify({ success: false, error: (e && e.message) ? e.message : String(e) }));
      }
    }
  
    return { onRequest };
  });
  