/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/log', 'N/redirect', 'N/runtime'], (log, redirect, runtime) => {

  const FORM_IDS = {
    DROPSHIP: 243,
    DEFAULT: 241
  };

  const beforeLoad = (context) => {
    try {
      if (context.type !== context.UserEventType.CREATE) {
        return;
      }

      const request = context.request;

      if (!request || !request.parameters) {
        return;
      }

      const params = request.parameters;

      const isDropship =
        String(params.dropship || '').toUpperCase() === 'T';

      const targetFormId = isDropship
        ? FORM_IDS.DROPSHIP
        : FORM_IDS.DEFAULT;

      const currentFormId = params.customform || params.cf;

      log.audit({
        title: 'PD | PO Form - decision',
        details: {
          executionContext: runtime.executionContext,
          isDropship,
          targetFormId,
          currentFormId,
          params
        }
      });

      if (Number(currentFormId) === Number(targetFormId)) {
        log.audit({
          title: 'PD | PO Form - already on target form',
          details: targetFormId
        });
        return;
      }

      const redirectParams = {
        ...params,
        customform: String(targetFormId),
        cf: String(targetFormId),
        pd_form_redirected: 'T'
      };

      if (params.pd_form_redirected === 'T') {
        log.audit({
          title: 'PD | PO Form - redirect already attempted',
          details: redirectParams
        });
        return;
      }

      log.audit({
        title: 'PD | PO Form - redirecting with form',
        details: redirectParams
      });

      redirect.toRecord({
        type: 'purchaseorder',
        isEditMode: true,
        parameters: redirectParams
      });

    } catch (e) {
      log.error({
        title: 'PD | PO Form - error',
        details: {
          name: e.name,
          message: e.message,
          stack: e.stack
        }
      });

      throw e;
    }
  };

  return {
    beforeLoad
  };

});