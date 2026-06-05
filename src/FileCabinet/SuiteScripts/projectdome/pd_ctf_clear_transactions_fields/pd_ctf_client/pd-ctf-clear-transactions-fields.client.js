/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define([], () => {
  // === Configurações ===
  const SUBLISTS_COPY = ['item'];              // trata quando a TRANS estiver em modo copy
  const SUBLISTS_LINE = ['item', 'expense'];   // sublistas onde a linha pode ser copiada/inserida

  const BODY_FIELDS_TO_CLEAR = ['custbody_pd_cso_linked_requistion'];

  const LINE_FIELDS_TO_CLEAR_ON_TX_COPY = [
    'custcol_aae_purchaseorder',
    'custcol_aae_buyer_purchase_order',
    'custcol_pd_pow_purchord_vendor',
    'custcol_pd_cso_line_reference',
    'custcol_aae_final_cost_po'
  ];

  const LINE_FIELD_ALWAYS_EMPTY_ON_LINE_COPY = 'custcol_pd_cso_line_reference';

  const _includes = (arr, v) => Array.isArray(arr) && arr.indexOf(v) !== -1;

  // === 1) Cópia de TRANSação: limpa corpo + todas as linhas existentes ===
  function pageInit(context) {
    try {
      if (context.mode !== 'copy') return;

      const rec = context.currentRecord;

      // 1.1 Corpo
      BODY_FIELDS_TO_CLEAR.forEach(fid => {
        const cur = rec.getValue({ fieldId: fid });
        if (cur) rec.setValue({ fieldId: fid, value: '', ignoreFieldChange: true });
      });

      // 1.2 Linhas
      SUBLISTS_COPY.forEach(sublistId => {
        const lineCount = rec.getLineCount({ sublistId });
        for (let i = 0; i < lineCount; i++) {
          rec.selectLine({ sublistId, line: i });
          LINE_FIELDS_TO_CLEAR_ON_TX_COPY.forEach(fieldId => {
            const cur = rec.getCurrentSublistValue({ sublistId, fieldId });
            if (cur) {
              rec.setCurrentSublistValue({
                sublistId,
                fieldId,
                value: '',
                ignoreFieldChange: true
              });
            }
          });
          rec.commitLine({ sublistId });
        }
      });
    } catch (e) {
      console.log('pageInit(copy) error:', e);
    }
  }

  // === 2) Linha nova (buffer) — cobre "copiar linha" e "nova linha" ===
  // O NetSuite mantém a "linha em edição" no índice igual ao lineCount (buffer não-commitado).
  function lineInit(context) {
    try {
      if (!_includes(SUBLISTS_LINE, context.sublistId)) return;

      const rec = context.currentRecord;
      const sublistId = context.sublistId;

      const lineCount = rec.getLineCount({ sublistId });
      const curIndex = rec.getCurrentSublistIndex({ sublistId });

      // Se curIndex === lineCount, estamos na linha em edição (ainda não commitada).
      // É aqui que a cópia de linha cai — os campos vêm preenchidos e limpamos o campo de referência.
      if (curIndex === lineCount) {
        const curVal = rec.getCurrentSublistValue({
          sublistId,
          fieldId: LINE_FIELD_ALWAYS_EMPTY_ON_LINE_COPY
        });

        if (curVal) {
          rec.setCurrentSublistValue({
            sublistId,
            fieldId: LINE_FIELD_ALWAYS_EMPTY_ON_LINE_COPY,
            value: '',
            ignoreFieldChange: true
          });
        }
      }
      // Se curIndex < lineCount: é uma linha existente selecionada — não limpar (mantém comportamento correto).
    } catch (e) {
      console.log('lineInit error:', e);
    }
  }

  // === 3) Backup: inserção explícita de linha (nem toda UI dispara) ===
  function validateInsert(context) {
    try {
      if (!_includes(SUBLISTS_LINE, context.sublistId)) return true;

      const rec = context.currentRecord;
      rec.setCurrentSublistValue({
        sublistId: context.sublistId,
        fieldId: LINE_FIELD_ALWAYS_EMPTY_ON_LINE_COPY,
        value: '',
        ignoreFieldChange: true
      });

      return true; // permite inserir
    } catch (e) {
      console.log('validateInsert error:', e);
      return true;
    }
  }

  // Importante: não limpar em validateLine para não afetar edições de linhas existentes
  return { pageInit, lineInit, validateInsert };
});
