/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @author Lucas Monaco
 */
define(
    [
        'N/record', 'N/log', 'N/format', 'N/https', 'N/redirect', 'N/runtime',
        '../UseCases/CreateVendor'
    ],
    function 
    (
        record, log, format, https, redirect, runtime,
        createVendor
    ) {

        function beforeLoad(context) {
            try {
                if (context.type !== context.UserEventType.VIEW) return;

                const form = context.form;
                const employee = context.newRecord;

                const isVendor = employee.getValue({ fieldId: 'custentity_pd_aae_is_vendor' });
                const vendorId = employee.getValue({ fieldId: 'custentity_pd_aae_vendor' });

                if (isVendor && vendorId) {
                    form.addButton({
                        id: 'custpage_update_vendor_btn',
                        label: 'Update Vendor',
                        functionName: 'updateVendorFromEmployee'
                    });

                    form.clientScriptModulePath = './UpdateVendor.CS.js';
                }
            } catch (error) {
                log.error({ title: 'Error in beforeLoad', details: error });
            }
        }

        function afterSubmit(context) {

            try {
                if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
                    return;
                }
                const employee = context.newRecord;

                log.debug({
                    title: 'employee',
                    details: employee
                });

                const isVendor = employee.getValue({ fieldId: 'custentity_pd_aae_is_vendor' });

                log.debug({
                    title: 'isVendor',
                    details: isVendor
                });

                if (!isVendor) {
                    return;
                }

                const VendorId = employee.getValue({ fieldId: 'custentity_pd_aae_vendor' });

                log.debug({
                    title: 'VendorId',
                    details: VendorId
                });

                if (!VendorId) {
                    createVendor.createVendor(employee);
                }
                log.debug({
                    title: 'After Submit Completed',
                    details: VendorId
                });
            } catch (error) {
                log.error({
                    title: 'Error in afterSubmit',
                    details: error
                });
            }
        }
        return {
            afterSubmit: afterSubmit,
            beforeLoad: beforeLoad
        }
    })