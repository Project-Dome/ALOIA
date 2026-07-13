/**
 * @NApiVersion 2.1
 */
define([
        "N/format",
        "./pd_pdf_search_module",
        "./pd_pdf_const_module"
    ],

    (format, searchModule, cts) => {

        const handler = {}

        handler.manipulateInvoicePdf = (newRecord) => {

            try {

                const invoicePDFId = newRecord.getValue({
                    fieldId: cts.CUSTOM_FIELDS.TRANSACTIONS.BODY_FIELDS.INVOICE_PDF
                });

                if (invoicePDFId) return null;

                const itemLineCount = newRecord.getLineCount({
                    sublistId: "item"
                });

                const PDFParameters = {}

                PDFParameters["invoiceNumber"] = newRecord.getValue({
                    fieldId: "tranid"
                });

                PDFParameters["invoiceDate"] = newRecord.getValue({
                    fieldId: "trandate"
                });

                PDFParameters["shipTo"] = newRecord.getText({
                    fieldId: "shipaddress"
                });

                PDFParameters["billTo"] = newRecord.getText({
                    fieldId: "billaddress"
                });

                const finalAddressId = newRecord.getValue({
                    fieldId: "custbody_aae_final_destination_cust"
                });

                PDFParameters["finalDestination"] = searchModule.addressFinalData(finalAddressId);

                PDFParameters["custPo"] = newRecord.getValue({
                    fieldId: "otherrefnum"
                });

                PDFParameters["orderDate"] = newRecord.getValue({
                    fieldId: "custbody_aae_cust_po_receipt"
                });

                const employeeId = newRecord.getValue({
                    fieldId: "custbody_created_by"
                });

                if (employeeId) {
                    const {entityid, signatureId} = searchModule.getEmployeeLookup(employeeId);
                    PDFParameters["signature"] = signatureId;
                    PDFParameters["recordcreatedby"] = entityid;
                }

                const customerId = newRecord.getValue({
                    fieldId: "entity"
                });

                const {entitynumber} = searchModule.getCustomerLookup(customerId);
                PDFParameters["entitynumber"] = entitynumber;

                PDFParameters["buyer"] = newRecord.getValue({
                    fieldId: "custbody_pd_customer_buyer"
                });

                PDFParameters["terms"] = newRecord.getText({
                    fieldId: "terms"
                });

                PDFParameters["numberOfItens"] = itemLineCount;

                const salesOrderId = newRecord.getValue({
                    fieldId: "createdfrom"
                });

                const salesOrderData = searchModule.transactionLookup(salesOrderId);
                PDFParameters["salesOrder"] = `#${salesOrderData}`;

                const incontermsSale = newRecord.getText({
                    fieldId: "custbody_pd_incotermssales_bodyfield"
                });

                const incontermsLocation = newRecord.getValue({
                    fieldId: "custbody_pd_incoterms_location"
                });

                PDFParameters["delivery"] = incontermsSale + " " + incontermsLocation;

                const shipViaCarrier = newRecord.getText({fieldId: "custbody_pd_shipvia_carrier"}) || '';
                const shipViaMethod = newRecord.getText({fieldId: "custbody_pd_ship_method_tran"}) || '';

                PDFParameters["shipVia"] = [shipViaCarrier, shipViaMethod]
                    .filter(v => v)
                    .join(' - ');

                PDFParameters["shipViaAcc"] = newRecord.getText({
                    fieldId: "custbody_pd_shipvia_so"
                });

                PDFParameters["numberOfBoxes"] = newRecord.getValue({
                    fieldId: "custbody_pd_number_boxes"
                });

                PDFParameters["weight"] = newRecord.getValue({
                    fieldId: "custbody_pd_gross_weight"
                });

                PDFParameters["shipDate"] = newRecord.getValue({
                    fieldId: "trandate"
                });

                PDFParameters["awb"] = newRecord.getText({
                    fieldId: "custbody_17track_number"
                });

                PDFParameters["invoiceItems"] = [];

                let subTotal = 0;
                let miscChargeTotal = 0;

                for (let index = 0; index < itemLineCount; index++) {

                    let itemLine = {};

                    itemLine["item"] = index + 1;

                    let itemId = newRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        line: index
                    });

                    let itemRecordType = searchModule.getItemRecordType(itemId);

                    switch (itemRecordType) {
                        case "lotnumberedinventoryitem":
                        case "serializedinventoryitem":
                        case "inventoryitem":
                            subTotal += Number(newRecord.getSublistValue({
                                sublistId: "item",
                                fieldId: "amount",
                                line: index
                            }));
                            break;
                        default:
                            miscChargeTotal += Number(newRecord.getSublistValue({
                                sublistId: "item",
                                fieldId: "amount",
                                line: index
                            }));
                    }

                    itemLine["partNumber"] = newRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_pd_partnumbercustomer_display",
                        line: index
                    });

                    itemLine["shipped"] = newRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_aee_quantity_sales",
                        line: index
                    });

                    itemLine["description"] = newRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "description",
                        line: index
                    });

                    itemLine["quantity"] = newRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_aee_quantity_sales",
                        line: index
                    });

                    itemLine["backorder"] = newRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_pd_backorder_sales",
                        line: index
                    });

                    itemLine["trace"] = newRecord.getSublistText({
                        sublistId: "item",
                        fieldId: "custcol_aae_trace",
                        line: index
                    });

                    itemLine["quantityremaining"] = newRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "quantityremaining",
                        line: index
                    });

                    itemLine["condition"] = newRecord.getSublistText({
                        sublistId: "item",
                        fieldId: "custcol_pd_aae_status_item",
                        line: index
                    });

                    let unitPrice = newRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_pd_unit_price_sales",
                        line: index
                    }) || newRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        line: index
                    });

                    itemLine["unitPrice"] = unitPrice;

                    itemLine["UOM"] = newRecord.getSublistText({
                        sublistId: "item",
                        fieldId: "custcol_aae_sales_units",
                        line: index
                    });

                    // itemLine["totalAmount"] = newRecord.getSublistValue({
                    //     sublistId: "item",
                    //     fieldId: "amount",
                    //     line: index
                    // });

                    let partNumberCustomer = newRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_pd_partnumbercustomer_display",
                        line: index
                    });

                    if (!partNumberCustomer) partNumberCustomer = newRecord.getSublistText({
                        sublistId: "item",
                        fieldId: "item",
                        line: index
                    });

                    itemLine["itemName"] = partNumberCustomer;

                    let partNumberVendor = newRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_pd_partnumbervendor_display",
                        line: index
                    });

                    if (partNumberVendor && partNumberVendor !== partNumberCustomer) {
                        itemLine["partNumberVendor"] = partNumberVendor;
                    }

                    // Each lot is kept as its own object with its own dates
                    // const inventoryData = getInventoryData(index, newRecord);
                    // if (inventoryData) {
                    //     itemLine["inventoryNumber"] = inventoryData
                    //         .map(lot => formatLotLabel(lot.inventoryNumber, lot.manufacturedDate, lot.expirationDate))
                    //         .join('\n');
                    // }

                    let manufacturer = newRecord.getSublistText({
                        sublistId: "item",
                        fieldId: "custcol_pd_aae_manufacturer",
                        line: index
                    });

                    if (manufacturer) itemLine["manufacturer"] = manufacturer;

                    let originCountry = newRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_pd_mir_manufacturer_ctry_ds",
                        line: index
                    });

                    if (originCountry) itemLine["originCountry"] = originCountry;

                    let hsCode = newRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_pd_harmonizedcode_linefield",
                        line: index
                    });

                    if (hsCode) itemLine["hsCode"] = hsCode;

                    let eccn = newRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_pd_eccn_linefield",
                        line: index
                    });

                    if (eccn) itemLine["eccn"] = eccn;

                    let manuAdress = newRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_pd_mir_manufacturer_addr_ls",
                        line: index
                    });

                    if (manuAdress) itemLine["manuAdress"] = manuAdress.replaceAll(/[\r\n]+/g, " ");

                    let customerReference = newRecord.getValue({
                        fieldId: "custbody_pd_customer_reference_sales"
                    });

                    if (customerReference) itemLine["customerReference"] = customerReference;

                    let hazMat = newRecord.getSublistText({
                        sublistId: "item",
                        fieldId: "custcol_pd_hazmat",
                        line: index
                    });

                    if (hazMat) itemLine["hazMat"] = hazMat;

                    let itemNotes = newRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_pd_memoline",
                        line: index
                    });

                    if (itemNotes) itemLine["itemNotes"] = itemNotes;

                    let scheduleB = newRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_pd_schedule_b",
                        line: index
                    });

                    if (scheduleB) itemLine["scheduleB"] = scheduleB;

                    let conversionFactor = Number(newRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_aae_measurement_conversion',
                        line: index
                    })) || 1;

                    const inventoryData = getInventoryData(index, newRecord);
                    if (inventoryData) {
                        inventoryData.forEach(lot => {
                            itemLine["quantity"] = Number(lot.quantity) * conversionFactor;
                            itemLine["totalAmount"] = Number(lot.quantity) * Number(unitPrice);
                            lot = formatLotLabel(lot.inventoryNumber, lot.manufacturedDate, lot.expirationDate)
                            itemLine["inventoryNumber"] = lot;
                            PDFParameters["invoiceItems"].push({...itemLine});
                        });
                    } else {
                        PDFParameters["invoiceItems"].push(itemLine);
                    }

                }

                PDFParameters["boxDimensions"] = newRecord.getValue({
                    fieldId: "custbody_pd_box_dimensions"
                });

                PDFParameters["specialInstructions"] = newRecord.getValue({
                    fieldId: "custbody_pd_special_instructions"
                });

                PDFParameters["net"] = newRecord.getValue({
                    fieldId: "custbody_pd_total_net_weight"
                });

                PDFParameters["gross"] = newRecord.getValue({
                    fieldId: "custbody_pd_gross_weight"
                });

                PDFParameters["freight"] = newRecord.getValue({
                    fieldId: "altshippingcost"
                });

                PDFParameters["total"] = newRecord.getValue({
                    fieldId: "total"
                });

                PDFParameters["payableIn"] = newRecord.getText({
                    fieldId: "currencysymbol"
                });

                PDFParameters["taxtotal"] = newRecord.getText({
                    fieldId: "taxtotal"
                });

                PDFParameters["createddate"] = formatDateTimeForPDF(newRecord.getValue({fieldId: 'createddate'}));

                PDFParameters["subTotal"] = subTotal;
                PDFParameters["miscChargeTotal"] = miscChargeTotal;

                return PDFParameters;

            } catch (e) {
                log.error({
                    title: "ERROR IN - manipulateInvoicePdf",
                    details: {
                        stack: e.stack,
                        message: e.message
                    }
                });
            }

        }

        // Returns an array — one object per lot, each with its own dates
        function getInventoryData(index, newRecord) {

            const inventoryDetailField = newRecord.getSublistField({
                sublistId: "item",
                fieldId: "inventorydetail",
                line: index
            });

            if (!inventoryDetailField) return null;

            const inventoryDetailSubrecord = newRecord.getSublistSubrecord({
                sublistId: "item",
                fieldId: "inventorydetail",
                line: index
            });

            const inventoryLineCount = inventoryDetailSubrecord.getLineCount({
                sublistId: "inventoryassignment"
            });

            const lots = [];

            for (let i = 0; i < inventoryLineCount; i++) {

                const lotInternalId = inventoryDetailSubrecord.getSublistValue({
                    sublistId: "inventoryassignment",
                    fieldId: "issueinventorynumber",
                    line: i
                });

                const lotQuantity = inventoryDetailSubrecord.getSublistValue({
                    sublistId: "inventoryassignment",
                    fieldId: "quantity",
                    line: i
                });

                if (lotInternalId) {
                    const lotData = searchModule.getInventoryDetaiLookup(lotInternalId);

                    if (lotData.inventorynumber) {
                        lots.push({
                            inventoryNumber: lotData.inventorynumber,
                            expirationDate: lotData.expirationdate
                                ? new Date(lotData.expirationdate).toISOString()
                                : null,
                            manufacturedDate: lotData.custitemnumber_aln_manufactured_date
                                ? new Date(lotData.custitemnumber_aln_manufactured_date).toISOString()
                                : null,
                            quantity: lotQuantity,
                        });
                    }
                }

            }

            return lots.length ? lots : null;

        }

        // Formats a single lot as "LOT-XXXX - DOM: mm/dd/yyyy - DOE: mm/dd/yyyy"
        function formatLotLabel(inventoryNumber, manufacturedDate, expirationDate) {
            const parts = [inventoryNumber || ''];

            if (manufacturedDate) {
                const d = new Date(manufacturedDate);
                const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
                const dd = String(d.getUTCDate()).padStart(2, '0');
                const yyyy = d.getUTCFullYear();
                parts.push(`DOM: ${mm}/${dd}/${yyyy}`);
            }

            if (expirationDate) {
                const d = new Date(expirationDate);
                const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
                const dd = String(d.getUTCDate()).padStart(2, '0');
                const yyyy = d.getUTCFullYear();
                parts.push(`DOE: ${mm}/${dd}/${yyyy}`);
            }

            return parts.join(' - ');
        }

        function formatDateTimeForPDF(date) {
            if (!date) return '';
            const d = new Date(date);
            const hours = String(d.getUTCHours()).padStart(2, '0');
            const mins = String(d.getUTCMinutes()).padStart(2, '0');
            const secs = String(d.getUTCSeconds()).padStart(2, '0');
            return `${hours}:${mins}:${secs}`;
        }

        return handler;

    });