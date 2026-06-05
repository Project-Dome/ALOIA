/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * Author: Lucas Monaco
 */

define([
    'N/ui/serverWidget', 
    'N/runtime'
], function (
    serverWidget, 
    runtime
) {

  function beforeLoad(context) {
    if (context.type !== context.UserEventType.VIEW) return;

    var form = context.form;
    var invoice = context.newRecord;

    form.clientScriptModulePath = './CreatePDF.CS.js';

    form.addButton({
      id: 'custpage_generate_pdf',
      label: 'Generate ATA 106',
      functionName: 'printPDF'
    });

    form.addButton({
      id: 'custpage_generate_cofc',
      label: 'Generate COFC',
      functionName: 'printPDF'
    });
  }

  return {
    beforeLoad: beforeLoad
  };
});
