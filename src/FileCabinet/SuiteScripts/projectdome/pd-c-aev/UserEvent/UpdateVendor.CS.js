/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @author Lucas Monaco
 */
define(['N/url', 'N/record', 'N/https', 'N/currentRecord', 'N/ui/message', 'N/ui/dialog'],
    function (url, record, https, currentRecord, message, dialog) {

        function pageInit(context) {
        }

        function updateVendorFromEmployee() {
            try {
                let options = {
                    title: 'Notice',
                    message: 'Do you want to continue with the vendor update?',
                };

                function success(result) {
                    const myMessage = message.create({
                        title: '',
                        message: 'Updated Vendor with Sucess!',
                        type: message.Type.CONFIRMATION
                    });

                    myMessage.show();

                    const employeeId = currentRecord.get().id;

                    const employee = record.load({
                        type: record.Type.EMPLOYEE,
                        id: employeeId,
                        isDynamic: true
                    });

                    const vendorId = employee.getValue({ fieldId: 'custentity_pd_aae_vendor' });

                    const firstName = employee.getValue({ fieldId: 'firstname' });
                    const middleName = employee.getValue({ fieldId: 'middlename' });
                    const lastName = employee.getValue({ fieldId: 'lastname' });
                    const subsidiary = employee.getValue({ fieldId: 'subsidiary' });

                    const address = {};

                    for (let i = 0; i < employee.getLineCount({ sublistId: 'addressbook' }); i++) {
                        if (!employee.getSublistValue({ sublistId: 'addressbook', fieldId: 'defaultbilling', line: i }))
                            continue

                        employee.selectLine({
                            sublistId: 'addressbook',
                            line: i
                        });

                        const addressRecord = employee.getCurrentSublistSubrecord({
                            sublistId: 'addressbook',
                            fieldId: 'addressbookaddress'
                        });

                        address.country = addressRecord.getValue({ fieldId: 'country' });
                        address.street = addressRecord.getValue({ fieldId: 'addr1' });
                        address.city = addressRecord.getValue({ fieldId: 'city' });
                        address.state = addressRecord.getValue({ fieldId: 'state' });
                        address.zip = addressRecord.getValue({ fieldId: 'zip' });

                    }

                    const vendor = record.load({
                        type: record.Type.VENDOR,
                        id: vendorId,
                        isDynamic: true
                    });

                    vendor.setValue({ fieldId: 'firstname', value: firstName });
                    vendor.setValue({ fieldId: 'middlename', value: middleName });
                    vendor.setValue({ fieldId: 'lastname', value: lastName });
                    vendor.setValue({ fieldId: 'subsidiary', value: subsidiary });

                    vendor.selectNewLine({ sublistId: 'addressbook' });

                    const addressSubrecord = vendor.getCurrentSublistSubrecord({
                        sublistId: 'addressbook',
                        fieldId: 'addressbookaddress'
                    });

                    addressSubrecord.setValue({ fieldId: 'country', value: address.country });
                    addressSubrecord.setValue({ fieldId: 'addr1', value: address.street });
                    addressSubrecord.setValue({ fieldId: 'city', value: address.city });
                    addressSubrecord.setValue({ fieldId: 'state', value: address.state });
                    addressSubrecord.setValue({ fieldId: 'zip', value: address.zip });

                    vendor.setCurrentSublistValue({
                        sublistId: 'addressbook',
                        fieldId: 'defaultbilling',
                        value: true
                    });

                    vendor.commitLine({ sublistId: 'addressbook' });

                    const vendorIdSaved = vendor.save();

                    setTimeout(() => {
                        location.reload();
                    }, 2000);

                }

                function failure(reason) {
                    console.log('Failure: ' + reason);
                }

                dialog.confirm(options)
                    .then(function (result) {
                        if (!result) return;

                        success(result);
                    })
                    .catch(failure);

            }
            catch (error) {
                console.error('Error in update Vendor:', error);
                alert('Erro: ' + error.message);
            }
        }

        return {
            pageInit: pageInit,
            updateVendorFromEmployee: updateVendorFromEmployee
        };
    }
);
