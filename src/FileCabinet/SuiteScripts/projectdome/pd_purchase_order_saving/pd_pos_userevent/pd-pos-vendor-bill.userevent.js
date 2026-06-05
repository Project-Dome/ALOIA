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

        '../pd_pos_service/pd-pos-vendor-bill.service.js',
        '../pd_pos_service/pd-pos-vendor.service.js',
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

        vendor_bill_service,
        vendor_service,
        commission_approval_service,
        status_commission_service,

        search_util,
        record_util
    ) {
        function isValidAction(context) {
            return context.type === context.UserEventType.CREATE ||
                context.type === context.UserEventType.EDIT ||
                context.type === context.UserEventType.XEDIT;
        }

        function afterSubmit(context) {
            log.audit({
                title: 'context',
                details: context
            })
            if (!isValidAction(context)) return;

            try {
                const vendorBillRecord = context.newRecord;
                const vendorBillRecordId = vendorBillRecord.id;
                const vendorBillData = vendor_bill_service.readData(vendorBillRecord);
                log.audit({ title: 'Vendor Bill Data', details: vendorBillData });

                const vendorBillIsStatusOpen = vendor_bill_service.getBy({
                    by: 'statusAndId',
                    status: ['open', 'paidFull'],
                    transactionId: vendorBillRecordId
                });
                log.audit({ title: 'Vendor Bill Is Status Open', details: vendorBillIsStatusOpen });

                if (!vendorBillIsStatusOpen) return;

                const vendorData = vendor_service.getBy({
                    by: 'id',
                    vendorId: vendorBillData.entity.id
                });
                log.audit({ title: 'Vendor Data', details: vendorData });

                // const hasEmployee = vendorData.isEmployee;

                const { totalSaving, finalCost } = vendorBillData.itemList.reduce(
                    (acc, item) => ({
                        totalSaving: acc.totalSaving + ((item.estimatedCost - item.rate) * item.quantity),
                        finalCost: acc.finalCost + (item.finalCost * item.quantity)
                    }),
                    { totalSaving: 0, finalCost: 0 }
                );

                log.audit({ title: 'totalSaving', details: totalSaving });

                // if (totalSaving == 0) return;

                // return totalSaving;

                // const commissionValue = estimatedCost - finalCost;
                const commissionData = commission_approval_service.getBy({
                    by: 'transactionId',
                    transactionId: vendorBillRecordId
                });

                const hasCommissionRecord = commissionData && Object.keys(commissionData).length > 0;
                if (hasCommissionRecord) return log.error({ title: 'Commission Record Exists', details: commissionData });

                // const commissionPercent = percentCommission(estimatedCost, finalCost);
                // const isCommissionGreaterThanTen = commissionPercent > 10;

                const approvalCommissionRecord = commission_approval_service.create();

                // if (isCommissionGreaterThanTen) {

                //     if (hasEmployee) {

                //         commission_approval_service.set({
                //             record: approvalCommissionRecord,
                //             data: {
                //                 transaction: vendorBillRecordId,
                //                 status: status_commission_service.STATUS_COMMISSION.APPROVED,
                //                 amountValue: commissionValue,
                //                 vendorEmployee: vendorBillData.entity.id
                //             }
                //         });
                //         commission_approval_service.save(approvalCommissionRecord);

                //     } else {
                commission_approval_service.set({
                    record: approvalCommissionRecord,
                    data: {
                        transaction: vendorBillRecordId,
                        status: status_commission_service.STATUS_COMMISSION.PENDING,
                        amountValue: totalSaving,
                        // vendorEmployee: vendorBillData.entity.id
                    }
                });
                commission_approval_service.save(approvalCommissionRecord);
                //     }
                // } else {
                //     commission_approval_service.set({
                //         record: approvalCommissionRecord,
                //         data: {
                //             transaction: vendorBillRecordId,
                //             status: status_commission_service.STATUS_COMMISSION.APPROVED,
                //             amountValue: commissionValue,
                //             vendorEmployee: vendorBillData.entity.id
                //         }
                //     });
                //     commission_approval_service.save(approvalCommissionRecord);
                // }
            } catch (error) {
                log.error({
                    title: 'Error on PD pos Vendor Bill User Event',
                    details: JSON.stringify(error)
                });
            }
        }

        // function percentCommission(estimateValue, finalCostValue) {
        //     const commission = ((estimateValue - finalCostValue) / estimateValue) * 100;

        //     return commission;
        // }

        return {
            afterSubmit: afterSubmit
        };
    }
);