/**
 * @NApiVersion 2.1
 */
define([
        "N/query"
    ],

    (query) => {

        const handler = {}

        handler.getXmlParameters = (salesOrderId) => {

            return query.runSuiteQL({
                query: (`SELECT pn_number.NAME                                AS pn,
                                invl.memo                                     AS description,
                                invn.inventorynumber                          AS sn,
                                CASE WHEN i.isserialitem = 'T' THEN 'T' ELSE 'F' END AS is_serie,
                                ia.quantity                                   AS qty,
                                po.tranid                                     AS po_number,
                                To_char(t.trandate, 'MM/DD/YYYY')             AS rec_date,
                                To_char(invn.expirationdate, 'MM/DD/YYYY')    AS exp_date,
                                item_status.NAME                              AS cond,
                                unitstype.NAME                                AS uom,
                                loc.NAME                                      AS location,
                                t.custbody_wr                                 AS receiver,
                                customer.companyname                          AS notes_customer,
                                so.otherrefnum                                AS notes_po,
                                inv.tranid                                    AS notes_invoice
                         FROM   TRANSACTION t
                                    INNER JOIN transactionline tl
                                               ON tl.TRANSACTION = t.id
                                    LEFT JOIN item i
                                              ON i.id = tl.item
                                    LEFT JOIN previoustransactionlink ptl
                                              ON ptl.nextdoc = t.id
                                    LEFT JOIN TRANSACTION po
                                              ON po.id = ptl.previousdoc
                                                  AND po.type = 'PurchOrd'
                                    LEFT JOIN transactionline pol
                                              ON pol.TRANSACTION = po.id
                                                  AND pol.item = tl.item
                                                  AND pol.mainline = 'F'
                                    LEFT JOIN inventoryassignment ia
                                              ON ia.TRANSACTION = t.id
                                                  AND ia.transactionline = tl.id
                                    LEFT JOIN inventorynumber invn
                                              ON invn.id = ia.inventorynumber
                                    LEFT JOIN customrecord_aae_part_number_spec_vend pn_number
                                              ON pn_number.id = pol.custcol_pd_partnumbervendor
                                    LEFT JOIN customlist_pd_aae_status_item item_status
                                              ON item_status.id = tl.custcol_pd_aae_status_item
                                    LEFT JOIN unitstype
                                              ON unitstype.id = tl.units
                                    LEFT JOIN location loc
                                              ON loc.id = tl.location
                                    LEFT JOIN TRANSACTION so
                                              ON so.id = t.custbody_related_so
                                    LEFT JOIN customer
                                              ON customer.id = so.entity
                                    LEFT JOIN (
                             SELECT ptl_inv.previousdoc  AS so_id,
                                    MIN(ptl_inv.nextdoc) AS invoice_id
                             FROM   previoustransactionlink ptl_inv
                                        INNER JOIN TRANSACTION inv
                                                   ON inv.id = ptl_inv.nextdoc
                                                       AND inv.type = 'CustInvc'
                             GROUP  BY ptl_inv.previousdoc
                         ) first_inv
                                              ON first_inv.so_id = so.id
                                    LEFT JOIN TRANSACTION inv
                                              ON inv.id = first_inv.invoice_id
                                    LEFT JOIN transactionline invl
                                              ON invl.TRANSACTION = inv.id
                                                  AND invl.item = tl.item
                                                  AND invl.mainline = 'F'
                         WHERE  t.type = 'ItemRcpt'
                           AND tl.mainline = 'F'
                           AND so.id = '${salesOrderId}'
                         ORDER  BY t.trandate DESC,
                                   tl.linesequencenumber,
                                   ia.id`)
            }).asMappedResults();

        }

        return handler;

    });
