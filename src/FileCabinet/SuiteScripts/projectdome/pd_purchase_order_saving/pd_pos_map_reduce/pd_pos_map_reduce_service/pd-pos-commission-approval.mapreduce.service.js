/**
 * @NApiVersion 2.1
 * @ModuleScope public
 * @author Project Dome - Mário Augusto Braga Costa
 */
define(
    [
        'N/log',
        'N/record',
        'N/runtime',
        'N/cache',
        'N/record',
        'N/format',
        'N/query',


        '../../pd_pos_service/pd-pos-commission-approval.service',
        '../../pd_pos_service/pd-pos-status-commission.service',
        '../../pd_pos_service/pd-pos-vendor-bill.service',
    ],
    function (
        log,
        record,
        runtime,
        cache,
        record,
        format,
        query,

        commission_approval_service,
        status_commission_service,
        vendor_bill_service
    ) {
        function getVendorBillByInvoice() {
            const _queryString = buildQuery();

            const _results = query.runSuiteQL({
                query: _queryString
            }).asMappedResults();

            log.audit({ title: '_results', details: _results });

            return _results.length > 0 ? _results : null;

            function buildQuery() {
                const _queryString = [
                    `SELECT
                        MAX(tl.netamount * -1) as invoiceAmount,
                        MAX(e.custentity_aae_comission_rates) as commissionRate,
                        tl.custcol_aae_purchaseorder as purchaseOrderId,
                        transaction.id as invoiceId,
                        vendorBillLine.transaction as vendorBillId,
                        tl.custcol_aae_buyer_purchase_order as buyer,
                        tl.custcol_pd_cso_line_reference as lineReference
                    FROM
                        transaction
                        INNER JOIN transactionline as tl ON tl.transaction = transaction.id
                        AND mainline = 'F'
                        AND taxline = 'F'
                        AND tl.custcol_aae_purchaseorder IS NOT NULL
                        INNER JOIN employee as e on e.id = tl.custcol_aae_buyer_purchase_order
                        INNER JOIN transactionline as vendorBillLine ON vendorBillLine.createdfrom = tl.custcol_aae_purchaseorder
                        AND vendorBillLine.mainline = 'F'
                        AND vendorBillLine.taxline = 'F'
                        AND vendorBillLine.custcol_pd_cso_line_reference = tl.custcol_pd_cso_line_reference
                        INNER JOIN transaction as vendorbill on vendorbill.id = vendorBillLine.transaction
                        AND vendorbill.recordtype = 'vendorbill'
                        LEFT JOIN customrecord_pd_pos_approval_saving AS aps ON aps.custrecord_pd_pos_pas_transaction = vendorBillLine.transaction  
                        AND aps.custrecord_pd_pos_pas_employee = tl.custcol_aae_buyer_purchase_order
                    WHERE
                        transaction.status = 'CustInvc:B'
                        AND transaction.recordtype = 'invoice'
                        AND aps.id IS NULL
                        AND transaction.id = 19069
                    GROUP BY
                        tl.custcol_aae_purchaseorder,
                        transaction.id,
                        vendorBillLine.transaction,
                        tl.custcol_aae_buyer_purchase_order,
                        tl.custcol_pd_cso_line_reference`
                ].join(' ');

                return _queryString;
            }
        }

        function getInputData() {
            try {
                return getVendorBillByInvoice();
            } catch (error) {
                log.error({ title: 'error', details: error });
            }
        }

        function map(context) {
            try {
                const _optionsData = JSON.parse(context.value);
                log.audit({ title: 'Key', details: `${_optionsData.invoiceid}&&${_optionsData.buyer}` });

                context.write({
                    key: `${_optionsData.invoiceid}&&${_optionsData.buyer}`,
                    value: _optionsData
                });
            } catch (exception) {
                log.error('Exceptions map', exception);
            };
        };

        function reduce(context) {
            try {
                let _commissionValue = 0;
                let _saleValue = 0;
                let _purchaseValue = 0;
                let _finalProfit = 0;

                let _invoiceData = JSON.parse(context.values[0]);

                log.audit({ title: "_invoiceData", details: _invoiceData });

                context.values.forEach(commissionApprovalData => {
                    const _optionsData = JSON.parse(commissionApprovalData);
                    log.audit({ title: 'Data reduce', details: _optionsData });

                    const vendorBillLines = vendor_bill_service.getLinesByTransactionIds(_optionsData.vendorbillid);
                    log.audit({ title: 'vendorBillLines', details: vendorBillLines });

                    const totalList = mapTotal(vendorBillLines, _optionsData);

                    _saleValue += _optionsData.invoiceamount;
                    _commissionValue += totalList.commissionValue;
                    _purchaseValue += totalList.purchaseValue;

                    log.audit({ title: '_commissionValue for each', details: totalList });
                });

                _finalProfit = _saleValue - _purchaseValue

                log.audit({
                    title: '_commissionValue',
                    details: {
                        transaction: _invoiceData.vendorbillid,
                        status: _commissionValue > 0 ? status_commission_service.STATUS_COMMISSION.PENDING : status_commission_service.STATUS_COMMISSION.APPROVED,
                        amountValue: _commissionValue > 0 ? _commissionValue : 0,
                        buyer: _invoiceData.buyer,
                        saleValue: _saleValue,
                        finalProfit: _finalProfit,
                        purchaseValue: _purchaseValue,
                        buyerCommission: _invoiceData.commissionrate
                    }
                });

                const approvalCommissionRecord = commission_approval_service.create();
                commission_approval_service.set({
                    record: approvalCommissionRecord,
                    data: {
                        transaction: _invoiceData.vendorbillid,
                        status: _commissionValue > 0 ? status_commission_service.STATUS_COMMISSION.PENDING : status_commission_service.STATUS_COMMISSION.APPROVED,
                        amountValue: _commissionValue > 0 ? _commissionValue : 0,
                        buyer: _invoiceData.buyer,
                        saleValue: _saleValue,
                        finalProfit: _finalProfit,
                        purchaseValue: _purchaseValue,
                        buyerCommission: _invoiceData.commissionrate
                    }
                });
                commission_approval_service.save(approvalCommissionRecord);
            } catch (e) {
                log.error('Exceptions reduce', e);
            }
        }

        function mapTotal(vendorBillLines, invoiceData) {
            const filteredLines = vendorBillLines.filter(({ buyer, lineReference }) =>
                invoiceData.buyer == buyer && invoiceData.linereference == lineReference
            );

            let commissionValue = 0;
            let purchaseValue = 0;

            filteredLines.forEach(function (lineData) {
                commissionValue += parseFloat(lineData.amount || 0);
                purchaseValue += parseFloat(lineData.total || 0);
            });

            return {
                commissionValue: commissionValue,
                purchaseValue: purchaseValue
            };
        }

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce
        }
    }
);
