/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * Filipe Carvalho - SuiteCode
 */
define(['N/record', 'N/search', 'N/error'], function(record, search, error) {

    function beforeSubmit(context) {
        if (context.type !== context.UserEventType.CREATE &&
            context.type !== context.UserEventType.EDIT) {
            return;
        }

        var newRecord = context.newRecord;
        var transactionId = newRecord.getValue('custrecord_pd_ccr_transaction');

        if (!transactionId) {
            return; // No transaction linked, no need to validate
        }

        // Define filtros
        var filters = [
            ['custrecord_pd_ccr_transaction', 'is', transactionId]
        ];

        // Se for edição, ignorar o próprio registro
        if (newRecord.id) {
            filters.push('AND');
            filters.push(['internalid', 'noneof', newRecord.id]);
        }

        // Pesquisa se já existe outro registro com a mesma transação
        var existingSearch = search.create({
            type: newRecord.type,
            filters: filters,
            columns: ['internalid']
        });

        var searchResult = existingSearch.run().getRange({ start: 0, end: 1 });

        if (searchResult && searchResult.length > 0) {
            throw error.create({
                name: 'DUPLICATE_TRANSACTION',
                message: 'A record already exists for this transaction. Creating duplicates is not allowed.',
                notifyOff: true
            });
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
