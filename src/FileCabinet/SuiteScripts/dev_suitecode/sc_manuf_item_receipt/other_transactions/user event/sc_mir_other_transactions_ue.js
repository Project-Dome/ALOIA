/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define([
        "N/record",
        "N/log",
        "../../module/sc_search_module"
    ],

    (record, log, searchModule) => {

        const afterSubmit = (scriptContext) => {

            try {

                const {newRecord, type} = scriptContext;

                log.audit({
                    title: 'afterSubmit - START',
                    details: {recordType: newRecord.type, recordId: newRecord.id, eventType: type}
                });

                if (type === scriptContext.UserEventType.DELETE) {
                    log.audit({title: 'afterSubmit - SKIP', details: 'DELETE event, skipping.'});
                    return true;
                }

                const transactionRecord = record.load({
                    type: newRecord.type,
                    id: newRecord.id,
                    isDynamic: true
                });

                fillManufacturerItem(transactionRecord);

                transactionRecord.save({ignoreMandatoryFields: true});

                log.audit({title: 'afterSubmit - END', details: `Record ${newRecord.id} saved successfully.`});

            } catch (e) {
                log.error({
                    title: 'afterSubmit - UNCAUGHT ERROR',
                    details: {message: e.message, stack: e.stack}
                });
            }

        };

        const fillManufacturerItem = (transactionRecord) => {

                const itemLineCount = transactionRecord.getLineCount({sublistId: 'item'});

                log.audit({
                    title: 'fillManufacturerItem - START',
                    details: `Total item lines: ${itemLineCount}`
                });

                for (let index = 0; index < itemLineCount; index++) {

                    try {

                        // FIX: selectLine BEFORE getCurrentSublistField — otherwise you're
                        // always checking the buffer/previous line context, not `index`.
                        transactionRecord.selectLine({sublistId: 'item', line: index});

                        const itemId = transactionRecord.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'item'
                        });

                        log.debug({
                            title: `fillManufacturerItem - Line ${index}`,
                            details: {itemId}
                        });

                        // Check for inventorydetail field AFTER selectLine
                        const inventoryDetailField = transactionRecord.getCurrentSublistField({
                            sublistId: 'item',
                            fieldId: 'inventorydetail'
                        });

                        if (!inventoryDetailField) {
                            log.debug({
                                title: `fillManufacturerItem - Line ${index} SKIP`,
                                details: 'No inventorydetail field on this line.'
                            });
                            transactionRecord.commitLine({sublistId: 'item'});
                            continue;
                        }

                        const inventoryDetailRecord = transactionRecord.getCurrentSublistSubrecord({
                            sublistId: 'item',
                            fieldId: 'inventorydetail'
                        });

                        const subrecordLineCount = inventoryDetailRecord.getLineCount({
                            sublistId: 'inventoryassignment'
                        });

                        log.debug({
                            title: `fillManufacturerItem - Line ${index} inventory assignments`,
                            details: {subrecordLineCount}
                        });

                        // NOTE: if multiple lots exist on one line, the LAST valid one wins.
                        // This is intentional (matching original behavior) but logged so you can verify.
                        let inventoryDetailRecordId = null;
                        let status = null;
                        let manufacturerDate = null;
                        let originCountry = null;
                        let manufacturerAddress = null;
                        let wrLine = null;
                        let typeCertificate = null;
                        let dateCertificate = null;
                        let numberCertificate = null;

                        for (let jindex = 0; jindex < subrecordLineCount; jindex++) {

                            const inventoryNumber = inventoryDetailRecord.getSublistValue({
                                sublistId: 'inventoryassignment',
                                fieldId: 'issueinventorynumber',
                                line: jindex
                            });

                            log.debug({
                                title: `fillManufacturerItem - Line ${index}, Lot ${jindex}`,
                                details: {inventoryNumber}
                            });

                            if (!inventoryNumber) {
                                log.debug({
                                    title: `fillManufacturerItem - Line ${index}, Lot ${jindex} SKIP`,
                                    details: 'issueinventorynumber is empty.'
                                });
                                continue;
                            }

                            let manufacturerData;
                            try {
                                // Pass null as 3rd arg to avoid previous-lot ID bleeding into fallback
                                manufacturerData = searchModule.getManufacturer(inventoryNumber, itemId, null);
                                log.debug({
                                    title: `fillManufacturerItem - Line ${index}, Lot ${jindex} - getManufacturer result`,
                                    details: manufacturerData
                                });
                            } catch (lookupErr) {
                                log.error({
                                    title: `fillManufacturerItem - Line ${index}, Lot ${jindex} - getManufacturer FAILED`,
                                    details: {inventoryNumber, itemId, message: lookupErr.message, stack: lookupErr.stack}
                                });
                                continue;
                            }

                            inventoryDetailRecordId = manufacturerData['inventoryDetailRecordId'] || null;
                            status = manufacturerData['status'] || null;
                            manufacturerDate = manufacturerData['manufacturerDate'] || null;
                            originCountry = manufacturerData['originCountry'] || null;
                            manufacturerAddress = manufacturerData['manufacturerAddress'] || null;
                            wrLine = manufacturerData['wrLine'];
                            typeCertificate = manufacturerData['typeCertificate'] || null;
                            dateCertificate = manufacturerData['dateCertificate'];
                            numberCertificate = manufacturerData['numberCertificate'];

                        }

                        log.debug({
                            title: `fillManufacturerItem - Line ${index} - resolved manufacturer data`,
                            details: {
                                inventoryDetailRecordId,
                                status,
                                manufacturerDate,
                                originCountry,
                                manufacturerAddress,
                                wrLine
                            }
                        });

                        transactionRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pd_wr_line',
                            value: wrLine || ""
                        });

                        transactionRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pd_tipo_de_certificado',
                            value: typeCertificate
                        });

                        transactionRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcolpd_data_do_certificado',
                            value: dateCertificate ? new Date(dateCertificate) : null
                        });

                        transactionRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pd_numero_do_certificado',
                            value: numberCertificate
                        });

                        transactionRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_aae_manufacturer',
                            value: inventoryDetailRecordId
                        });

                        transactionRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pd_aae_status_item',
                            value: status
                        });

                        transactionRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pd_mir_manu_date_ts',
                            value: manufacturerDate
                        });

                        if (inventoryDetailRecordId) {

                            let vendorData = {};
                            try {
                                vendorData = searchModule.getManufacturerData(inventoryDetailRecordId);
                                log.debug({
                                    title: `fillManufacturerItem - Line ${index} - getManufacturerData result`,
                                    details: vendorData
                                });
                            } catch (vendorErr) {
                                log.error({
                                    title: `fillManufacturerItem - Line ${index} - getManufacturerData FAILED`,
                                    details: {
                                        inventoryDetailRecordId,
                                        message: vendorErr.message,
                                        stack: vendorErr.stack
                                    }
                                });
                            }

                            if (vendorData && Object.keys(vendorData).length !== 0) {

                                transactionRecord.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_pd_mir_manufacturer_addr_ls',
                                    value: manufacturerAddress || vendorData['vendorAddress']
                                });

                                transactionRecord.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_pd_mir_manufacturer_ctry_ds',
                                    value: originCountry || vendorData['vendorCountry']
                                });

                            }

                        } else {
                            log.debug({
                                title: `fillManufacturerItem - Line ${index} SKIP SET`,
                                details: 'No inventoryDetailRecordId resolved — line fields not updated.'
                            });
                        }

                        transactionRecord.commitLine({sublistId: 'item'});

                    } catch (lineErr) {
                        log.error({
                            title: `fillManufacturerItem - Line ${index} - UNCAUGHT LINE ERROR`,
                            details: {message: lineErr.message, stack: lineErr.stack}
                        });
                        // Attempt to commit the line anyway to avoid leaving the record in a dirty state
                        try {
                            transactionRecord.commitLine({sublistId: 'item'});
                        } catch (_) {
                        }
                    }

                }

                log.audit({title: 'fillManufacturerItem - END', details: `Processed ${itemLineCount} lines.`});

            }
        ;

        return {afterSubmit};

    }
)
;