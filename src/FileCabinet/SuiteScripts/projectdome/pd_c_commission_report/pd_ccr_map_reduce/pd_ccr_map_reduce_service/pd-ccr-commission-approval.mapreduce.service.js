/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author Project Dome - Mário Augusto Braga Costa
 */
define(
    [
        'N/log',
        'N/query',

        '../../pd_ccr_service/pd-ccr-invoice.service',
        '../../pd_ccr_service/pd-ccr-commission-approval.service',
        '../../pd_ccr_service/pd-ccr-status-commission-approval.service'
    ],
    function (
        log,
        query,

        invoice_service,
        commission_approval_service,
        status_commission_service
    ) {
        function getInvoiceByVendorBill() {
            const _queryString = buildQuery();
            const _results = query.runSuiteQL({
                query: _queryString
            }).asMappedResults();
            log.audit({ title: '_results', details: _results });

            return _results.length > 0 ? _results : null;

            function buildQuery() {
                const _queryString = [
                    `SELECT
                        distinct invoiceLine.transaction AS invoiceid
                    FROM
                        transaction as t
                        INNER JOIN transactionline AS invoiceLine ON invoiceLine.transaction = t.id
                        and invoiceLine.mainline = 'F'
                        and invoiceLine.taxline = 'F'
                        and invoiceLine.custcol_aae_purchaseorder IS NOT NULL
                        LEFT JOIN customrecord_pd_ccr_approval_comission AS apc ON apc.custrecord_pd_ccr_transaction = invoiceLine.transaction
                    where
                        t.recordtype = 'invoice'
                        and t.status = 'CustInvc:B'
                        and t.id = 17703
                        and apc.id IS NULL`
                ].join(' ');

                return _queryString;
            }
        }

        function getInputData() {
            try {
                return getInvoiceByVendorBill();
            } catch (error) {
                log.error({ title: 'error', details: error });
            }
        }

        function map(context) {
            try {
                const _optionsData = JSON.parse(context.value);
                context.write({
                    key: context.key,
                    value: {
                        data: _optionsData
                    }
                });
            } catch (exception) {
                log.error('Exceptions map', exception);
            };
        };

        function reduce(context) {
            try {
                const _optionsData = JSON.parse(context.values[0])?.data;
                log.audit({ title: '_optionsData', details: _optionsData });

                const _invoiceDataBySearch = invoice_service.getBy({
                    by: 'transactionId',
                    transactionId: _optionsData.invoiceid
                })

                const approvalCommissionRecord = commission_approval_service.create();
                commission_approval_service.set({
                    record: approvalCommissionRecord,
                    data: {
                        transaction: _optionsData.invoiceid,
                        status: status_commission_service.STATUS_COMMISSION.PENDING,
                        amountValue: parseFloat(_invoiceDataBySearch.commissionTotal),
                        purchaseValue: _invoiceDataBySearch.purchaseValue,
                        saleValue: _invoiceDataBySearch.salesValue,
                        finalProfit: _invoiceDataBySearch.finalProfit,
                        commission: _invoiceDataBySearch.invoiceData[0].customerCommissionPercent
                    }
                });
                commission_approval_service.save(approvalCommissionRecord);

            } catch (e) {
                log.error('Exceptions reduce', e);
            }
        }

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce
        }
    }
);
