/**
 * Exclui todos os registros retornados pela Saved Search customsearch1468
 *
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/log'], (search, record, log) => {

  const SAVED_SEARCH_ID = 'customsearch1468';

  function getInputData() {
    const loadedSearch = search.load({
      id: SAVED_SEARCH_ID
    });

    log.audit({
      title: 'Busca carregada',
      details: {
        savedSearchId: SAVED_SEARCH_ID,
        searchType: loadedSearch.searchType
      }
    });

    return loadedSearch;
  }

  function map(context) {
    try {
      const row = JSON.parse(context.value);

      const recordId = row.id;
      const recordType = row.recordType;

      if (!recordId || !recordType) {
        throw new Error('Linha sem id ou recordType — verifique se a busca não é agrupada (summary).');
      }

      record.delete({
        type: recordType,
        id: recordId
      });

      log.audit({
        title: 'Registro excluído',
        details: {
          type: recordType,
          id: recordId
        }
      });

      context.write({
        key: 'success',
        value: JSON.stringify({ id: recordId, type: recordType })
      });

    } catch (e) {
      log.error({
        title: 'Erro ao excluir registro',
        details: {
          error: e.message || e,
          raw: context.value
        }
      });

      context.write({
        key: 'error',
        value: JSON.stringify({
          error: e.message || String(e),
          raw: context.value
        })
      });
    }
  }

  function summarize(summary) {
    let success = 0;
    let errors = 0;

    summary.output.iterator().each((key) => {
      if (key === 'success') success++;
      if (key === 'error') errors++;
      return true;
    });

    log.audit({
      title: 'Resumo',
      details: {
        savedSearchId: SAVED_SEARCH_ID,
        success,
        errors,
        usage: summary.usage,
        yields: summary.yields
      }
    });

    if (summary.inputSummary.error) {
      log.error('Erro no input', summary.inputSummary.error);
    }

    summary.mapSummary.errors.iterator().each((key, error) => {
      log.error('Erro no map', { key, error });
      return true;
    });
  }

  return {
    getInputData,
    map,
    summarize
  };
});