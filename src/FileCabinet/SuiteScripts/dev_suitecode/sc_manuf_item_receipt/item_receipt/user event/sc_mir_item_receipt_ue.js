/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define([
        "N/record",
        "../../module/sc_search_module"
    ],

    (record, searchModule) => {

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {

            try {

                const {
                    newRecord,
                    type
                } = scriptContext;

                if (type === scriptContext.UserEventType.DELETE) return true;

                const itemReceipt = record.load({
                    id: newRecord.id,
                    type: newRecord.type,
                    isDynamic: true
                });

                fillManufacturer(itemReceipt);

                itemReceipt.save({ignoreMandatoryFields: true});

            } catch (e) {
                log.error({
                    title: "ERROR IN - afterSubmit",
                    details: {
                        stack: e.stack,
                        message: e.message
                    }
                });
            }

        }

        const fillManufacturer = (itemReceipt) => {

            const itemLineCount = itemReceipt.getLineCount({
                sublistId: "item"
            });

            for (let index = 0; index < itemLineCount; index++) {

                itemReceipt.selectLine({
                    sublistId: "item",
                    line: index
                });

                let thisManufacturer = itemReceipt.getCurrentSublistValue({
                    sublistId: "item",
                    fieldId: "custcol_aae_manufacturer"
                });

                let thisStatus = itemReceipt.getCurrentSublistValue({
                    sublistId: "item",
                    fieldId: "custcol_pd_aae_status_item"
                });

                let thisCountry = itemReceipt.getCurrentSublistValue({
                    sublistId: "item",
                    fieldId: "custcol_pd_mir_manufacturer_ctry_ds"
                });

                let thisAddr = itemReceipt.getCurrentSublistValue({
                    sublistId: "item",
                    fieldId: "custcol_pd_mir_manufacturer_addr_ls"
                });

                let thisManuDate = itemReceipt.getCurrentSublistValue({
                    sublistId: "item",
                    fieldId: "custcol_pd_mir_manu_date_ts"
                });

                let thisWr = itemReceipt.getCurrentSublistValue({
                    sublistId: "item",
                    fieldId: "custcol_pd_wr_line"
                });

                let thisTypeCertificate = itemReceipt.getCurrentSublistValue({
                    sublistId: "item",
                    fieldId: "custcol_pd_tipo_de_certificado"
                });

                let thisDateCertificate = itemReceipt.getCurrentSublistValue({
                    sublistId: "item",
                    fieldId: "custcolpd_data_do_certificado"
                });

                let thisNumberCertificate = itemReceipt.getCurrentSublistValue({
                    sublistId: "item",
                    fieldId: "custcol_pd_numero_do_certificado"
                });


                if(thisManufacturer) {

                    let manufacturerData = searchModule.getManufacturerData(thisManufacturer);

                    if(!thisCountry) {

                        thisCountry = manufacturerData["vendorCountry"];

                        itemReceipt.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_pd_mir_manufacturer_ctry_ds",
                            value: thisCountry
                        });

                    }

                    if(!thisAddr) {

                        thisAddr = manufacturerData["vendorAddress"];

                        itemReceipt.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_pd_mir_manufacturer_addr_ls",
                            value: thisAddr
                        });

                    }

                }

                let inventoryDetailField = itemReceipt.getCurrentSublistField({
                    sublistId: "item",
                    fieldId: "inventorydetail"
                });

                if (!inventoryDetailField) continue;

                let itemId = itemReceipt.getCurrentSublistValue({
                    sublistId: "item",
                    fieldId: "item"
                });

                let inventoryDetailRecord = itemReceipt.getCurrentSublistSubrecord({
                    sublistId: "item",
                    fieldId: "inventorydetail",
                });

                const subrecordLineCount = inventoryDetailRecord.getLineCount({
                    sublistId: "inventoryassignment"
                });

                for (let jindex = 0; jindex < subrecordLineCount; jindex++) {

                    let inventoryNumber = inventoryDetailRecord.getSublistValue({
                        sublistId: "inventoryassignment",
                        fieldId: "receiptinventorynumber",
                        line: jindex
                    });

                    let inventoryDetailRecordId = searchModule.getInventoryRecord(inventoryNumber, itemId);

                    const values = {}

                    if (thisManufacturer) values["custitemnumber_aae_manufacturerdetail"] = thisManufacturer;
                    if (thisStatus) values["custitemnumber_pd_aae_status_item"] = thisStatus;
                    if(thisCountry) values["custitemnumber_aln_country_of_origin"] = thisCountry;
                    if(thisAddr) values["custitemnumber_pd_mir_manufacturer_addr_ls"] = thisAddr;
                    if(thisManuDate) values["custitemnumber_aln_manufactured_date"] = thisManuDate;
                    values["custitemnumber_pd_type_of_certificate"] = thisTypeCertificate;
                    values["custitemnumber_pd_certificate_date"] = thisDateCertificate;
                    values["custitemnumber_pd_certificate_number"] = thisNumberCertificate;

                    values["custitemnumber_pd_wr_line"] = thisWr;

                    if (Object.keys(values).length > 0 && inventoryDetailRecordId) record.submitFields({
                        id: inventoryDetailRecordId,
                        type: "inventorynumber",
                        values: values
                    });

                }

                itemReceipt.commitLine({sublistId: "item"});

            }

        }

        return {afterSubmit}

    });
