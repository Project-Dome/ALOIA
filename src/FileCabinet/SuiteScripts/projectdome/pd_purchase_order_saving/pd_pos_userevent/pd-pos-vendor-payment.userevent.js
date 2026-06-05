/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
*  @author Mário Augusto Braga Costa - Project Dome
 */
define(
    [
        'N/log',
        'N/record',
        'N/search',

        '../pd_pos_service/pd-pos-vendor-payment.service.js',
        '../pd_pos_service/pd-pos-vendor-bill.service.js',
        '../pd_pos_service/pd-pos-commission-approval.service.js',
        '../pd_pos_service/pd-pos-status-commission.service.js',

        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-search.util',
        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-record.util',
        '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js'
    ],
    function (
        log,
        record,
        search,

        vendor_payment_service,
        vendor_bill_service,
        commission_approval_service,
        status_commission_service,

        search_util,
        record_util
    ) {
        function isValidAction(context) {
            return context.type === context.UserEventType.CREATE ||
                context.type === context.UserEventType.EDIT
        }

        function beforeSubmit(context) {
            if (!isValidAction(context)) return;

            const vendorPaymentData = vendor_payment_service.readData(context.newRecord);
            log.audit({ title: 'vendorPaymentData', details: vendorPaymentData });

            simulateParentTransactionEditing(vendorPaymentData);
        }

        function simulateParentTransactionEditing(vendorPaymentData) {
            vendorPaymentData.applyList.forEach(applyLineData => {
                let isApply = applyLineData.apply == true;

                if (!isApply) return;

                let vendorBillId = applyLineData.doc;

                const vendorBillRecord = load({ id: vendorBillId });
                const vendorBillData = vendor_bill_service.readData(vendorBillRecord);
                const vendorBillIsStatusOpen = vendor_bill_service.getBy({
                    by: 'statusAndId',
                    status: ['paidFull'],
                    transactionId: vendorBillId
                });
                log.audit({ title: 'Vendor Bill Is Status Open', details: vendorBillIsStatusOpen });

                if (!vendorBillIsStatusOpen) return;

                const { totalSaving, finalCost } = vendorBillData.itemList.reduce(
                    (acc, item) => ({
                        totalSaving: acc.totalSaving + ((item.estimatedCost - item.rate) * item.quantity),
                        finalCost: acc.finalCost + (item.finalCost * item.quantity)
                    }),
                    { totalSaving: 0, finalCost: 0 }
                );
                log.audit({ title: 'totalSaving', details: totalSaving });

                const commissionData = commission_approval_service.getBy({
                    by: 'transactionId',
                    transactionId: vendorBillId
                });

                const hasCommissionRecord = commissionData && Object.keys(commissionData).length > 0;
                if (hasCommissionRecord) return log.error({ title: 'Commission Record Exists', details: commissionData });

                const approvalCommissionRecord = commission_approval_service.create();

                commission_approval_service.set({
                    record: approvalCommissionRecord,
                    data: {
                        transaction: vendorBillId,
                        status: status_commission_service.STATUS_COMMISSION.PENDING,
                        amountValue: totalSaving
                    }
                });
                commission_approval_service.save(approvalCommissionRecord);
            });
        }

        return {
            beforeSubmit: beforeSubmit
        };
    }
);