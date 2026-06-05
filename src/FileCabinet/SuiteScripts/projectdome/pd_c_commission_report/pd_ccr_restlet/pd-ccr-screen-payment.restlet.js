/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @Author Filipe Carvalho - SuiteCode
 */
define(['N/search', 'N/log', 'N/url'], function (search, log, url) {
    function postHandler(requestBody) {
        return getCommissionData(requestBody);
    }

    function getCommissionData(option) {
        try {
            log.debug('Inicio', 'Iniciando getCommissionData');

            const filters = [
                ['custrecord_pd_ccr_sales_admin', 'noneof', '@NONE@'],
                'AND',
                ['custrecord_pd_ccr_status', 'anyof', '1'],
                'AND',
                ['custrecord_pd_ccr_approval_date', 'within', 'thismonth'],
                'AND',
                ['custrecord_pd_ccr_vendor_bill_linked', 'anyof', '@NONE@']//,
                // 'AND',
                // ['custrecord_pd_ccr_vendor_employee', 'noneof', '@NONE@']
            ];
            log.debug('Filters', JSON.stringify(filters));

            const colVendorEmployee = search.createColumn({
                name: 'custrecord_pd_ccr_vendor_employee'
            });
            const colAmountValue = search.createColumn({
                name: 'custrecord_pd_ccr_amount_value'
            });
            const invoiceId = search.createColumn({
                name: 'custrecord_pd_ccr_transaction'
            });
            log.debug('Columns', 'Columns criadas');

            const s = search.create({
                type: 'customrecord_pd_ccr_approval_comission',
                filters: filters,
                columns: [colVendorEmployee, colAmountValue, invoiceId]
            });
            log.debug('Search', 'Busca criada');

            const individualResults = [];
            const paged = s.runPaged({ pageSize: 1000 });
            log.debug('Paged', `Total de páginas: ${paged.pageRanges.length}`);

            paged.pageRanges.forEach(function (range) {
                log.debug('PageRange', `Processando página: ${range.index}`);
                const page = paged.fetch({ index: range.index });
                log.debug('Page', `Registros na página: ${page.data.length}`);

                page.data.forEach(function (r, idx) {
                    const vendorEmployeeId = r.getValue(colVendorEmployee);
                    const vendorEmployee = r.getText(colVendorEmployee);
                    const invoice = r.getValue(invoiceId);
                    const invoiceName = r.getText(invoiceId);
                    const amountValue = parseFloat(r.getValue(colAmountValue)) || 0;

                    log.debug('Registro', `#${idx} - vendorEmployee: ${vendorEmployee}, amountValue: ${amountValue}, id: ${r.id}`);

                    individualResults.push({
                        vendorEmployeeId: vendorEmployeeId,
                        vendorEmployee: vendorEmployee,
                        amountValue: amountValue,
                        invoiceId: invoice,
                        invoiceName: invoiceName,
                        id: r.id
                    });
                });
            });

            log.debug({
                title: 'individualResults',
                details: JSON.stringify(individualResults)
            });

            const groupedResults = {};
            individualResults.forEach(function (item) {
                const vendorKey = item.vendorEmployee || 'no-vendor';

                if (!groupedResults[vendorKey]) {
                    groupedResults[vendorKey] = {
                        vendorEmployee: item.vendorEmployee,
                        totalAmount: 0,
                        details: [],
                        isGroup: true
                    };
                }

                groupedResults[vendorKey].totalAmount += item.amountValue;
                groupedResults[vendorKey].details.push({
                    vendorEmployeeId: item.vendorEmployeeId,
                    vendorEmployee: item.vendorEmployee,
                    amountValue: item.amountValue,
                    invoiceName: item.invoiceName,
                    invoiceUrl: buildRecordUrl('invoice', item.invoiceId),
                    id: item.id,
                    isGroup: false
                });
            });

            const finalResults = [];
            Object.keys(groupedResults).forEach(function (vendorKey) {
                const group = groupedResults[vendorKey];

                // Adicionar o registro do grupo (total)
                finalResults.push({
                    vendorEmployeeId: group.details[0].vendorEmployeeId,
                    vendorEmployee: group.vendorEmployee,
                    amountValue: group.totalAmount,
                    isGroup: true,
                    detailCount: group.details.length,
                    details: group.details
                });

                // Adicionar os detalhes (registros individuais)
                group.details.forEach(function (detail) {
                    finalResults.push(detail);
                });
            });

            log.debug('Final', `Total de resultados: ${finalResults.length}`);
            log.debug('Grouped Results', JSON.stringify(groupedResults));

            return {
                success: true,
                data: finalResults,
                summary: {
                    totalRecords: individualResults.length,
                    totalVendors: Object.keys(groupedResults).length
                }
            };
        } catch (e) {
            log.error('Erro Restlet getCommissionData', e);
            return { success: false, message: e.message };
        }
    }

    function buildRecordUrl(recordType, recordId) {
        return url.resolveRecord({
            recordType: recordType,
            recordId: recordId
        });
    }

    return {
        post: postHandler
    };
});