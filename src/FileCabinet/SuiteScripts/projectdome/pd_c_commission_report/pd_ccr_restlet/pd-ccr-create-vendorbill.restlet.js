/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @Author Lucas Monaco
 */
define(
    [
        'N/record',
        'N/log',
        'N/format',
        '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js'
    ],
    function (
        record,
        log,
        format
    ) {

        function formatDate(dateStr) {
            if (!dateStr) return null;

            // Divide a string recebida (YYYY-MM-DD)
            let parts = dateStr.split('-');
            if (parts.length !== 3) return null;

            let year = parseInt(parts[0], 10);
            let month = parseInt(parts[1], 10) - 1; // mês no JS começa em 0
            let day = parseInt(parts[2], 10);

            // Retorna como objeto Date
            return new Date(year, month, day);
        }



        function postHandler(requestBody) {
            try {
                log.debug('Request Body', requestBody);

                const { records, dueDate, vendorId } = requestBody;
                if (!records || !records.length) {
                    throw new Error('Nenhum registro enviado para criação da VendorBill.');
                }

                const hasVendorId = !isNullOrEmpty(vendorId)

                if (!hasVendorId) {
                    throw "Is Not Defined Vendor"
                }

                log.debug('Creating Vendor Bill', {
                    records: records
                });

                let vendorBill = record.create({
                    type: record.Type.VENDOR_BILL,
                    isDynamic: true
                });

                vendorBill.setValue({
                    fieldId: 'entity',
                    value: vendorId
                });

                vendorBill.setValue({
                    fieldId: 'trandate',
                    value: new Date()
                });

                log.debug('Due Date', formatDate(dueDate));

                vendorBill.setValue({
                    fieldId: 'duedate',
                    value: formatDate(dueDate)
                });

                records.forEach(function (rec) {
                    vendorBill.selectNewLine({ sublistId: 'expense' });
                    vendorBill.setCurrentSublistValue({
                        sublistId: 'expense',
                        fieldId: 'account',
                        value: 211
                    });
                    vendorBill.setCurrentSublistValue({
                        sublistId: 'expense',
                        fieldId: 'amount',
                        value: rec.amountValue
                    });
                    vendorBill.setCurrentSublistValue({
                        sublistId: 'expense',
                        fieldId: 'memo',
                        value: `Commission ID: ${rec.id}`
                    });
                    vendorBill.commitLine({ sublistId: 'expense' });
                });

                const vbId = vendorBill.save({ ignoreMandatoryFields: true });
                log.debug('VendorBill Criada', `ID: ${vbId}`);

                records.forEach(function (approvalComissionList) {
                    approvalComissionList.details.forEach(function (approvalComissionData) {
                        record.submitFields({
                            type: 'customrecord_pd_ccr_approval_comission',
                            id: approvalComissionData.id,
                            values: {
                                custrecord_pd_ccr_vendor_bill_linked: vbId
                            }
                        });
                    });
                });

                return {
                    success: true,
                    vendorBillId: vbId,
                    linkedRecords: records.map(r => r.id)
                };

            } catch (e) {
                log.error('Erro na criação da VendorBill', e);
                return {
                    success: false,
                    message: e?.message || e
                };
            }
        }

        return {
            post: postHandler
        };
    });
