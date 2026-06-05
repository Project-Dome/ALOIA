/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @Author Mário Augusto Braga Costa - Project Dome
 */
define(
    [
        'N/search',
        'N/log',

        '../pd_pos_service/pd-pos-status-commission.service.js',
        '../pd_pos_service/pd-pos-commission-approval.service.js',
        '../pd_pos_service/pd-pos-vendor-bill.service.js',
        '../pd_pos_service/pd-pos-script-parameters.service.js',
    ],
    function (
        search,
        log,

        status_commission_service,
        commission_approval_service,
        vendor_bill_service,
        script_parameters_service,
    ) {
        function getHandler() {
            const approvalCommissionData = commission_approval_service.getBy({
                by: 'statusAndTransactionCommission',
                status: status_commission_service.STATUS_COMMISSION.APPROVED,
                transactionCommission: 'isNull'
            });

            const hasApprovalCommissionData = !isNullOrEmpty(approvalCommissionData);
            if (!hasApprovalCommissionData) return [];

            log.audit({ title: 'approvalCommissionData', details: approvalCommissionData });

            const map = commission_approval_service.map({ by: 'vendor', data: approvalCommissionData });
            log.audit({ title: 'map', details: map });

            return map;
        }

        function postHandler(vendorDataMap) {
            log.audit({ title: 'vendorDataMap', details: vendorDataMap });


            // throw "Testing"

            vendorDataMap.forEach(element => {
                let vendorBillRecord = vendor_bill_service.create({ isDynamic: true });

                vendor_bill_service.set({
                    record: vendorBillRecord,
                    data: {
                        entity: element.vendorId,
                        tranDate: new Date(),
                        dueDate: formatDate(element.dueDate),
                        subLists: {
                            expense: [
                                {
                                    account: script_parameters_service.commissionAccountPayment(),
                                    amount: element.data.totalCommission,
                                    memo: `Commission ID: ${element.data.commissionIds}`
                                }
                            ]
                        }
                    }
                });

                // vendorBillRecord.setValue({
                //     fieldId: 'custbody_ste_use_tax',
                //     value: true,
                // })

                let vendorBillId = vendor_bill_service.save(vendorBillRecord);
                log.audit({ title: 'vendorBillId', details: vendorBillId });

                element.data?.items.forEach(commissionData => {
                    commission_approval_service.setSubmit({
                        recordId: commissionData.id,
                        vendorBill: vendorBillId
                    })
                })
            });

            return { success: true }
        }

        function formatDate(dateStr) {
            if (!dateStr) return null;

            let parts = dateStr.split('-');
            if (parts.length !== 3) return null;

            let year = parseInt(parts[0], 10);
            let month = parseInt(parts[1], 10) - 1;
            let day = parseInt(parts[2], 10);

            return new Date(year, month, day);
        }

        return {
            get: getHandler,
            post: postHandler
        };
    }
);