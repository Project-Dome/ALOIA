/**
 * @NApiVersion 2.1
 * @author Lucas Monaco
 */
define(
    [
        'N/record', 'N/log', 'N/format', 'N/https', 'N/redirect', 'N/runtime'
    ],
    function
        (
            record, log, format, https, redirect, runtime
        ) {
        function createVendor(employee) {
            try {
                const employeeRecord = record.load({
                    type: record.Type.EMPLOYEE,
                    id: employee.id,
                    isDynamic: true
                });
                const employeeId = employee.id;

                //Take the informations
                const firstName = employee.getValue({ fieldId: 'firstname' })
                const middleName = employee.getValue({ fieldId: 'middlename' })
                const lastName = employee.getValue({ fieldId: 'lastname' })
                const subsidiary = employee.getValue({ fieldId: 'subsidiary' })
                let address = {};

                for (let i = 0; i < employee.getLineCount({ sublistId: 'addressbook' }); i++) {
                    if (!employee.getSublistValue({ sublistId: 'addressbook', fieldId: 'defaultbilling', line: i }))
                        continue
                    employeeRecord.selectLine({
                        sublistId: 'addressbook',
                        line: i
                    });
                    const addressRecord = employeeRecord.getCurrentSublistSubrecord({
                        sublistId: 'addressbook',
                        fieldId: 'addressbookaddress',
                        line: i
                    });

                    address.country = addressRecord.getValue({ fieldId: 'country' });
                    address.street = addressRecord.getValue({ fieldId: 'addr1' });
                    address.city = addressRecord.getValue({ fieldId: 'city' });
                    address.state = addressRecord.getValue({ fieldId: 'state' });
                    address.zip = addressRecord.getValue({ fieldId: 'zip' });

                    log.debug({
                        title: 'Address',
                        details: address
                    });
                }

                const vendorRecord = record.create({
                    type: record.Type.VENDOR,
                    isDynamic: true
                });

                // setValue
                vendorRecord.setValue({ fieldId: 'firstname', value: firstName });
                vendorRecord.setValue({ fieldId: 'middlename', value: middleName });
                vendorRecord.setValue({ fieldId: 'lastname', value: lastName });
                vendorRecord.setValue({ fieldId: 'subsidiary', value: subsidiary });
                vendorRecord.setValue({ fieldId: 'isperson', value: 'T' });
                vendorRecord.setValue({ fieldId: 'custentity_pd_aae_is_employee', value: true });
                vendorRecord.setValue({ fieldId: 'custentity_pd_aae_employee', value: employeeId });
                vendorRecord.selectNewLine({ sublistId: 'addressbook' });

                const addressSubrecord = vendorRecord.getCurrentSublistSubrecord({
                    sublistId: 'addressbook',
                    fieldId: 'addressbookaddress'
                });

                addressSubrecord.setValue({ fieldId: 'country', value: address.country });
                addressSubrecord.setValue({ fieldId: 'addr1', value: address.street });
                addressSubrecord.setValue({ fieldId: 'city', value: address.city });
                addressSubrecord.setValue({ fieldId: 'state', value: address.state });
                addressSubrecord.setValue({ fieldId: 'zip', value: address.zip });

                vendorRecord.setCurrentSublistValue({
                    sublistId: 'addressbook',
                    fieldId: 'defaultbilling',
                    value: true
                });

                vendorRecord.commitLine({ sublistId: 'addressbook' });

                log.debug({
                    title: 'Vendor Record',
                    details: vendorRecord
                });

                const vendor = vendorRecord.save({ ignoreMandatoryFields: true });

                log.debug({
                    title: 'Vendor Created',
                    details: vendor
                });

                record.submitFields({
                    type: record.Type.EMPLOYEE,
                    id: employeeId,
                    values: {
                        'custentity_pd_aae_vendor': vendor,
                        'custentity_pd_aae_is_vendor': true
                    }
                });

            } catch (error) {
                log.error({
                    title: 'Error in createVendor',
                    details: error
                });
            }
        }
        return {
            createVendor: createVendor
        }
    })