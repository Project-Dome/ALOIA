/**
 * @NApiVersion 2.1
 */
define([
        "N/search",
        "N/record",
        "N/format"
    ],

    (search, record, format) => {
        const handler = {}
        handler.getInventoryRecord = (inventoryNumber, itemId) => {
            let inventoryRecordId;
            search.create({
                type: "inventorynumber",
                filters: [
                    search.createFilter({
                        name: "inventorynumber",
                        operator: search.Operator.IS,
                        values: inventoryNumber
                    }),
                    search.createFilter({
                        name: "item",
                        operator: search.Operator.ANYOF,
                        values: itemId
                    })
                ]
            }).run().getRange({
                start: 0,
                end: 1,
            }).forEach((result) => {
                inventoryRecordId = result.id;
            });
            return inventoryRecordId;
        }
        handler.getManufacturer = (inventoryNumber, itemId, inventoryDetailRecordId) => {
            const lookupInventoryNumber = search.lookupFields({
                type: "inventorynumber",
                id: inventoryNumber,
                columns: [
                    "custitemnumber_aae_manufacturerdetail",
                    "custitemnumber_pd_aae_status_item",
                    "custitemnumber_aln_manufactured_date",
                    "custitemnumber_aln_country_of_origin",
                    "custitemnumber_pd_mir_manufacturer_addr_ls"
                ]
            });
            const inventoryNumberLookup = lookupInventoryNumber["custitemnumber_aae_manufacturerdetail"][0]?.value
            const statusLookup = lookupInventoryNumber["custitemnumber_pd_aae_status_item"][0]?.value
            let dateString = lookupInventoryNumber["custitemnumber_aln_manufactured_date"];
            if(dateString) dateString = format.parse({value: dateString, type: format.Type.DATE});
            return {
                inventoryDetailRecordId: inventoryNumberLookup ? inventoryNumberLookup : inventoryDetailRecordId,
                status: statusLookup,
                manufacturerDate: dateString,
                originCountry: lookupInventoryNumber["custitemnumber_aln_country_of_origin"],
                manufacturerAddress: lookupInventoryNumber["custitemnumber_pd_mir_manufacturer_addr_ls"]
            }
        }
        handler.getManufacturerData = (manufacturerRecordId) => {
    if(!manufacturerRecordId) return {};
    const vendorRecord = record.load({
        type: record.Type.VENDOR,
        id: manufacturerRecordId,
    });
    const vendorAddress = vendorRecord.getValue({fieldId: "defaultaddress"});
    const vendorCountry = vendorRecord.getValue({fieldId: "billcountry"});
    return {
        vendorAddress,
        vendorCountry
    }
}
        return handler;
    });