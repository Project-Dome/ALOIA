/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @author Project Dome - Mário Augusto Braga Costa
 */
define(
    [
        'N/runtime',
        'N/search',
        'N/log',
        'N/record',
        'N/url',
        'N/query',

        '../pd_pos_service/pd-pos-status-commission.service.js',
        '../pd_pos_service/pd-pos-commission-approval.service.js',
        '../pd_pos_service/pd-pos-vendor-bill.service.js',

        '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js'
    ],
    function (
        runtime,
        search,
        log,
        record,
        url,
        sql_query,

        status_commission_service,
        commission_approval_service,
        vendor_bill_service
    ) {

        function getHandler() {
            return getDataForCommissionApprovalReport();
        }

        function postHandler(context) {
            return manageApprove(context);
        }

        function getDataForCommissionApprovalReport() {
            const approvalCommissionPendingData = commission_approval_service.getBy({
                by: 'status',
                status: status_commission_service.STATUS_COMMISSION.PENDING
            });

            log.audit({ title: 'approvalCommissionPendingData', details: approvalCommissionPendingData });

            const hasApprovalCommissionPendingData = !isNullOrEmpty(approvalCommissionPendingData)

            if (!hasApprovalCommissionPendingData) return {}
            // log.audit({ title: 'Approval Commission Pending Data', details: approvalCommissionPendingData });

            const approvalCommissionAllTransactionIds = commission_approval_service.getAllTransactionId(approvalCommissionPendingData);
            const vendorBillLines = vendor_bill_service.getLinesByTransactionIds(approvalCommissionAllTransactionIds);
            log.audit({ title: 'Vendor Bill Lines', details: vendorBillLines });

            const vendorBillSavingTotalMap = mapSavingTotal(vendorBillLines)

            const map = mapByTransactionIdAndBuyer(vendorBillLines, approvalCommissionPendingData);
            log.audit({ title: 'Map Vendor Bill Lines by Transaction Id', details: map });

            return {
                vendorBillLinesMap: map,
                vendorBillSavingTotal: vendorBillSavingTotalMap
            };
        }

        function mapSavingTotal(vendorBillLines) {
            return vendorBillLines.reduce((acc, data) => {
                if (!acc[`${data.id}&&${data.buyer}`]) {
                    acc[`${data.id}&&${data.buyer}`] = { totalSaving: 0 };
                }
                acc[`${data.id}&&${data.buyer}`].totalSaving += parseFloat(data.amount);
                return acc;
            }, {});
        }

        function mapByTransactionIdAndBuyer(data, approvalCommissionData) {
            const mapped = data.reduce((acc, vendorBillItem) => {
                let ApprovalCommission = approvalCommissionData.filter(commissionData =>
                    Number(commissionData.transaction) == Number(vendorBillItem.id) && Number(commissionData.buyer) == Number(vendorBillItem.buyer)
                )[0];

                if (!ApprovalCommission) return acc;

                if (!acc[`${vendorBillItem.id}&&${vendorBillItem.buyer}`]) acc[`${vendorBillItem.id}&&${vendorBillItem.buyer}`] = [];

                vendorBillItem['transactionVendorBillUrl'] = buildRecordUrl('vendorbill', vendorBillItem.id);
                vendorBillItem['approvalStatus'] = ApprovalCommission ? ApprovalCommission.status : null;
                vendorBillItem['commissionRecordId'] = ApprovalCommission ? ApprovalCommission.id : null;
                vendorBillItem['entity'] = ApprovalCommission ? ApprovalCommission.vendorEmployee : null;
                vendorBillItem['tranId'] = ApprovalCommission ? ApprovalCommission.tranId : null;
                vendorBillItem['transactionLineUrl'] = buildRecordUrl(vendorBillItem.appliedToRecordType, vendorBillItem.appliedToTransaction);

                acc[`${vendorBillItem.id}&&${vendorBillItem.buyer}`].push(vendorBillItem);

                return acc;
            }, {});
            return mapped;
        }

        function manageApprove(context) {
            const commissionRecords = context.records;
            const isApprove = context.isApprove;
            const approverID = runtime.getCurrentUser().id;

            if (isApprove) {
                commissionRecords.forEach(commissionId => {
                    let commissionRecord = commission_approval_service.load({ id: commissionId });
                    commission_approval_service.set({
                        record: commissionRecord,
                        data: {
                            status: status_commission_service.STATUS_COMMISSION.APPROVED,
                            approver: approverID,
                            approvalDate: new Date()
                        }
                    });
                    commission_approval_service.save(commissionRecord);
                });
            } else {
                commissionRecords.forEach(commissionId => {
                    let commissionRecord = commission_approval_service.load({ id: commissionId });
                    commission_approval_service.set({
                        record: commissionRecord,
                        data: {
                            status: status_commission_service.STATUS_COMMISSION.REPROVED,
                            rejector: approverID,
                            rejectDate: new Date()
                        }
                    });
                    commission_approval_service.save(commissionRecord);
                });
            }

            return { success: true }
        }

        function buildRecordUrl(recordType, recordId) {
            return url.resolveRecord({
                recordType: recordType,
                recordId: recordId
            });
        }

        return {
            get: getHandler,
            post: postHandler
        }
    }
);
